
const XLSX = require("xlsx");
const { pool } = require("../config/db");
const { syncChassisMaster } = require("../services/chassisMasterSyncService");
const {
    loadDealerBranchMap,
    getDealerBranchId,
} = require("../services/dealerBranchMappingService");

const {
    captureAffectedChassis,
    refreshChassisServiceSummary,
} = require("../services/chassisServiceSummaryService");

const REQUIRED_HEADERS = [
    "invoice_date",
    "location_name",
    "ro_number",
    "registration_no",
    "chassis_no",
    "service_category",
    "service_type",
    "assigned_sa",
    "model_name",
];

const BATCH_SIZE = 1000;

function parseDate(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    if (value instanceof Date && !isNaN(value.getTime())) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    // Excel serial date
    if (typeof value === "number") {
        const date = XLSX.SSF.parse_date_code(value);

        if (!date) return null;

        return `${date.y}-${String(date.m).padStart(2, "0")}-${String(
            date.d
        ).padStart(2, "0")}`;
    }

    const text = String(value).trim();
    if (!text) return null;

    // YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
    let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

    if (match) {
        const [, year, month, day] = match;
        return validateDate(+year, +month, +day);
    }

    // DD/MM/YYYY or DD-MM-YYYY
    match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

    if (match) {
        const [, day, month, year] = match;
        return validateDate(+year, +month, +day);
    }

    return null;
}

function validateDate(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
    )}`;
}

function clean(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    return String(value).trim() || null;
}

function normalizeRO(value) {
    return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function readServiceWorkbook(buffer) {
    const workbook = XLSX.read(buffer, {
        type: "buffer",
        cellDates: true,
    });

    const sheet = workbook.Sheets["Service Data"];

    if (!sheet) {
        throw new Error('Excel sheet "Service Data" was not found.');
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: true,
    });

    if (!rows.length) {
        throw new Error("The Service Data sheet is empty.");
    }

    const actualHeaders = Object.keys(rows[0]).map((header) =>
        header.trim().toLowerCase()
    );

    const missingHeaders = REQUIRED_HEADERS.filter(
        (header) => !actualHeaders.includes(header)
    );

    if (missingHeaders.length) {
        throw new Error(
            `Missing Excel columns: ${missingHeaders.join(", ")}`
        );
    }

    return rows;
}

function prepareServiceRows(rows) {
    const report = {
        totalRows: rows.length,
        validRows: 0,
        blankRONumbers: 0,
        duplicateRows: 0,
        duplicateRONumbers: [],
        invalidInvoiceDates: 0,
    };

    const uniqueRecords = new Map();

    rows.forEach((row, index) => {
        const roNumber = clean(row.ro_number);
        const roKey = normalizeRO(roNumber);

        if (!roKey) {
            report.blankRONumbers++;
            return;
        }

        const billDate = parseDate(row.invoice_date);

        if (row.invoice_date && !billDate) {
            report.invalidInvoiceDates++;
        }

        const record = {
            billDate,
            dealerLocation: clean(row.location_name),
            roNumber,
            roKey,
            roDate: null,
            registrationNumber: clean(row.registration_no),
            chassisNumber: clean(row.chassis_no),
            serviceCategory: clean(row.service_category),
            serviceType: clean(row.service_type),
            serviceAdvisor: clean(row.assigned_sa),
            productName: clean(row.model_name),
            excelRow: index + 2,
        };

        const existing = uniqueRecords.get(roKey);

        if (!existing) {
            uniqueRecords.set(roKey, record);
            return;
        }

        report.duplicateRows++;

        if (!report.duplicateRONumbers.includes(roNumber)) {
            report.duplicateRONumbers.push(roNumber);
        }

        // Latest invoice date wins.
        // If dates are equal or both are blank, the later Excel row wins.
        const existingDate = existing.billDate || "";
        const newDate = record.billDate || "";

        if (
            newDate > existingDate ||
            (newDate === existingDate && record.excelRow > existing.excelRow)
        ) {
            uniqueRecords.set(roKey, record);
        }
    });

    const records = Array.from(uniqueRecords.values());

    report.validRows = records.length;

    return { records, report };
}

exports.previewServiceExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload an Excel file.",
            });
        }

        const rows = readServiceWorkbook(req.file.buffer);
        const { records, report } = prepareServiceRows(rows);

        return res.status(200).json({
            success: true,
            message: "Service Excel preview generated.",
            report,
            preview: records.slice(0, 10).map((record) => ({
                bill_date: record.billDate,
                dealer_location: record.dealerLocation,
                repair_order_number: record.roNumber,
                ro_date: null,
                registration_number: record.registrationNumber,
                chassis_number: record.chassisNumber,
                service_category: record.serviceCategory,
                service_type: record.serviceType,
                ro_service_advisor: record.serviceAdvisor,
                product_name: record.productName,
            })),
        });
    } catch (error) {
        console.error("Service Excel preview error:", error);

        return res.status(400).json({
            success: false,
            message: error.message || "Unable to preview Excel file.",
        });
    }
};


exports.upsertServiceData = async (req, res) => {
    let connection;
    let transactionStarted = false;
    let lockAcquired = false;

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload an Excel file.",
            });
        }

        const rows = readServiceWorkbook(req.file.buffer);
        const { records, report } = prepareServiceRows(rows);

        if (!records.length) {
            return res.status(400).json({
                success: false,
                message: "No valid RO records found.",
                report,
            });
        }

        connection = await pool.getConnection();

        // Prevent simultaneous imports
        const [lockRows] = await connection.query(
            "SELECT GET_LOCK('service_data_excel_upsert', 0) AS acquired"
        );

        if (lockRows[0].acquired !== 1) {
            return res.status(409).json({
                success: false,
                message: "Another Service Data import is already running.",
            });
        }

        lockAcquired = true;

        const dealerBranchMap = await loadDealerBranchMap(connection);

        const unmappedDealerLocations = {};

        // Capture old and new chassis numbers before UPSERT.
        // This is needed when an existing RO changes chassis number.
        const affectedChassis = await captureAffectedChassis(
            connection,
            records
        );

        console.log(
            `[SERVICE EXCEL] Affected chassis identified: ${affectedChassis.size}`
        );

        await connection.beginTransaction();
        transactionStarted = true;

        const BATCH_SIZE = 1000;

        const insertSQL = `
    INSERT INTO ro_master_combined (
        bill_date,
        dealer_location,
        dealer_branch_id,
        repair_order_number,
        ro_date,
        registration_number,
        chassis_number,
        service_category,
        service_type,
        ro_service_advisor,
        product_name
    )
    VALUES ?
    ON DUPLICATE KEY UPDATE
        bill_date = VALUES(bill_date),
        dealer_location = VALUES(dealer_location),
        dealer_branch_id = VALUES(dealer_branch_id),
        ro_date = NULL,
        registration_number = VALUES(registration_number),
        chassis_number = VALUES(chassis_number),
        service_category = VALUES(service_category),
        service_type = VALUES(service_type),
        ro_service_advisor = VALUES(ro_service_advisor),
        product_name = VALUES(product_name)
