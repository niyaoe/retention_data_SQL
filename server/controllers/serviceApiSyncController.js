
const { pool } = require("../config/db");

const SOURCE_TABLE =
    "eramsale_service_report.ro_billed_gst";

const BATCH_SIZE = 500;
const LOCK_NAME = "service_data_excel_upsert";

function clean(value) {
    if (value === null || value === undefined) return null;

    const text = String(value).trim();

    return !text || text === "-" ? null : text;
}

function normalizeRO(value) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, "")
        .toUpperCase();
}

function parseInvoiceDate(value) {
    if (!value) return null;

    const text = String(value).trim();

    // DD/MM/YYYY
    const match = text.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

    if (!match) return null;

    const [, day, month, year] = match;

    const date = new Date(
        Date.UTC(+year, +month - 1, +day)
    );

    if (
        date.getUTCFullYear() !== +year ||
        date.getUTCMonth() !== +month - 1 ||
        date.getUTCDate() !== +day
    ) {
        return null;
    }

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractPincode(address) {
    if (!address) return null;

    const match = String(address).match(/\b[1-9]\d{5}\b/);

    return match ? match[0] : null;
}

function getUploadedTime(value) {
    if (!value) return 0;

    const match = String(value).trim().match(
        /^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i
    );

    if (!match) return 0;

    let [, day, month, year, hour, minute, second, period] = match;

    hour = Number(hour);

    if (period.toUpperCase() === "PM" && hour !== 12) {
        hour += 12;
    }

    if (period.toUpperCase() === "AM" && hour === 12) {
        hour = 0;
    }

    return Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        hour,
        Number(minute),
        Number(second)
    );
}

function prepareServiceRecords(rows, totalSourceRows) {
    const report = {
        totalSourceRows,
        invoicedRows: rows.length,
        claimInvoiceRows: 0,
        preSalePdiRows: 0,
        blankRONumbers: 0,
        invalidInvoiceDates: 0,
        duplicateRows: 0,
        uniqueRows: 0,
        missingPincodes: 0,
    };

    const uniqueRecords = new Map();

    for (const row of rows) {
        // Exclude Claim Invoice
        if (
            String(row.invoice_type || "")
                .trim()
                .toLowerCase() === "claim invoice"
        ) {
            report.claimInvoiceRows++;
            continue;
        }

        // Exclude Pre-sale and PDI
        const category = String(row.service_category || "")
            .trim()
            .toLowerCase()
            .replace(/[\s_-]+/g, "");

        if (category === "presale" || category === "pdi") {
            report.preSalePdiRows++;
            continue;
        }

        const roNumber = clean(row.ro_number);
        const roKey = normalizeRO(roNumber);

        if (!roKey) {
            report.blankRONumbers++;
            continue;
        }

        const billDate = parseInvoiceDate(row.invoice_date);

        if (row.invoice_date && !billDate) {
            report.invalidInvoiceDates++;
        }

        const pincode = extractPincode(row.customer_address);

        if (!pincode) {
            report.missingPincodes++;
        }

        const record = {
            billDate,
            dealerLocation: clean(row.location_name),
            roNumber,
            roKey,
            registrationNumber: clean(row.registration_no),
            chassisNumber: clean(row.chassis_no),
            pincode,
            serviceCategory: clean(row.service_category),
            serviceType: clean(row.service_type),
            serviceAdvisor: clean(row.assigned_sa),

            // Vehicle model, e.g. BE 6, SCORPIO-N
            productName: clean(row.model_name),

            sourceId: Number(row.id) || 0,
            uploadedTime: getUploadedTime(row.uploaded_at),
        };

        const existing = uniqueRecords.get(roKey);

        if (!existing) {
            uniqueRecords.set(roKey, record);
            continue;
        }

        report.duplicateRows++;

        const existingDate = existing.billDate || "";
        const newDate = record.billDate || "";

        // Latest invoice date wins.
        // If dates match, latest upload time wins.
        // If upload times also match, highest source ID wins.
        const isNewer =
            newDate > existingDate ||
            (
                newDate === existingDate &&
                (
                    record.uploadedTime > existing.uploadedTime ||
                    (
                        record.uploadedTime === existing.uploadedTime &&
                        record.sourceId > existing.sourceId
                    )
                )
            );

        if (isNewer) {
            uniqueRecords.set(roKey, record);
        }
    }

    const records = Array.from(uniqueRecords.values());

    report.uniqueRows = records.length;

    return { records, report };
}

