
const cron = require("node-cron");
const { pool } = require("../config/db");
const SalesMaster = require("../models/SalesMaster");
const { calculateObjectSize } = require("bson");

// ========================================
// CONFIGURATION
// ========================================

const BATCH_SIZE = 500;
const MAX_BSON_SIZE = 15 * 1024 * 1024;
const MAX_RETRIES = 6;

const CHECKPOINT_COLLECTION = "importcheckpoints";
const PENDING_COLLECTION = "pendingservicerecords";

const FULL_IMPORT_ID = "retention-full-import";
const SYNC_ID = "retention-auto-sync";

let isSyncing = false;
let scheduledTask = null;

const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

const normalizeChassis = (value) =>
    String(value || "").trim().toUpperCase();

const retryDelay = (attempt) =>
    Math.min(1000 * Math.pow(2, attempt - 1), 30000);

// ========================================
// MYSQL RETRY
// ========================================

const TRANSIENT_MYSQL_CODES = new Set([
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EPIPE",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "PROTOCOL_CONNECTION_LOST",
    "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
    "ER_LOCK_WAIT_TIMEOUT",
    "ER_LOCK_DEADLOCK"
]);

const retryMySQLQuery = async (sql, params = []) => {
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const [rows] = await pool.query(sql, params);
            return rows;
        } catch (error) {
            lastError = error;

            const transient =
                error.fatal || TRANSIENT_MYSQL_CODES.has(error.code);

            console.error(
                `Sync MySQL attempt ${attempt}/${MAX_RETRIES}:`,
                error.code || error.message
            );

            if (!transient || attempt === MAX_RETRIES) {
                throw error;
            }

            await sleep(retryDelay(attempt));
        }
    }

    throw lastError;
};

// ========================================
// MONGODB RETRY
// ========================================

const isTransientMongoError = (error) => {
    const codes = [
        6, 7, 89, 91, 189,
        11600, 11602, 13435, 13436
    ];

    if (codes.includes(error.code)) return true;

    if (
        typeof error.hasErrorLabel === "function" &&
        (
            error.hasErrorLabel("RetryableWriteError") ||
            error.hasErrorLabel("TransientTransactionError")
        )
    ) {
        return true;
    }

    return [
        "MongoNetworkError",
        "MongoNetworkTimeoutError",
        "MongoServerSelectionError",
        "MongoTopologyClosedError"
    ].includes(error.name);
};

const retryBulkWrite = async (collection, operations) => {
    if (!operations.length) return null;

    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await collection.bulkWrite(
                operations,
                { ordered: false }
            );
        } catch (error) {
            lastError = error;

            console.error(
                `MongoDB bulk write attempt ${attempt}/${MAX_RETRIES}:`,
                error.message
            );

            if (
                !isTransientMongoError(error) &&
                !error.writeErrors
            ) {
                throw error;
            }

            if (attempt === MAX_RETRIES) break;

            await sleep(retryDelay(attempt));
        }
    }

    throw lastError;
};

// ========================================
// COLLECTIONS AND INDEXES
// ========================================

const checkpointCollection = () =>
    SalesMaster.db.collection(CHECKPOINT_COLLECTION);

const pendingCollection = () =>
    SalesMaster.db.collection(PENDING_COLLECTION);

const initializeSyncIndexes = async () => {
    await SalesMaster.init();

    await pendingCollection().createIndex(
        { sourceServiceId: 1 },
        { unique: true }
    );

    await pendingCollection().createIndex({
        chassisKey: 1,
        sourceServiceId: 1
    });

    console.log("Automatic sync indexes verified.");
};

// ========================================
// CHECKPOINTS
// ========================================

const saveCheckpoint = async (values) => {
    await checkpointCollection().updateOne(
        { _id: SYNC_ID },
        {
            $set: {
                ...values,
                updatedAt: new Date()
            },
            $setOnInsert: {
                createdAt: new Date()
            }
        },
        { upsert: true }
    );
};