`;

        let batchesCompleted = 0;
        let submittedRows = 0;

        let mappedDealerRows = 0;
        let blankDealerLocationRows = 0;


        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);

            const values = batch.map((record) => {
                const dealerBranchId = getDealerBranchId(
                    record.dealerLocation,
                    dealerBranchMap
                );

                if (dealerBranchId) {
                    mappedDealerRows++;
                } else if (record.dealerLocation) {
                    unmappedDealerLocations[record.dealerLocation] =
                        (unmappedDealerLocations[record.dealerLocation] || 0) + 1;
                } else {
                    blankDealerLocationRows++;
                }

                return [
                    record.billDate,
                    record.dealerLocation,
                    dealerBranchId,
                    record.roNumber,
                    null,
                    record.registrationNumber,
                    record.chassisNumber,
                    record.serviceCategory,
                    record.serviceType,
                    record.serviceAdvisor,
                    record.productName,
                ];
            });

            await connection.query(insertSQL, [values]);

            batchesCompleted++;
            submittedRows += batch.length;
        }


        await connection.commit();
        transactionStarted = false;

        // ========================================
        // SYNC CHASSIS MASTER
        // ========================================

        let chassisMasterSync = null;

        try {
            console.log("[SERVICE EXCEL] Updating Chassis Master...");

            chassisMasterSync = await syncChassisMaster();

            console.log(
                "[SERVICE EXCEL] Chassis Master sync completed."
            );

        } catch (syncError) {
            console.error(
                "[SERVICE EXCEL] Chassis Master sync failed:",
                syncError.message
            );

            chassisMasterSync = {
                success: false,
                message: syncError.message,
            };
        }

        // ========================================
        // UPDATE CHASSIS SERVICE SUMMARY
        // ========================================

        let chassisServiceSummarySync = null;

        try {
            console.log(
                "[SERVICE EXCEL] Updating Chassis Service Summary..."
            );

            chassisServiceSummarySync =
                await refreshChassisServiceSummary(
                    affectedChassis,
                    connection
                );

            console.log(
                "[SERVICE EXCEL] Summary update completed:",
                chassisServiceSummarySync
            );

        } catch (summaryError) {
            console.error(
                "[SERVICE EXCEL] Summary update failed:",
                summaryError
            );

            chassisServiceSummarySync = {
                success: false,
                message: summaryError.message,
            };
        }

        // ========================================
        // SUCCESS RESPONSE
        // ========================================

        return res.status(200).json({
            success: true,
            message: "Service Data Excel UPSERT completed successfully.",
            report: {
                ...report,
                submittedRows,
                batchesCompleted,
                roDate: "NULL for imported records",
                importMode: "UPSERT",
                existingRecordsDeleted: false,
                chassisMasterSync,
                chassisServiceSummarySync,
                dealerBranchMapping: {
                    mappedRows: mappedDealerRows,
                    unmappedLocations: unmappedDealerLocations,
                    blankLocationRows: blankDealerLocationRows,
                },

            },
        });

    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error("Service Excel UPSERT error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Service Data UPSERT failed.",
            existingDataPreserved: true,
        });
    } finally {
        if (connection && lockAcquired) {
            try {
                await connection.query(
                    "SELECT RELEASE_LOCK('service_data_excel_upsert')"
                );
            } catch (error) {
                console.error("Unable to release Service Data import lock:", error);
            }
        }

        if (connection) connection.release();
    }
};

