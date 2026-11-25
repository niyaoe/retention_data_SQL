
const { pool } = require("../config/db");

const BATCH_SIZE = 2000;

const SERVICE_COLUMNS = `
  id,
  bill_date,
  dealer_location,
  repair_order_number,
  ro_date,
  registration_number,
  chassis_number,
  pincode,
  service_category,
  service_type,
  ro_service_advisor,
  product_name,
  segment,
  created_at
`;

const getServiceData = async (req, res) => {
  try {
    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 25)
    );

    const offset = (page - 1) * limit;

    const [countResult] = await pool.query(
      "SELECT COUNT(*) AS total FROM ro_master_combined"
    );

    const [records] = await pool.query(
      `SELECT ${SERVICE_COLUMNS}
       FROM ro_master_combined
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const total = Number(countResult[0].total);

    res.json({
      success: true,
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Service Data Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch service data"
    });
  }
};

// Fetch records in batches using the ID cursor
const fetchBatch = async (lastId) => {
  const [records] = await pool.query(
    `SELECT ${SERVICE_COLUMNS}
     FROM ro_master_combined
     WHERE id > ?
     ORDER BY id ASC
     LIMIT ?`,
    [lastId, BATCH_SIZE]
  );

  return records;
};

// Handle response backpressure
const writeChunk = async (res, chunk) => {
  if (res.destroyed) {
    throw new Error("Client disconnected");
  }

  if (!res.write(chunk)) {
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        res.removeListener("drain", onDrain);
        res.removeListener("close", onClose);
      };

      const onDrain = () => {
        cleanup();
        resolve();
      };

      const onClose = () => {
        cleanup();
        reject(new Error("Client disconnected"));
      };

      res.once("drain", onDrain);
      res.once("close", onClose);
    });
  }
};

// Public JSON export
const exportServiceData = async (req, res) => {
  try {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="service-data.json"'
    );

    await writeChunk(res, '{"success":true,"records":[');

    let lastId = 0;
    let firstRecord = true;

    while (true) {
      const records = await fetchBatch(lastId);

      if (!records.length) break;

      const json = records.map((record) => {
        lastId = record.id;
        return JSON.stringify(record);
      });

      const chunk =
        (firstRecord ? "" : ",") + json.join(",");

      await writeChunk(res, chunk);

      firstRecord = false;
    }

    await writeChunk(res, "]}");
    res.end();

  } catch (error) {
    console.error("JSON Export Error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to export service data"
      });
    } else if (!res.destroyed) {
      res.destroy(error);
    }
  }
};

// CSV escaping
const csvEscape = (value) => {
  if (value === null || value === undefined) return "";

  let text = String(value);

  // Protect Excel against CSV formula injection
  if (/^[\s]*[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return `"${text.replace(/"/g, '""')}"`;
};

// Public CSV export for Excel
const exportServiceDataCSV = async (req, res) => {
  try {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="service-data.csv"'
    );

    // UTF-8 BOM for Excel compatibility
    await writeChunk(res, "\uFEFF");

    const columns = [
      "id",
      "bill_date",
      "dealer_location",
      "repair_order_number",
      "ro_date",
      "registration_number",
      "chassis_number",
      "pincode",
      "service_category",
      "service_type",
      "ro_service_advisor",
      "product_name",
      "segment",
      "created_at"
    ];

    await writeChunk(
      res,
      columns.map(csvEscape).join(",") + "\r\n"
    );

    let lastId = 0;

    while (true) {
      const records = await fetchBatch(lastId);

      if (!records.length) break;

      const csv = records.map((record) => {
        lastId = record.id;

        return columns
          .map((column) => csvEscape(record[column]))
          .join(",");
      }).join("\r\n");

      await writeChunk(res, csv + "\r\n");
    }

    res.end();

  } catch (error) {
    console.error("CSV Export Error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to export service data"
      });
    } else if (!res.destroyed) {
      res.destroy(error);
    }
  }
};

module.exports = {
  getServiceData,
  exportServiceData,
  exportServiceDataCSV
};