const loadSyncCheckpoint = async () => {
    const collection = checkpointCollection();

    let checkpoint = await collection.findOne({
        _id: SYNC_ID
    });

    if (checkpoint) return checkpoint;

    const fullImport = await collection.findOne({
        _id: FULL_IMPORT_ID
    });

    if (!fullImport || fullImport.importCompleted !== true) {
        throw new Error(
            "Full import is not completed. Automatic sync cannot start."
        );
    }

    checkpoint = {
        _id: SYNC_ID,

        salesLastId: Number(fullImport.salesLastId || 0),
        serviceLastId: Number(fullImport.serviceLastId || 0),

        backfillLastId: 0,
        backfillMaxId: null,
        backfillCompleted: false,

        createdAt: new Date(),
        updatedAt: new Date()
    };

    await collection.insertOne(checkpoint);

    console.log("Initial automatic sync checkpoint created:", {
        salesLastId: checkpoint.salesLastId,
        serviceLastId: checkpoint.serviceLastId
    });

    return checkpoint;
};

// ========================================
// SALES AND SERVICE MAPPING
// ========================================

const mapSalesData = (row) => ({
    deliveryDate: row.delivery_date,
    saleBranch: row.sale_branch,
    modelGroup: row.model_group,
    customerName: row.cust_name,
    postalCode: row.postal_code,
    mobileNumber: row.mobile_no,
    segment: row.segment,
    sourceCreatedAt: row.created_at
});

const mapServiceRecord = (row) => ({
    sourceServiceId: Number(row.id),
    billDate: row.bill_date,
    dealerLocation: row.dealer_location,
    repairOrderNumber: row.repair_order_number,
    roDate: row.ro_date,
    registrationNumber: row.registration_number,
    chassisNumber: row.chassis_number,
    serviceCategory: row.service_category,
    serviceType: row.service_type,
    roServiceAdvisor: row.ro_service_advisor,
    productName: row.product_name,
    sourceCreatedAt: row.created_at
});

// ========================================
// IDEMPOTENT SERVICE APPEND PIPELINE
// ========================================

