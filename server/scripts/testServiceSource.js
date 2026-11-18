const { pool } = require("../config/db");

async function test() {
    try {
        const [rows] = await pool.query(`
            SELECT COUNT(*) AS total_records
            FROM eramsale_service_report.ro_billed_gst
        `);

        console.log("Source database connection successful!");
        console.log("Total source records:", rows[0].total_records);
    } catch (error) {
        console.error("Source database access failed:", error.message);
    } finally {
        await pool.end();
    }
}

test();