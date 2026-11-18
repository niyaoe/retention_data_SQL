
const { pool } = require("../config/db");

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
      `SELECT
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
        created_at
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

module.exports = { getServiceData };
