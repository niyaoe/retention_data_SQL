
const { pool } = require("../config/db");

const checkImportReadiness = async () => {
  const [sales] = await pool.query(`
    SELECT
      COUNT(*) AS totalSales,
      COUNT(DISTINCT UPPER(TRIM(chassis_no))) AS uniqueChassis
    FROM sales_data_combined
    WHERE chassis_no IS NOT NULL
      AND TRIM(chassis_no) != ''
  `);

  const [service] = await pool.query(`
    SELECT
      COUNT(*) AS totalServiceRecords,
      COUNT(DISTINCT UPPER(TRIM(chassis_number))) AS uniqueServiceChassis
    FROM ro_master_combined
    WHERE chassis_number IS NOT NULL
      AND TRIM(chassis_number) != ''
  `);

  const [history] = await pool.query(`
    SELECT
      COUNT(*) AS chassisWithServices,
      COALESCE(SUM(serviceCount), 0) AS matchedServiceRecords,
      COALESCE(MAX(serviceCount), 0) AS maxServicesPerChassis,
      COALESCE(ROUND(AVG(serviceCount), 2), 0) AS avgServicesPerChassis
    FROM (
      SELECT
        UPPER(TRIM(r.chassis_number)) AS chassis,
        COUNT(*) AS serviceCount
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
      GROUP BY UPPER(TRIM(r.chassis_number))
    ) grouped
  `);

  return {
    sales: sales[0],
    service: service[0],
    history: history[0]
  };
};

module.exports = { checkImportReadiness };