async function runServiceApiSync() {
    let connection;
    let lockAcquired = false;
    let transactionStarted = false;

    try {
        connection = await pool.getConnection();

        // Prevent Excel and database imports from overlapping
        const [lockRows] = await connection.query(
            "SELECT GET_LOCK(?, 0) AS acquired",
            [LOCK_NAME]
        );

        if (lockRows[0].acquired !== 1) {
            throw new Error(
                "Another Service Data Excel/MySQL import is already running."
            );
        }

        lockAcquired = true;

        console.log(
            "[SERVICE MYSQL SYNC] Reading source database..."
        );

        // Total source record count
        const [countRows] = await connection.query(`
            SELECT COUNT(*) AS total
            FROM ${SOURCE_TABLE}
        `);

        const totalSourceRows = Number(countRows[0].total);

        // Fetch only Invoiced records
        const [rows] = await connection.query(`
            SELECT
                id,
                ro_number,
                invoice_date,
                location_name,
                registration_no,
                chassis_no,
                customer_address,
                service_category,
                service_type,
                assigned_sa,
                model_name,
                invoice_type,
                status,
                uploaded_at
            FROM ${SOURCE_TABLE}
            WHERE LOWER(TRIM(COALESCE(status, ''))) = 'invoiced'
        `);

        console.log(
            `[SERVICE MYSQL SYNC] Source rows: ${totalSourceRows}, Invoiced rows: ${rows.length}`
        );

        const { records, report } = prepareServiceRecords(
            rows,
            totalSourceRows
        );

        if (!records.length) {
            return {
                ...report,
                submittedRows: 0,
                batchesCompleted: 0,
                message: "No eligible unique RO records found.",
            };
        }

        await connection.beginTransaction();
        transactionStarted = true;

        const insertSQL = `
            INSERT INTO ro_master_combined (
                bill_date,
                dealer_location,
                repair_order_number,
                registration_number,
                chassis_number,
                pincode,
                service_category,
                service_type,
                ro_service_advisor,
                product_name
            )
            VALUES ?
            ON DUPLICATE KEY UPDATE
                bill_date = VALUES(bill_date),
                dealer_location = VALUES(dealer_location),
                registration_number = VALUES(registration_number),
                chassis_number = VALUES(chassis_number),
                pincode = COALESCE(VALUES(pincode), pincode),
                service_category = VALUES(service_category),
                service_type = VALUES(service_type),
                ro_service_advisor = VALUES(ro_service_advisor),
                product_name = VALUES(product_name)
        `;

        let batchesCompleted = 0;
        let submittedRows = 0;

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);

            const values = batch.map((record) => [
                record.billDate,
                record.dealerLocation,
                record.roNumber,
                record.registrationNumber,
                record.chassisNumber,
                record.pincode,
                record.serviceCategory,
                record.serviceType,
                record.serviceAdvisor,
                record.productName,
            ]);

            await connection.query(insertSQL, [values]);

            batchesCompleted++;
            submittedRows += batch.length;
        }

        await connection.commit();
        transactionStarted = false;

        console.log(
            `[SERVICE MYSQL SYNC] Completed. Unique ROs: ${submittedRows}`
        );

        return {
            ...report,
            submittedRows,
            batchesCompleted,
            source: SOURCE_TABLE,
            importMode: "MYSQL UPSERT",
            existingRecordsDeleted: false,
        };
    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        throw error;
    } finally {
        if (connection && lockAcquired) {
            try {
                await connection.query(
                    "SELECT RELEASE_LOCK(?)",
                    [LOCK_NAME]
                );
            } catch (error) {
                console.error(
                    "[SERVICE MYSQL SYNC] Lock release error:",
                    error
                );
            }
        }

        if (connection) {
            connection.release();
        }
    }
}

exports.runServiceApiSync = runServiceApiSync;

exports.syncServiceFromAPI = async (req, res) => {
    try {
        const report = await runServiceApiSync();

        return res.status(200).json({
            success: true,
            message: "Service MySQL UPSERT completed successfully.",
            report,
        });
    } catch (error) {
        console.error("[SERVICE MYSQL SYNC ERROR]", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Service MySQL sync failed.",
            existingDataPreserved: true,
        });
    }
};
