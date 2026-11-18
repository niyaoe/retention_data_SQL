
const { pool } = require("../config/db");

const DMS_RETAIL_URL =
  "https://eramsales.in/dailysalesreport.com/dms_retail_full_feed.php";

const BATCH_SIZE = 500;

// ==========================================
// CSV PARSER
// Handles quoted values, commas and escaped quotes
// ==========================================

function parseCSV(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  csv = csv.replace(/^\uFEFF/, "");

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(value);
      value = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !insideQuotes
    ) {
      if (char === "\r" && next === "\n") i++;

      row.push(value);

      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);

    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
  }

  if (!rows.length) {
    throw new Error("CSV feed is empty");
  }

  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((values) => {
    const record = {};

    headers.forEach((header, index) => {
      record[header] = (values[index] || "").trim();
    });

    return record;
  });
}

// ==========================================
// DATE NORMALIZER
// Supports:
// DD-MM-YY
// YYYY-MM-DD HH:mm:ss
// YYYY-MM-DDTHH:mm:ss
// ==========================================

function normalizeInvoiceDate(value) {
  if (!value) return null;

  const input = String(value).trim();

  let match = input.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/
  );

  if (match) {
    const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;

    const result =
      `${year}-${month}-${day} ${hour}:${minute}:${second}`;

    const check = new Date(
      `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
    );

    if (Number.isNaN(check.getTime())) return null;

    return result;
  }

  match = input.match(
    /^(\d{2})-(\d{2})-(\d{2}|\d{4})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/
  );

  if (!match) return null;

  let [, day, month, year, hour = "00", minute = "00", second = "00"] =
    match;

  if (year.length === 2) {
    year = Number(year) >= 70 ? `19${year}` : `20${year}`;
  }

  const check = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
  );

  if (Number.isNaN(check.getTime())) return null;

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

// ==========================================
// COMPARE TWO RECORDS
// Latest invoice date wins.
// Invoice number breaks date ties.
// ==========================================

function isNewerRecord(candidate, existing) {
  if (!existing) return true;

  if (candidate.invoice_date_time !== existing.invoice_date_time) {
    return candidate.invoice_date_time > existing.invoice_date_time;
  }

  return candidate.invoice_number.localeCompare(
    existing.invoice_number
  ) > 0;
}

// ==========================================
// SYNC DMS RETAIL FEED
// ==========================================

async function runDmsRetailSync() {
  const connection = await pool.getConnection();

  try {
    const [lockRows] = await connection.query(
      "SELECT GET_LOCK('retention_dms_retail_sync', 0) AS lock_status"
    );

    if (Number(lockRows[0].lock_status) !== 1) {
      return {
        success: false,
        message: "Another DMS Retail sync is already running",
      };
    }

    console.log("[DMS RETAIL] Sync started");

    const response = await fetch(DMS_RETAIL_URL, {
      signal: AbortSignal.timeout(180000),
      headers: {
        Accept: "text/csv,text/plain,*/*",
      },
    });

    if (!response.ok) {
      throw new Error(
        `DMS feed request failed: HTTP ${response.status}`
      );
    }

    const csv = await response.text();

    if (!csv || !csv.trim()) {
      throw new Error("DMS feed returned empty content");
    }

    const records = parseCSV(csv);

    const requiredHeaders = [
      "retail",
      "chassis_number",
      "phone_no",
      "lessee_mobile_number",
      "dealer_code",
      "model_group",
      "pin",
      "email_id",
      "invoice_number",
      "invoice_date_time",
    ];

    const availableHeaders = Object.keys(records[0] || {});

    const missingHeaders = requiredHeaders.filter(
      (header) => !availableHeaders.includes(header)
    );

    if (missingHeaders.length) {
      throw new Error(
        `Missing CSV columns: ${missingHeaders.join(", ")}`
      );
    }

    const retailRecords = records.filter(
      (record) => record.retail.trim() === "1"
    );

    const latestByChassis = new Map();

    let missingChassis = 0;
    let invalidDates = 0;

    for (const record of retailRecords) {
      const chassis = (record.chassis_number || "")
        .trim()
        .toUpperCase();

      if (!chassis) {
        missingChassis++;
        continue;
      }

      const invoiceDate = normalizeInvoiceDate(
        record.invoice_date_time
      );

      if (!invoiceDate) {
        invalidDates++;
        continue;
      }

      const normalized = {
        chassis_no: chassis,
        phone_no: record.phone_no || null,
        lessee_mobile_number:
          record.lessee_mobile_number || null,
        dealer_code: record.dealer_code || null,
        model_group: record.model_group || null,
        pin: record.pin || null,
        email: record.email_id || null,
        invoice_number: record.invoice_number || "",
        invoice_date_time: invoiceDate,
      };

      const existing = latestByChassis.get(chassis);

      if (isNewerRecord(normalized, existing)) {
        latestByChassis.set(chassis, normalized);
      }
    }

    const uniqueRecords = Array.from(latestByChassis.values());

    let upsertedRows = 0;
    let batchesCompleted = 0;

    const sql = `
      INSERT INTO dms_retail (
        chassis_no,
        phone_no,
        lessee_mobile_number,
        dealer_code,
        model_group,
        pin,
        email,
        invoice_number,
        invoice_date_time
      )
      VALUES ?
      ON DUPLICATE KEY UPDATE
        phone_no = IF(
          VALUES(invoice_date_time) > invoice_date_time
          OR (
            VALUES(invoice_date_time) = invoice_date_time
            AND VALUES(invoice_number) >= invoice_number
          ),
          VALUES(phone_no), phone_no
        ),
        lessee_mobile_number = IF(
          VALUES(invoice_date_time) > invoice_date_time
          OR (
            VALUES(invoice_date_time) = invoice_date_time
            AND VALUES(invoice_number) >= invoice_number
          ),
          VALUES(lessee_mobile_number), lessee_mobile_number
        ),
        dealer_code = IF(
          VALUES(invoice_date_time) > invoice_date_time
          OR (
            VALUES(invoice_date_time) = invoice_date_time
            AND VALUES(invoice_number) >= invoice_number
          ),
          VALUES(dealer_code), dealer_code
        ),
        model_group = IF(
          VALUES(invoice_date_time) > invoice_date_time
          OR (
            VALUES(invoice_date_time) = invoice_date_time
            AND VALUES(invoice_number) >= invoice_number
          ),
          VALUES(model_group), model_group
        ),
        pin = IF(
          VALUES(invoice_date_time) > invoice_date_time
          OR (
            VALUES(invoice_date_time) = invoice_date_time
            AND VALUES(invoice_number) >= invoice_number
          ),
          VALUES(pin), pin
        ),
        email = IF(
          VALUES(invoice_date_time) > invoice_date_time
          OR (
            VALUES(invoice_date_time) = invoice_date_time
            AND VALUES(invoice_number) >= invoice_number
          ),
          VALUES(email), email
        ),
        invoice_number = IF(
          VALUES(invoice_date_time) > invoice_date_time
          OR (
            VALUES(invoice_date_time) = invoice_date_time
            AND VALUES(invoice_number) >= invoice_number
          ),
          VALUES(invoice_number), invoice_number
        ),
        invoice_date_time = IF(
          VALUES(invoice_date_time) > invoice_date_time
          OR (
            VALUES(invoice_date_time) = invoice_date_time
            AND VALUES(invoice_number) >= invoice_number
          ),
          VALUES(invoice_date_time), invoice_date_time
        )
    `;

    for (let i = 0; i < uniqueRecords.length; i += BATCH_SIZE) {
      const batch = uniqueRecords.slice(i, i + BATCH_SIZE);

      const values = batch.map((record) => [
        record.chassis_no,
        record.phone_no,
        record.lessee_mobile_number,
        record.dealer_code,
        record.model_group,
        record.pin,
        record.email,
        record.invoice_number,
        record.invoice_date_time,
      ]);

      await connection.query(sql, [values]);

      upsertedRows += batch.length;
      batchesCompleted++;
    }

    const [countRows] = await connection.query(
      "SELECT COUNT(*) AS totalRecords FROM dms_retail"
    );

    const result = {
      success: true,
      totalFeedRows: records.length,
      retailRows: retailRecords.length,
      uniqueChassisRows: uniqueRecords.length,
      missingChassis,
      invalidDates,
      batchesCompleted,
      upsertedRows,
      totalRecordsInTable: Number(countRows[0].totalRecords),
    };

    console.log("[DMS RETAIL] Sync completed", result);

    return result;
  } finally {
    try {
      await connection.query(
        "SELECT RELEASE_LOCK('retention_dms_retail_sync')"
      );
    } catch (error) {
      console.error("[DMS RETAIL] Lock release failed:", error.message);
    }

    connection.release();
  }
}

// ==========================================
// MANUAL SYNC API
// ==========================================

exports.syncDmsRetail = async (req, res) => {
  try {
    const result = await runDmsRetailSync();

    if (!result.success) {
      return res.status(409).json(result);
    }

    res.json({
      message: "DMS Retail sync completed",
      ...result,
    });
  } catch (error) {
    console.error("[DMS RETAIL SYNC ERROR]", error);

    res.status(500).json({
      message: "DMS Retail sync failed",
      error: error.message,
    });
  }
};

// ==========================================
// GET DMS RETAIL WITH SEARCH + PAGINATION
// ==========================================

exports.getDmsRetail = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 25)
    );

    const offset = (page - 1) * limit;

    const search = (req.query.search || "").trim();

    const where = [];
    const params = [];

    if (search) {
      const searchValue = `%${search}%`;

      where.push(`(
        chassis_no LIKE ?
        OR phone_no LIKE ?
        OR lessee_mobile_number LIKE ?
        OR dealer_code LIKE ?
        OR model_group LIKE ?
        OR pin LIKE ?
        OR email LIKE ?
      )`);

      params.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    const whereSQL = where.length
      ? `WHERE ${where.join(" AND ")}`
      : "";

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM dms_retail ${whereSQL}`,
      params
    );

    const [rows] = await pool.query(
      `
        SELECT
          id,
          chassis_no,
          phone_no,
          lessee_mobile_number,
          dealer_code,
          model_group,
          pin,
          email
        FROM dms_retail
        ${whereSQL}
        ORDER BY invoice_date_time DESC, id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const total = Number(countRows[0].total);

    res.json({
      records: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[DMS RETAIL GET ERROR]", error);

    res.status(500).json({
      message: "Failed to load DMS Retail records",
      error: error.message,
    });
  }
};

exports.runDmsRetailSync = runDmsRetailSync;
