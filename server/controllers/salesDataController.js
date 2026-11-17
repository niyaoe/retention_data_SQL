
const { pool } = require("../config/db");

const getSalesData = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 25)
    );

    const offset = (page - 1) * limit;

    const [countResult] = await pool.query(
      "SELECT COUNT(*) AS total FROM sales_data_combined"
    );

    const [records] = await pool.query(
      `SELECT *
       FROM sales_data_combined
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
    console.error("Sales Data Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales data"
    });
  }
};

module.exports = { getSalesData };
