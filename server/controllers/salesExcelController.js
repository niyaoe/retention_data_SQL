
const XLSX = require("xlsx");
const { pool } = require("../config/db");
const { syncChassisMaster } = require("../services/chassisMasterSyncService");

const SHEET_NAME = "Sales Data";
const BATCH_SIZE = 500;

const REQUIRED_HEADERS = [
  "Delivery_Date",
  "Chassis_No",
  "Sale Branch",
  "Model_Group",
  "Cust Name",
  "PostalCode",
  "Mobile no",
  "Segment"
];

const normalizeHeader = (value) =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeChassis = (value) =>
  String(value || "").trim().toUpperCase();

const cleanValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value).trim() || null;
};

const formatDate = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed) {
      throw new Error(`Invalid Excel date: ${value}`);
    }

    return [
      parsed.y,
      String(parsed.m).padStart(2, "0"),
      String(parsed.d).padStart(2, "0")
    ].join("-");
  }

  const text = String(value).trim();

  // yyyy-mm-dd or yyyy-mm-dd hh:mm:ss
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  // dd/mm/yyyy or dd-mm-yyyy
  const local = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (local) {
    const day = Number(local[1]);
    const month = Number(local[2]);
    const year = Number(local[3]);

    const check = new Date(year, month - 1, day);

    if (
      check.getFullYear() !== year ||
      check.getMonth() !== month - 1 ||
      check.getDate() !== day
    ) {
      throw new Error(`Invalid date: ${text}`);
    }

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  throw new Error(`Unsupported date format: ${text}`);
};

const readSalesWorkbook = (buffer) => {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true
  });

  if (!workbook.SheetNames.includes(SHEET_NAME)) {
    throw new Error(`Worksheet "${SHEET_NAME}" was not found.`);
  }

  const worksheet = workbook.Sheets[SHEET_NAME];

  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    raw: true
  });

  if (!rawRows.length) {
    throw new Error("The Sales Data worksheet is empty.");
  }

  const actualHeaders = Object.keys(rawRows[0]);

  const headerLookup = new Map(
    actualHeaders.map((header) => [
      normalizeHeader(header),
      header
    ])
  );

  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !headerLookup.has(normalizeHeader(header))
  );

  if (missingHeaders.length) {
    throw new Error(
      `Missing Excel columns: ${missingHeaders.join(", ")}`
    );
  }

  const getValue = (row, header) =>
    row[headerLookup.get(normalizeHeader(header))];

  const rows = [];
  let blankChassis = 0;
  let invalidDates = 0;

  for (let index = 0; index < rawRows.length; index++) {
    const row = rawRows[index];

    const chassisNo = normalizeChassis(
      getValue(row, "Chassis_No")
    );

    if (!chassisNo) {
      blankChassis++;
      continue;
    }

    let deliveryDate = null;

    try {
      deliveryDate = formatDate(
        getValue(row, "Delivery_Date")
      );
    } catch (error) {
      invalidDates++;
      continue;
    }

    rows.push({
      delivery_date: deliveryDate,
      chassis_no: chassisNo,
      sale_branch: cleanValue(getValue(row, "Sale Branch")),
      model_group: cleanValue(getValue(row, "Model_Group")),
      cust_name: cleanValue(getValue(row, "Cust Name")),
      postal_code: cleanValue(getValue(row, "PostalCode")),
      mobile_no: cleanValue(getValue(row, "Mobile no")),
      segment: cleanValue(getValue(row, "Segment"))
    });
  }

  // Keep the last occurrence of each chassis number.
  const uniqueRows = new Map();
  let duplicateRows = 0;

  for (const row of rows) {
    if (uniqueRows.has(row.chassis_no)) {
      duplicateRows++;
    }

    uniqueRows.set(row.chassis_no, row);
  }

  return {
    totalRows: rawRows.length,
    rows: [...uniqueRows.values()],
    blankChassis,
    invalidDates,
    duplicateRows,
    headers: actualHeaders
  };
};

// POST /api/sales-excel/preview
const previewSalesExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select an Excel file."
      });
    }

    const result = readSalesWorkbook(req.file.buffer);

    return res.json({
      success: true,
      worksheet: SHEET_NAME,
      totalRows: result.totalRows,
      validRows: result.rows.length,
      blankChassis: result.blankChassis,
      invalidDates: result.invalidDates,
      duplicateRows: result.duplicateRows,
      headers: result.headers,
      preview: result.rows.slice(0, 10)
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// POST /api/sales-excel/import
const importSalesExcel = async (req, res) => {
  let connection;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select an Excel file."
      });
    }

    const result = readSalesWorkbook(req.file.buffer);

    if (!result.rows.length) {
      return res.status(400).json({
        success: false,
        message: "No valid sales rows found."
      });
    }

    connection = await pool.getConnection();

    const report = {
      totalRows: result.totalRows,
      validRows: result.rows.length,
      inserted: 0,
      updated: 0,
      blankChassis: result.blankChassis,
      invalidDates: result.invalidDates,
      duplicateRows: result.duplicateRows,
      batchesCompleted: 0
    };

    for (
      let start = 0;
      start < result.rows.length;
      start += BATCH_SIZE
    ) {
      const batch = result.rows.slice(
        start,
        start + BATCH_SIZE
      );

      const chassisNumbers = batch.map(
        (row) => row.chassis_no
      );

      await connection.beginTransaction();

      try {
        // Identify existing chassis numbers before the upsert.
        const [existingRows] = await connection.query(
          `SELECT chassis_no
           FROM sales_data_combined
           WHERE chassis_no IN (?)`,
          [chassisNumbers]
        );

        const existingSet = new Set(
          existingRows.map((row) =>
            normalizeChassis(row.chassis_no)
          )
        );

        const values = batch.map((row) => [
          row.delivery_date,
          row.chassis_no,
          row.sale_branch,
          row.model_group,
          row.cust_name,
          row.postal_code,
          row.mobile_no,
          row.segment
        ]);

        await connection.query(
          `INSERT INTO sales_data_combined (
            delivery_date,
            chassis_no,
            sale_branch,
            model_group,
            cust_name,
            postal_code,
            mobile_no,
            segment
          )
          VALUES ?
          ON DUPLICATE KEY UPDATE
            delivery_date = VALUES(delivery_date),
            sale_branch = VALUES(sale_branch),
            model_group = VALUES(model_group),
            cust_name = VALUES(cust_name),
            postal_code = VALUES(postal_code),
            mobile_no = VALUES(mobile_no),
            segment = VALUES(segment)`,
          [values]
        );

        await connection.commit();

        const updatedCount = batch.filter((row) =>
          existingSet.has(row.chassis_no)
        ).length;

        report.updated += updatedCount;
        report.inserted += batch.length - updatedCount;
        report.batchesCompleted++;
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }

    // Update Chassis Master after all Sales Excel batches are committed
    let chassisMasterSync = null;

    try {
      console.log("[SALES EXCEL] Updating Chassis Master...");

      chassisMasterSync = await syncChassisMaster();

      console.log("[SALES EXCEL] Chassis Master sync completed.");
    } catch (syncError) {
      console.error(
        "[SALES EXCEL] Chassis Master sync failed:",
        syncError.message
      );

      chassisMasterSync = {
        success: false,
        message: syncError.message
      };
    }

    return res.json({
      success: true,
      message: "Sales Excel import completed successfully.",
      report: {
        ...report,
        importMode: "UPSERT",
        existingRecordsDeleted: false,
        chassisMasterSync
      }
    });
  } catch (error) {
    console.error("Sales Excel import error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Sales Excel import failed."
    });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  previewSalesExcel,
  importSalesExcel
};
