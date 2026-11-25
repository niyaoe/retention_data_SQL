
const { pool } = require("../config/db");
const XLSX = require("xlsx");

const EXPECTED_HEADERS = [
  "Release year",
  "Release month",
  "Release Date",
  "RO Date",
  "Zone",
  "Regional Office",
  "Parent group",
  "Dealer name",
  "Dealer code",
  "Location name",
  "Location code",
  "Segment",
  "Model Family",
  "Model name",
  "Chassis",
  "Recall Type",
  "Service action type",
  "Complaint code",
  "Complaint description",
  "RO ID",
  "Attended Indicator",
  "Days",
  "Days bucket",
  "Universal count",
  "Complete count",
  "Complete count %",
  "Pending count",
  "Pending count %",
];

const DB_COLUMNS = [
  "release_year",
  "release_month",
  "release_date",
  "ro_date",
  "zone",
  "regional_office",
  "parent_group",
  "dealer_name",
  "dealer_code",
  "location_name",
  "location_code",
  "segment",
  "model_family",
  "model_name",
  "chassis",
  "recall_type",
  "service_action_type",
  "complaint_code",
  "complaint_description",
  "ro_id",
  "attended_indicator",
  "days",
  "days_bucket",
  "universal_count",
  "complete_count",
  "complete_count_percent",
  "pending_count",
  "pending_count_percent",
];

const DATE_COLUMNS = new Set(["release_date", "ro_date"]);

const NUMBER_COLUMNS = new Set([
  "release_year",
  "days",
  "universal_count",
  "complete_count",
  "complete_count_percent",
  "pending_count",
  "pending_count_percent",
]);

const isAdmin = (req, res) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({
      success: false,
      message: "Admin access required",
    });
    return false;
  }

  return true;
};

const cleanValue = (value) => {
  if (value === undefined || value === null) return null;

  if (typeof value === "string") {
    const cleaned = value.trim();
    return cleaned === "" ? null : cleaned;
  }

  return value;
};

const excelDateToMySQL = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  let date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed) return null;

    date = new Date(
      Date.UTC(parsed.y, parsed.m - 1, parsed.d)
    );
  } else {
    const text = String(value).trim();

    if (!text) return null;

    // Handles common Excel date formats.
    const match = text.match(
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
    );

    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    date = new Date(text);
  }

  if (Number.isNaN(date.getTime())) return null;

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string") {
    value = value.replace(/,/g, "").replace(/%/g, "").trim();
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const prepareValue = (column, value) => {
  value = cleanValue(value);

  if (value === null) return null;

  if (DATE_COLUMNS.has(column)) {
    return excelDateToMySQL(value);
  }

  if (NUMBER_COLUMNS.has(column)) {
    return toNumber(value);
  }

  return String(value);
};

// GET SERVICE ACTION RECORDS
const getServiceAction = async (req, res) => {
  try {
    const page = Math.max(
      1,
      parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 25)
    );

    const offset = (page - 1) * limit;
    const search = String(req.query.search || "").trim();

    let where = "";
    let params = [];

    if (search) {
      where = `
        WHERE
          chassis LIKE ?
          OR dealer_name LIKE ?
          OR dealer_code LIKE ?
          OR location_name LIKE ?
          OR complaint_code LIKE ?
          OR complaint_description LIKE ?
          OR ro_id LIKE ?
          OR model_name LIKE ?
      `;

      const searchValue = `%${search}%`;
      params = Array(8).fill(searchValue);
    }

    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM service_action
       ${where}`,
      params
    );

    const [records] = await pool.query(
      `SELECT *
       FROM service_action
       ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const total = Number(countResult[0].total);

    res.json({
      success: true,
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Service Action Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch Service Action records",
    });
  }
};

// FULL EXCEL REPLACEMENT
const importServiceAction = async (req, res) => {
  if (!isAdmin(req, res)) return;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Please select an Excel file",
    });
  }

  let connection;

  try {
    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) {
      return res.status(400).json({
        success: false,
        message: "Excel worksheet not found",
      });
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });

    if (rows.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Excel file contains no data",
      });
    }

    const headers = rows[0].map((value) =>
      String(value ?? "").trim()
    );

    const missingHeaders = EXPECTED_HEADERS.filter(
      (header) => !headers.includes(header)
    );

    if (missingHeaders.length) {
      return res.status(400).json({
        success: false,
        message: "Excel columns do not match the expected format",
        missingHeaders,
      });
    }

    const headerIndexes = EXPECTED_HEADERS.map(
      (header) => headers.indexOf(header)
    );

    let yesCount = 0;
    let noCount = 0;
    let blankCount = 0;

    const preparedRecords = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      if (!row || row.every((value) => value === null || value === "")) {
        continue;
      }

      const attendedIndex = headerIndexes[20];

      const attended = String(
        row[attendedIndex] ?? ""
      ).trim().toUpperCase();

      if (attended === "YES") {
        yesCount++;
        continue;
      }

      if (attended !== "NO") {
        blankCount++;
        continue;
      }

      noCount++;

      const record = DB_COLUMNS.map((column, index) => {
        const excelValue = row[headerIndexes[index]];
        return prepareValue(column, excelValue);
      });

      preparedRecords.push(record);
    }

    if (preparedRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No records with Attended Indicator = NO were found",
        yesCount,
        blankCount,
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Delete existing records inside the transaction.
    await connection.query("DELETE FROM service_action");

    const columnSQL = DB_COLUMNS.map(
      (column) => `\`${column}\``
    ).join(", ");

    const chunkSize = 500;
    let insertedCount = 0;

    for (
      let start = 0;
      start < preparedRecords.length;
      start += chunkSize
    ) {
      const chunk = preparedRecords.slice(
        start,
        start + chunkSize
      );

      const placeholders = chunk
        .map(() => `(${DB_COLUMNS.map(() => "?").join(", ")})`)
        .join(", ");

      const values = chunk.flat();

      await connection.query(
        `INSERT INTO service_action (${columnSQL})
         VALUES ${placeholders}`,
        values
      );

      insertedCount += chunk.length;
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Service Action data replaced successfully",
      summary: {
        totalExcelRows: rows.length - 1,
        yesCount,
        noCount,
        blankCount,
        insertedCount,
        replaced: true,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Service Action Import Error:", error);

    res.status(500).json({
      success: false,
      message: "Service Action import failed. Existing records were preserved.",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getServiceAction,
  importServiceAction,
};
