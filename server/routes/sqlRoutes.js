
const express = require("express");
const router = express.Router();

const { pool } = require("../config/db");

router.get("/structure", async (req, res) => {
  try {
    const tables = [
      "sales_data_combined",
      "ro_master_combined"
    ];

    const results = {};

    for (const table of tables) {
      const [columns] = await pool.execute(
        `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [process.env.MYSQL_DATABASE, table]
      );

      const [count] = await pool.query(
        `SELECT COUNT(*) AS total FROM \`${table}\``
      );

      results[table] = {
        totalRecords: count[0].total,
        columns
      };
    }

    res.json({
      success: true,
      tables: results
    });

  } catch (error) {
    console.error("SQL inspection error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to inspect SQL tables"
    });
  }
});

module.exports = router;
