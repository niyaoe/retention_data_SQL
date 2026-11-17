
const { pool } = require("../config/db");

const analyzeRetentionData = async () => {
  const [sales] = await pool.query(`
    SELECT
      COUNT(*) AS totalRecords,
      COUNT(DISTINCT UPPER(TRIM(chassis_no))) AS uniqueChassis
    FROM sales_data_combined
    WHERE chassis_no IS NOT NULL
      AND TRIM(chassis_no) != ''
  `);

  const [salesDuplicates] = await pool.query(`
    SELECT COUNT(*) AS duplicateChassisGroups
    FROM (
      SELECT UPPER(TRIM(chassis_no)) AS chassis
      FROM sales_data_combined
      WHERE chassis_no IS NOT NULL
        AND TRIM(chassis_no) != ''
      GROUP BY UPPER(TRIM(chassis_no))
      HAVING COUNT(*) > 1
    ) AS duplicates
  `);

  const [service] = await pool.query(`
    SELECT
      COUNT(*) AS totalRecords,
      COUNT(chassis_number) AS recordsWithChassis,
      COUNT(DISTINCT UPPER(TRIM(chassis_number))) AS uniqueChassis
    FROM ro_master_combined
    WHERE chassis_number IS NOT NULL
      AND TRIM(chassis_number) != ''
  `);

  const [matching] = await pool.query(`
    SELECT
      COUNT(*) AS matchedUniqueChassis,
      (
        SELECT COUNT(*)
        FROM ro_master_combined r
        INNER JOIN (
          SELECT DISTINCT UPPER(TRIM(chassis_no)) AS chassis
          FROM sales_data_combined
          WHERE chassis_no IS NOT NULL
            AND TRIM(chassis_no) != ''
        ) s
        ON UPPER(TRIM(r.chassis_number)) = s.chassis
        WHERE r.chassis_number IS NOT NULL
          AND TRIM(r.chassis_number) != ''
      ) AS matchedServiceRecords
    FROM (
      SELECT DISTINCT UPPER(TRIM(chassis_no)) AS chassis
      FROM sales_data_combined
      WHERE chassis_no IS NOT NULL
        AND TRIM(chassis_no) != ''
    ) s
    INNER JOIN (
      SELECT DISTINCT UPPER(TRIM(chassis_number)) AS chassis
      FROM ro_master_combined
      WHERE chassis_number IS NOT NULL
        AND TRIM(chassis_number) != ''
    ) r
    ON s.chassis = r.chassis
  `);

  return {
    sales: sales[0],
    salesDuplicates: salesDuplicates[0],
    service: service[0],
    matching: matching[0]
  };
};

module.exports = { analyzeRetentionData };
