
const { pool } = require("../config/db");

const API_URL =
  process.env.SALES_DELIVERY_API_URL ||
  "https://eramsales.in/stock/delivery_ytd_api.php";

const LOCK_NAME = "retention_sales_api_sync";

const normalize = (value) =>
  String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;

      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);

      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows.shift().map((header) =>
    header.replace(/^\uFEFF/, "").trim()
  );

  return rows.map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? "").trim();
    });
    return record;
  });
}

function parseDate(value) {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day));

  if (
    date.getUTCFullYear() !== +year ||
    date.getUTCMonth() !== +month - 1 ||
    date.getUTCDate() !== +day
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}


async function fetchSalesCsv() {
  const maxAttempts = 3;
  const timeoutMs = 300000; // 5 minutes

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `[SALES SYNC] Fetching API. Attempt ${attempt}/${maxAttempts}`
      );

      const response = await fetch(API_URL, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          Accept: "text/csv,text/plain,*/*",
        },
      });

      if (!response.ok) {
        if (response.status >= 500 && attempt < maxAttempts) {
          console.log(`[SALES SYNC] HTTP ${response.status}. Retrying...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 5000));
          continue;
        }

        throw new Error(`Sales API returned HTTP ${response.status}`);
      }

      const csvText = await response.text();

      if (!csvText.trim()) {
        throw new Error("Sales API returned an empty response.");
      }

      console.log(
        `[SALES SYNC] CSV downloaded successfully (${csvText.length} characters).`
      );

      return csvText;

    } catch (error) {
      console.error(
        `[SALES SYNC] Attempt ${attempt} failed:`,
        error.message
      );

      if (attempt === maxAttempts) {
        throw error;
      }

      await new Promise(resolve =>
        setTimeout(resolve, attempt * 10000)
      );
    }
  }
}


// Shared function for manual and automatic sync.
async function runSalesSync() {
  let connection;
  let lockAcquired = false;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();

    // Prevent simultaneous manual/automatic syncs.
    const [lockRows] = await connection.query(
      "SELECT GET_LOCK(?, 0) AS acquired",
      [LOCK_NAME]
    );

    if (Number(lockRows[0]?.acquired) !== 1) {
      throw new Error("Sales sync is already running. Try again later.");
    }

    lockAcquired = true;

    
    // 1. Fetch API CSV with timeout and automatic retries.
    const csvText = await fetchSalesCsv();

    if (!csvText.trim()) {
      throw new Error("Sales API returned an empty response.");
    }

    const apiRecords = parseCSV(csvText);

    if (!apiRecords.length) {
      throw new Error("No records found in the API CSV.");
    }

    // 2. Load SQL master mappings.
    const [branches] = await connection.query(`
      SELECT d_code, branch_name
      FROM branch_master
      WHERE d_code IS NOT NULL
        AND branch_name IS NOT NULL
    `);

    const [models] = await connection.query(`
      SELECT model_group, sub_segment
      FROM model_master
      WHERE is_active = 1
    `);

    const branchMap = new Map(
      branches.map((item) => [
        normalize(item.d_code),
        item.branch_name.trim(),
      ])
    );

    const modelMap = new Map(
      models.map((item) => [
        normalize(item.model_group),
        {
          modelGroup: item.model_group.trim(),
          segment: item.sub_segment?.trim() || null,
        },
      ])
    );

    // 3. Map and validate API records.
    const report = {
      apiRows: apiRecords.length,
      validRows: 0,
      skippedRows: 0,
      unmatchedBranches: {},
      unmatchedModels: {},
      missingChassis: 0,
      invalidDates: 0,
      batchesCompleted: 0,
      upsertedRows: 0,
    };

    const mappedRecords = [];

    for (const record of apiRecords) {
      const chassis = normalize(record.Chassis_No);

      if (!chassis) {
        report.missingChassis++;
        report.skippedRows++;
        continue;
      }

      const branchCode = normalize(record.Dealer_Location_Code);
      const modelKey = normalize(record.Model_Group);

      const branchName = branchMap.get(branchCode);
      const model = modelMap.get(modelKey);

      if (!branchName) {
        const key = branchCode || "(blank)";
        report.unmatchedBranches[key] =
          (report.unmatchedBranches[key] || 0) + 1;
      }

      if (!model) {
        const key = modelKey || "(blank)";
        report.unmatchedModels[key] =
          (report.unmatchedModels[key] || 0) + 1;
      }

      if (!branchName || !model) {
        report.skippedRows++;
        continue;
      }

      const deliveryDate = parseDate(record.Delivery_Date);

      if (record.Delivery_Date && !deliveryDate) {
        report.invalidDates++;
      }

      mappedRecords.push([
        deliveryDate,
        chassis,
        branchName,
        model.modelGroup,
        record.Customer_Name || null,
        record.PIN_Code || null,
        null,
        model.segment,
      ]);
    }

    report.validRows = mappedRecords.length;

    // 4. UPSERT in batches.
    await connection.beginTransaction();
    transactionStarted = true;

    const batchSize = 500;

    for (let i = 0; i < mappedRecords.length; i += batchSize) {
      const batch = mappedRecords.slice(i, i + batchSize);

      const placeholders = batch
        .map(() => "(?, ?, ?, ?, ?, ?, ?, ?)")
        .join(", ");

      const values = batch.flat();

      const sql = `
        INSERT INTO sales_data_combined
        (
          delivery_date,
          chassis_no,
          sale_branch,
          model_group,
          cust_name,
          postal_code,
          mobile_no,
          segment
        )
        VALUES ${placeholders}
        ON DUPLICATE KEY UPDATE
          delivery_date = VALUES(delivery_date),
          sale_branch = VALUES(sale_branch),
          model_group = VALUES(model_group),
          cust_name = VALUES(cust_name),
          postal_code = VALUES(postal_code),
          mobile_no = COALESCE(VALUES(mobile_no), mobile_no),
          segment = VALUES(segment)
      `;

      await connection.query(sql, values);

      report.batchesCompleted++;
      report.upsertedRows += batch.length;
    }

    await connection.commit();
    transactionStarted = false;

    console.log(
      `[SALES SYNC] Success: ${report.upsertedRows} rows processed.`
    );

    return report;
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    throw error;
  } finally {
    if (connection && lockAcquired) {
      try {
        await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]);
      } catch (error) {
        console.error("[SALES SYNC] Lock release error:", error.message);
      }
    }

    if (connection) connection.release();
  }
}

// Manual admin endpoint.
exports.syncSalesFromAPI = async (req, res) => {
  try {
    const report = await runSalesSync();

    return res.status(200).json({
      success: true,
      message: "Sales API sync completed successfully.",
      report,
    });
  } catch (error) {
    console.error("[SALES SYNC] Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Sales API sync failed.",
    });
  }
};

// Used by automatic scheduler.
exports.runSalesSync = runSalesSync;
