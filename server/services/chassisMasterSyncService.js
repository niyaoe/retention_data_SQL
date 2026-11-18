
const { pool } = require("../config/db");

const LOCK_NAME = "retention_chassis_master_sync";

// ========================================
// SYNC CHASSIS MASTER
// ========================================

const syncChassisMaster = async () => {
    let connection;
    let lockAcquired = false;

    try {
        connection = await pool.getConnection();

        // Prevent simultaneous master syncs
        const [lockRows] = await connection.query(
            "SELECT GET_LOCK(?, 0) AS acquired",
            [LOCK_NAME]
        );

        lockAcquired = Number(lockRows[0]?.acquired) === 1;

        if (!lockAcquired) {
            console.log(
                "[Chassis Master] Another sync is running. Skipping."
            );

            return {
                success: false,
                skipped: true,
                message: "Another chassis master sync is running",
            };
        }

        console.log("[Chassis Master] Sync started...");

        const [result] = await connection.query(`
            INSERT INTO chassis_master (
                chassis_no,
                sales_data_id,
                service_count
            )

            SELECT
                combined.chassis_no,
                MAX(combined.sales_data_id) AS sales_data_id,
                COALESCE(MAX(service_counts.service_count), 0)
                    AS service_count

            FROM (
                SELECT
                    UPPER(TRIM(chassis_no)) AS chassis_no,
                    id AS sales_data_id

                FROM sales_data_combined

                WHERE chassis_no IS NOT NULL
                  AND TRIM(chassis_no) <> ''

                UNION ALL

                SELECT
                    UPPER(TRIM(chassis_number)) AS chassis_no,
                    NULL AS sales_data_id

                FROM ro_master_combined

                WHERE chassis_number IS NOT NULL
                  AND TRIM(chassis_number) <> ''

            ) AS combined

            LEFT JOIN (
                SELECT
                    UPPER(TRIM(chassis_number)) AS chassis_no,
                    COUNT(*) AS service_count

                FROM ro_master_combined

                WHERE chassis_number IS NOT NULL
                  AND TRIM(chassis_number) <> ''

                GROUP BY UPPER(TRIM(chassis_number))

            ) AS service_counts

                ON service_counts.chassis_no = combined.chassis_no

            GROUP BY combined.chassis_no

            ON DUPLICATE KEY UPDATE
                sales_data_id = VALUES(sales_data_id),
                service_count = VALUES(service_count)
        `);

        console.log(
            `[Chassis Master] Sync completed. Affected rows: ${result.affectedRows}`
        );

        return {
            success: true,
            affectedRows: result.affectedRows,
        };

    } catch (error) {
        console.error("[Chassis Master] Sync failed:", error);
        throw error;

    } finally {
        if (connection) {
            try {
                if (lockAcquired) {
                    await connection.query(
                        "SELECT RELEASE_LOCK(?)",
                        [LOCK_NAME]
                    );
                }
            } catch (lockError) {
                console.error(
                    "[Chassis Master] Lock release error:",
                    lockError
                );
            }

            connection.release();
        }
    }
};

module.exports = {
    syncChassisMaster,
};
