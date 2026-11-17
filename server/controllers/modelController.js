
const { pool } = require("../config/db");

// GET /api/models
const getModels = async (req, res) => {
  try {
    const { search = "", status = "all" } = req.query;

    let sql = `
      SELECT
        id,
        model_group,
        segment,
        sub_segment,
        is_active,
        created_at,
        updated_at
      FROM model_master
      WHERE 1 = 1
    `;

    const params = [];

    if (search.trim()) {
      sql += `
        AND (
          model_group LIKE ?
          OR segment LIKE ?
          OR sub_segment LIKE ?
        )
      `;

      const keyword = `%${search.trim()}%`;
      params.push(keyword, keyword, keyword);
    }

    if (status === "active") {
      sql += " AND is_active = 1";
    } else if (status === "inactive") {
      sql += " AND is_active = 0";
    }

    sql += " ORDER BY model_group ASC";

    const [models] = await pool.query(sql, params);

    res.json({
      success: true,
      total: models.length,
      models
    });
  } catch (error) {
    console.error("Get models error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch models."
    });
  }
};

// POST /api/models
const createModel = async (req, res) => {
  try {
    const {
      model_group,
      segment,
      sub_segment
    } = req.body;

    if (!model_group?.trim() || !segment?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Model Group and Segment are required."
      });
    }

    const model = model_group.trim().toUpperCase();
    const modelSegment = segment.trim();
    const subSegment = sub_segment?.trim() || null;

    const [result] = await pool.query(
      `INSERT INTO model_master
       (model_group, segment, sub_segment)
       VALUES (?, ?, ?)`,
      [model, modelSegment, subSegment]
    );

    const [rows] = await pool.query(
      "SELECT * FROM model_master WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: "Model created successfully.",
      model: rows[0]
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "This model already exists."
      });
    }

    console.error("Create model error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create model."
    });
  }
};

// PUT /api/models/:id
const updateModel = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      model_group,
      segment,
      sub_segment
    } = req.body;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid model ID."
      });
    }

    if (!model_group?.trim() || !segment?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Model Group and Segment are required."
      });
    }

    const [result] = await pool.query(
      `UPDATE model_master
       SET model_group = ?,
           segment = ?,
           sub_segment = ?
       WHERE id = ?`,
      [
        model_group.trim().toUpperCase(),
        segment.trim(),
        sub_segment?.trim() || null,
        Number(id)
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Model not found."
      });
    }

    const [rows] = await pool.query(
      "SELECT * FROM model_master WHERE id = ?",
      [Number(id)]
    );

    res.json({
      success: true,
      message: "Model updated successfully.",
      model: rows[0]
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Another model already uses this Model Group."
      });
    }

    console.error("Update model error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update model."
    });
  }
};

// PATCH /api/models/:id/status
const toggleModelStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid model ID."
      });
    }

    const [result] = await pool.query(
      `UPDATE model_master
       SET is_active = IF(is_active = 1, 0, 1)
       WHERE id = ?`,
      [Number(id)]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Model not found."
      });
    }

    const [rows] = await pool.query(
      "SELECT * FROM model_master WHERE id = ?",
      [Number(id)]
    );

    res.json({
      success: true,
      message: "Model status updated successfully.",
      model: rows[0]
    });
  } catch (error) {
    console.error("Toggle model status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update model status."
    });
  }
};

module.exports = {
  getModels,
  createModel,
  updateModel,
  toggleModelStatus
};
