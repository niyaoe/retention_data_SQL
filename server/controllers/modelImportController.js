
const XLSX = require("xlsx");
const { pool } = require("../config/db");

const SHEET_NAME = "Model_Segment";
const BATCH_SIZE = 100;

const normalizeHeader = (value) =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const importModels = async (req, res) => {
  let connection;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an Excel file."
      });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer"
    });

    const worksheet = workbook.Sheets[SHEET_NAME];

    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: `Worksheet "${SHEET_NAME}" not found.`
      });
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
      raw: false
    });

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "The worksheet contains no model records."
      });
    }

    // Validate the three required headers
    const headers = Object.keys(rows[0]).map(normalizeHeader);

    const requiredHeaders = [
      "modelgroup",
      "segment",
      "subsegment"
    ];

    const missingHeaders = requiredHeaders.filter(
      (header) => !headers.includes(header)
    );

    if (missingHeaders.length) {
      return res.status(400).json({
        success: false,
        message: "Required Excel columns are missing.",
        missingHeaders
      });
    }

    // Normalize and validate records
    const modelMap = new Map();
    let blankModelRows = 0;
    let blankSegmentRows = 0;
    let duplicateRows = 0;

    for (const row of rows) {
      const normalizedRow = {};

      for (const [key, value] of Object.entries(row)) {
        normalizedRow[normalizeHeader(key)] = String(value || "").trim();
      }

      const modelGroup = normalizedRow.modelgroup;
      const segment = normalizedRow.segment;
      const subSegment = normalizedRow.subsegment || null;

      if (!modelGroup) {
        blankModelRows++;
        continue;
      }

      if (!segment) {
        blankSegmentRows++;
        continue;
      }

      const key = modelGroup.toUpperCase();

      if (modelMap.has(key)) {
        duplicateRows++;
      }

      // Last occurrence wins for duplicate model names
      modelMap.set(key, {
        model_group: modelGroup,
        segment,
        sub_segment: subSegment
      });
    }

    const models = Array.from(modelMap.values());

    if (!models.length) {
      return res.status(400).json({
        success: false,
        message: "No valid model records found."
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    let inserted = 0;
    let updated = 0;

    // Process batches inside one transaction
    for (let i = 0; i < models.length; i += BATCH_SIZE) {
      const batch = models.slice(i, i + BATCH_SIZE);

      const modelNames = batch.map(
        (model) => model.model_group
      );

      const [existingRows] = await connection.query(
        `SELECT model_group
         FROM model_master
         WHERE model_group IN (?)`,
        [modelNames]
      );

      const existingSet = new Set(
        existingRows.map(
          (row) => row.model_group.toUpperCase()
        )
      );

      for (const model of batch) {
        if (existingSet.has(model.model_group.toUpperCase())) {
          updated++;
        } else {
          inserted++;
        }
      }

      const values = batch.map((model) => [
        model.model_group,
        model.segment,
        model.sub_segment
      ]);

      await connection.query(
        `INSERT INTO model_master
          (model_group, segment, sub_segment)
         VALUES ?
         ON DUPLICATE KEY UPDATE
          segment = VALUES(segment),
          sub_segment = VALUES(sub_segment)`,
        [values]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Model Excel import completed successfully.",
      report: {
        totalRows: rows.length,
        validModels: models.length,
        inserted,
        updated,
        duplicateRows,
        blankModelRows,
        blankSegmentRows,
        batchesCompleted: Math.ceil(models.length / BATCH_SIZE)
      }
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Model Excel import error:", error);

    res.status(500).json({
      success: false,
      message: "Model Excel import failed.",
      error: error.message
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  importModels
};
