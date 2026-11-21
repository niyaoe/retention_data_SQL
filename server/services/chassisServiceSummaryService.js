
const { pool } = require("../config/db");

const BATCH_SIZE = 100;

function normalizeChassis(value) {
    return String(value ?? "").trim().toUpperCase();
}

// Collect old and new chassis numbers before an RO upsert.
// Map key = normalized chassis number
// Map value = original chassis values stored in MySQL
async function captureAffectedChassis(connection, records) {
    const affected = new Map();

    const addChassis = (value) => {
        if (!value) return;

        const raw = String(value).trim();
        const normalized = normalizeChassis(raw);

        if (!normalized) return;

        if (!affected.has(normalized)) {
            affected.set(normalized, new Set());
        }

        affected.get(normalized).add(raw);
    };

    const roNumbers = [
        ...new Set(
            records
                .map((record) => record.roNumber)
                .filter(Boolean)
        ),
    ];

    // Capture old chassis numbers before the UPSERT.
    for (let i = 0; i < roNumbers.length; i += 500) {
        const batch = roNumbers.slice(i, i + 500);
        const placeholders = batch.map(() => "?").join(",");

        const [rows] = await connection.query(
            `
                SELECT chassis_number
                FROM ro_master_combined
                WHERE repair_order_number IN (${placeholders})
                  AND chassis_number IS NOT NULL
                  AND TRIM(chassis_number) <> ''
            `,
            batch
        );

        rows.forEach((row) => addChassis(row.chassis_number));
    }

    // Capture new chassis numbers from incoming records.
    records.forEach((record) => addChassis(record.chassisNumber));

    return affected;
}

async function refreshChassisServiceSummary(
    affected,
    connection = null
) {
    if (!affected || affected.size === 0) {
        return {
            success: true,
            affectedChassis: 0,
            updatedRows: 0,
        };
    }

    let ownConnection = false;

    try {
        if (!connection) {
            connection = await pool.getConnection();
            ownConnection = true;
        }

        const entries = Array.from(affected.entries());

        let updatedRows = 0;

        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
            const batch = entries.slice(i, i + BATCH_SIZE);

            const rawValues = [
                ...new Set(
                    batch.flatMap(([, values]) => [...values])
                ),
            ];

            if (!rawValues.length) continue;

            const placeholders = rawValues.map(() => "?").join(",");

            // Latest service of any category.
            const [latestRows] = await connection.query(
                `
                    SELECT
                        normalized_chassis,
                        id,
                        dealer_branch_id
                    FROM (
                        SELECT
                            UPPER(TRIM(chassis_number))
                                AS normalized_chassis,
                            id,
                            dealer_branch_id,

                            ROW_NUMBER() OVER (
                                PARTITION BY UPPER(TRIM(chassis_number))
                                ORDER BY bill_date DESC, id DESC
                            ) AS rn

                        FROM ro_master_combined

                        WHERE chassis_number IN (${placeholders})
                    ) ranked
                    WHERE rn = 1
                `,
                rawValues
            );

            // Latest Free/Paid service.
            const [freePaidRows] = await connection.query(
                `
                    SELECT
                        normalized_chassis,
                        id,
                        bill_date
                    FROM (
                        SELECT
                            UPPER(TRIM(chassis_number))
                                AS normalized_chassis,
                            id,
                            bill_date,

                            ROW_NUMBER() OVER (
                                PARTITION BY UPPER(TRIM(chassis_number))
                                ORDER BY bill_date DESC, id DESC
                            ) AS rn

                        FROM ro_master_combined

                        WHERE chassis_number IN (${placeholders})
                          AND service_category IN (
                              'Free Service',
                              'Paid Service'
                          )
                    ) ranked
                    WHERE rn = 1
                `,
                rawValues
            );

            const latestMap = new Map();
            const freePaidMap = new Map();

            latestRows.forEach((row) => {
                latestMap.set(row.normalized_chassis, row);
            });

            freePaidRows.forEach((row) => {
                freePaidMap.set(row.normalized_chassis, row);
            });

            const values = batch.map(([chassisNumber]) => {
                const latest = latestMap.get(chassisNumber);
                const freePaid = freePaidMap.get(chassisNumber);

                return [
                    chassisNumber,
                    latest?.id ?? null,
                    latest?.dealer_branch_id ?? null,
                    freePaid?.id ?? null,
                    freePaid?.bill_date ?? null,
                ];
            });

            await connection.query(
                `
                    INSERT INTO chassis_service_summary (
                        chassis_number,
                        latest_service_id,
                        latest_service_branch_id,
                        latest_free_paid_id,
                        latest_free_paid_bill_date
                    )
                    VALUES ?
                    ON DUPLICATE KEY UPDATE
                        latest_service_id =
                            VALUES(latest_service_id),
                        latest_service_branch_id =
                            VALUES(latest_service_branch_id),
                        latest_free_paid_id =
                            VALUES(latest_free_paid_id),
                        latest_free_paid_bill_date =
                            VALUES(latest_free_paid_bill_date)
                `,
                [values]
            );

            updatedRows += values.length;
        }

        return {
            success: true,
            affectedChassis: entries.length,
            updatedRows,
        };
    } finally {
        if (ownConnection && connection) {
            connection.release();
        }
    }
}

module.exports = {
    captureAffectedChassis,
    refreshChassisServiceSummary,
};