const buildServiceAppendOperation = (
    document,
    services,
    syncTime
) => {
    const existingServices = document.serviceRecords || [];

    const existingIds = new Set(
        existingServices.map((service) =>
            Number(service.sourceServiceId)
        )
    );

    const newServices = services.filter((service) => {
        const id = Number(service.sourceServiceId);

        if (existingIds.has(id)) return false;

        existingIds.add(id);
        return true;
    });

    if (!newServices.length) return null;

    const estimatedDocument = {
        ...document,
        serviceRecords: [
            ...existingServices,
            ...newServices
        ]
    };

    const documentSize = calculateObjectSize(estimatedDocument);

    if (documentSize > MAX_BSON_SIZE) {
        throw new Error(
            `Sales Master document is approaching BSON limit: ${document.chassisKey}`
        );
    }

    return {
        updateOne: {
            filter: { _id: document._id },
            update: [
                {
                    $set: {
                        serviceRecords: {
                            $let: {
                                vars: {
                                    existing: {
                                        $ifNull: ["$serviceRecords", []]
                                    }
                                },
                                in: {
                                    $concatArrays: [
                                        "$$existing",
                                        {
                                            $filter: {
                                                input: { $literal: newServices },
                                                as: "incoming",
                                                cond: {
                                                    $not: [
                                                        {
                                                            $in: [
                                                                "$$incoming.sourceServiceId",
                                                                {
                                                                    $map: {
                                                                        input: "$$existing",
                                                                        as: "saved",
                                                                        in: "$$saved.sourceServiceId"
                                                                    }
                                                                }
                                                            ]
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        lastSyncedAt: { $literal: syncTime },
                        updatedAt: { $literal: syncTime }
                    }
                }
            ]
        }
    };
};

// ========================================
// PROCESS SERVICE ROWS
// Matched -> Sales Master
// Unmatched -> Pending collection
// ========================================

const processServiceRows = async (rows) => {
    if (!rows.length) {
        return {
            matched: 0,
            added: 0,
            unmatched: 0
        };
    }

    const groups = new Map();

    for (const row of rows) {
        const chassisKey = normalizeChassis(row.chassis_number);

        if (!chassisKey) {
            throw new Error(
                `Empty chassis number in Service SQL ID ${row.id}`
            );
        }

        if (!groups.has(chassisKey)) {
            groups.set(chassisKey, []);
        }

        groups.get(chassisKey).push(mapServiceRecord(row));
    }

    const chassisKeys = [...groups.keys()];

    const documents = await SalesMaster.collection.find({
        chassisKey: { $in: chassisKeys }
    }).toArray();

    const documentMap = new Map(
        documents.map((document) => [
            document.chassisKey,
            document
        ])
    );

    const salesOperations = [];
    const pendingOperations = [];

    let matched = 0;
    let added = 0;
    let unmatched = 0;

    const syncTime = new Date();

    for (const [chassisKey, services] of groups) {
        const document = documentMap.get(chassisKey);

        if (document) {
            matched += services.length;

            const operation = buildServiceAppendOperation(
                document,
                services,
                syncTime
            );

            if (operation) {
                salesOperations.push(operation);
                added += services.filter((service) => {
                    const existingIds = new Set(
                        (document.serviceRecords || []).map((item) =>
                            Number(item.sourceServiceId)
                        )
                    );

                    return !existingIds.has(
                        Number(service.sourceServiceId)
                    );
                }).length;
            }

            continue;
        }

        unmatched += services.length;

        for (const service of services) {
            pendingOperations.push({
                updateOne: {
                    filter: {
                        sourceServiceId: service.sourceServiceId
                    },
                    update: {
                        $setOnInsert: {
                            sourceServiceId: service.sourceServiceId,
                            chassisKey,
                            serviceRecord: service,
                            createdAt: syncTime
                        }
                    },
                    upsert: true
                }
            });
        }
    }

    // Both writes are replay-safe.
    await retryBulkWrite(
        SalesMaster.collection,
        salesOperations
    );

    await retryBulkWrite(
        pendingCollection(),
        pendingOperations
    );

    return { matched, added, unmatched };
};

// ========================================
// ATTACH PENDING SERVICES TO NEW SALES
// ========================================

const reconcilePendingServices = async (salesRows) => {
    const chassisKeys = [
        ...new Set(
            salesRows
                .map((row) => normalizeChassis(row.chassis_no))
                .filter(Boolean)
        )
    ];

    if (!chassisKeys.length) return 0;

    const pendingRows = await pendingCollection()
        .find({
            chassisKey: { $in: chassisKeys }
        })
        .sort({ sourceServiceId: 1 })
        .toArray();

    if (!pendingRows.length) return 0;

    const documents = await SalesMaster.collection.find({
        chassisKey: { $in: chassisKeys }
    }).toArray();

    const documentMap = new Map(
        documents.map((document) => [
            document.chassisKey,
            document
        ])
    );

    const groupedPending = new Map();

    for (const pending of pendingRows) {
        if (!groupedPending.has(pending.chassisKey)) {
            groupedPending.set(pending.chassisKey, []);
        }

        groupedPending.get(pending.chassisKey).push(
            pending.serviceRecord
        );
    }

    const operations = [];
    const idsToDelete = [];

    const syncTime = new Date();

    for (const [chassisKey, services] of groupedPending) {
        const document = documentMap.get(chassisKey);

        if (!document) continue;

        const operation = buildServiceAppendOperation(
            document,
            services,
            syncTime
        );

        if (operation) {
            operations.push(operation);
        }

        // Safe to delete only after the Sales Master write succeeds.
        const matchingPending = pendingRows.filter(
            (item) => item.chassisKey === chassisKey
        );

        idsToDelete.push(
            ...matchingPending.map((item) => item.sourceServiceId)
        );
    }

    // Attach pending services first.
    const writeResult = await retryBulkWrite(
        SalesMaster.collection,
        operations
    );

    // Verify that every expected Sales Master was found.
    if (
        operations.length > 0 &&
        writeResult.matchedCount !== operations.length
    ) {
        throw new Error(
            `Pending reconciliation incomplete. ` +
            `Expected ${operations.length} matched documents, ` +
            `found ${writeResult.matchedCount}. ` +
            `Pending records preserved.`
        );
    }

    // Delete pending records only after successful attachment
    // or confirmation that their services already exist.
    if (idsToDelete.length) {
        const deleteResult = await pendingCollection().deleteMany({
            sourceServiceId: { $in: idsToDelete }
        });

        console.log(
            `Pending records deleted: ${deleteResult.deletedCount}`
        );
    }

    console.log(
        `Pending reconciliation | Attached or already present: ${idsToDelete.length}`
    );

    return idsToDelete.length;
};

// ========================================
// SYNC NEW SALES ROWS
// ========================================

const syncSales = async (checkpoint) => {
    let lastId = Number(checkpoint.salesLastId || 0);
    let processed = 0;

    console.log(`Sales sync starting after ID ${lastId}`);

    while (true) {
        const rows = await retryMySQLQuery(
            `SELECT
         id,
         delivery_date,
         chassis_no,
         sale_branch,
         model_group,
         cust_name,
         postal_code,
         mobile_no,
         segment,
         created_at
       FROM sales_data_combined
       WHERE id > ?
       ORDER BY id ASC
       LIMIT ?`,
            [lastId, BATCH_SIZE]
        );

        if (!rows.length) break;

        const now = new Date();

        const operations = rows.map((row) => {
            const chassisKey = normalizeChassis(row.chassis_no);

            if (!chassisKey) {
                throw new Error(
                    `Empty chassis in Sales SQL ID ${row.id}`
                );
            }

            return {
                updateOne: {
                    filter: { chassisKey },
                    update: {
                        $set: {
                            chassisNumber: row.chassis_no,
                            salesData: mapSalesData(row),
                            lastSyncedAt: now,
                            updatedAt: now
                        },
                        $setOnInsert: {
                            sourceSalesId: Number(row.id),
                            serviceRecords: [],
                            branchId: null,
                            createdAt: now
                        }
                    },
                    upsert: true
                }
            };
        });

        await retryBulkWrite(
            SalesMaster.collection,
            operations
        );

        // Attach old unmatched services, if any.
        await reconcilePendingServices(rows);

        const newLastId = Number(rows[rows.length - 1].id);

        await saveCheckpoint({
            salesLastId: newLastId
        });

        lastId = newLastId;
        processed += rows.length;

        console.log(
            `Sales sync | Processed: ${processed} | Last ID: ${lastId}`
        );
    }

    return lastId;
};

// ========================================
// ONE-TIME HISTORICAL SERVICE BACKFILL
// ========================================

const runHistoricalBackfill = async () => {
    let checkpoint = await loadSyncCheckpoint();

    if (checkpoint.backfillCompleted) {
        console.log("Historical service reconciliation already completed.");
        return;
    }

    let lastId = Number(checkpoint.backfillLastId || 0);
    let maxId = checkpoint.backfillMaxId;

    // Capture a fixed upper watermark once.
    if (maxId === null || maxId === undefined) {
        const result = await retryMySQLQuery(
            `SELECT COALESCE(MAX(id), 0) AS maxId
       FROM ro_master_combined`
        );

        maxId = Number(result[0]?.maxId || 0);

        await saveCheckpoint({
            backfillMaxId: maxId,
            backfillLastId: lastId
        });
    }

    console.log(
        `Historical backfill starting | Last ID: ${lastId} | Maximum ID: ${maxId}`
    );

    if (maxId === 0 || lastId >= maxId) {
        await saveCheckpoint({
            backfillCompleted: true,
            backfillCompletedAt: new Date()
        });

        return;
    }

    let processed = 0;

    while (lastId < maxId) {
        const rows = await retryMySQLQuery(
            `SELECT
         id,
         bill_date,
         dealer_location,
         repair_order_number,
         ro_date,
         registration_number,
         chassis_number,
         service_category,
         service_type,
         ro_service_advisor,
         product_name,
         created_at
       FROM ro_master_combined
       WHERE id > ?
         AND id <= ?
       ORDER BY id ASC
       LIMIT ?`,
            [lastId, maxId, BATCH_SIZE]
        );

        if (!rows.length) {
            lastId = maxId;

            await saveCheckpoint({
                backfillLastId: lastId
            });

            break;
        }

        // Existing embedded IDs are skipped.
        // Missing matched IDs are attached.
        // Unmatched records are saved as pending.
        const result = await processServiceRows(rows);

        const newLastId = Number(rows[rows.length - 1].id);

        // Save only after all MongoDB writes succeed.
        await saveCheckpoint({
            backfillLastId: newLastId
        });

        lastId = newLastId;
        processed += rows.length;

        console.log(
            `Historical backfill | Processed: ${processed} | ` +
            `Matched: ${result.matched} | ` +
            `Newly added: ${result.added} | ` +
            `Pending: ${result.unmatched} | ` +
            `Last ID: ${lastId}`
        );
    }

    await saveCheckpoint({
        backfillCompleted: true,
        backfillCompletedAt: new Date()
    });

    const pendingCount = await pendingCollection().countDocuments();

    console.log(
        `Historical backfill completed. Pending service records: ${pendingCount}`
    );
};

// ========================================
// SYNC NEW SERVICE ROWS
// ========================================

const syncServices = async (checkpoint) => {
    let lastId = Number(checkpoint.serviceLastId || 0);
    let processed = 0;
    let added = 0;
    let pending = 0;

    console.log(`Service sync starting after ID ${lastId}`);

    while (true) {
        const rows = await retryMySQLQuery(
            `SELECT
         id,
         bill_date,
         dealer_location,
         repair_order_number,
         ro_date,
         registration_number,
         chassis_number,
         service_category,
         service_type,
         ro_service_advisor,
         product_name,
         created_at
       FROM ro_master_combined
       WHERE id > ?
       ORDER BY id ASC
       LIMIT ?`,
            [lastId, BATCH_SIZE]
        );

        if (!rows.length) break;

        const result = await processServiceRows(rows);

        const newLastId = Number(rows[rows.length - 1].id);

        // Matched writes and pending writes must both succeed first.
        await saveCheckpoint({
            serviceLastId: newLastId
        });

        lastId = newLastId;
        processed += rows.length;
        added += result.added;
        pending += result.unmatched;

        console.log(
            `Service sync | Processed: ${processed} | ` +
            `Added: ${added} | ` +
            `Pending: ${pending} | ` +
            `Last ID: ${lastId}`
        );
    }

    return lastId;
};

// ========================================
// RUN ONE SYNC CYCLE
// ========================================

const runSync = async () => {
    if (isSyncing) {
        console.log("Sync skipped: previous cycle is still running.");
        return;
    }

    isSyncing = true;

    const startedAt = Date.now();

    try {
        console.log("\n========== AUTOMATIC SYNC STARTED ==========");

        await initializeSyncIndexes();

        let checkpoint = await loadSyncCheckpoint();

        // 1. Create new Sales Master documents.
        await syncSales(checkpoint);

        // 2. Reconcile the old service history exactly once.
        await runHistoricalBackfill();

        // 3. Import services created after the full import.
        checkpoint = await loadSyncCheckpoint();

        const serviceLastId = await syncServices(checkpoint);

        await saveCheckpoint({
            serviceLastId,
            lastSuccessfulSyncAt: new Date(),
            lastError: null
        });

        const pendingCount = await pendingCollection().countDocuments();

        console.log(
            `========== SYNC COMPLETED | ` +
            `Duration: ${Date.now() - startedAt}ms | ` +
            `Pending: ${pendingCount} ==========`
        );
    } catch (error) {
        console.error("AUTOMATIC SYNC FAILED:", error);

        try {
            await saveCheckpoint({
                lastError: error.message,
                lastFailedSyncAt: new Date()
            });
        } catch (checkpointError) {
            console.error(
                "Could not save sync error:",
                checkpointError.message
            );
        }
    } finally {
        isSyncing = false;
    }
};

// ========================================
// START AND STOP SCHEDULER
// ========================================

const startAutoSync = () => {
    if (scheduledTask) {
        console.log("Automatic sync scheduler already running.");
        return;
    }

    console.log("Automatic SQL to MongoDB sync enabled.");
    console.log("Sync interval: Every 5 minutes.");

    // First run immediately.
    runSync();

    // Repeat every five minutes.
    scheduledTask = cron.schedule("*/5 * * * *", () => {
        runSync();
    });
};

const stopAutoSync = () => {
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
    }
};

module.exports = {
    startAutoSync,
    stopAutoSync,
    runSync
};
