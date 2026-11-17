
const { pool } = require("../config/db");
const SalesMaster = require("../models/SalesMaster");
const { calculateObjectSize } = require("bson");

// ========================================
// CONFIGURATION
// ========================================

const BATCH_SIZE = 500;
const MAX_MYSQL_RETRIES = 6;
const MAX_MONGO_RETRIES = 5;
const MAX_BSON_SIZE = 15 * 1024 * 1024;

const CHECKPOINT_ID = "retention-full-import";

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const normalizeChassis = (value) =>
  String(value || "").trim().toUpperCase();

const retryDelay = (attempt) =>
  Math.min(1000 * Math.pow(2, attempt - 1), 30000);

// ========================================
// STATUS
// ========================================

const status = {
  running: false,
  phase: "idle",

  salesProcessed: 0,
  serviceProcessed: 0,

  matchedServiceRecords: 0,
  unmatchedServiceRecords: 0,

  masterDocuments: 0,

  lastSalesId: 0,
  lastServiceId: 0,

  batchNumber: 0,

  lastBatchDurationMs: 0,
  lastSqlDurationMs: 0,
  lastMongoDurationMs: 0,

  error: null,
  startedAt: null,
  completedAt: null
};

const getImportStatus = () => ({ ...status });

// ========================================
// CHECKPOINT STORAGE
// ========================================

const checkpointCollection = () =>
  SalesMaster.db.collection("importcheckpoints");

const loadCheckpoint = async () => {
  return checkpointCollection().findOne({
    _id: CHECKPOINT_ID
  });
};

const saveCheckpoint = async (values) => {
  await checkpointCollection().updateOne(
    { _id: CHECKPOINT_ID },
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

const isTransientMySQLError = (error) =>
  Boolean(
    error.fatal ||
    TRANSIENT_MYSQL_CODES.has(error.code)
  );

const retryMySQLQuery = async (sql, params = []) => {
  let lastError;

  for (
    let attempt = 1;
    attempt <= MAX_MYSQL_RETRIES;
    attempt++
  ) {
    try {
      // pool.query obtains a pooled connection for each attempt.
      const [rows] = await pool.query(sql, params);
      return rows;

    } catch (error) {
      lastError = error;

      console.error(
        `MySQL query failed | Attempt ${attempt}/${MAX_MYSQL_RETRIES} |`,
        error.code || error.message
      );

      if (!isTransientMySQLError(error)) {
        throw error;
      }

      if (attempt === MAX_MYSQL_RETRIES) {
        break;
      }

      const delay = retryDelay(attempt);

      console.log(
        `Retrying MySQL query in ${delay / 1000} seconds...`
      );

      await sleep(delay);
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

const retryMongoWrite = async (operations) => {
  let lastError;

  for (
    let attempt = 1;
    attempt <= MAX_MONGO_RETRIES;
    attempt++
  ) {
    try {
      console.log(
        `MongoDB write started | Operations: ${operations.length} | Attempt: ${attempt}`
      );

      const result = await SalesMaster.collection.bulkWrite(
        operations,
        { ordered: false }
      );

      console.log(
        `MongoDB write completed | Modified: ${result.modifiedCount} | Upserted: ${result.upsertedCount}`
      );

      return result;

    } catch (error) {
      lastError = error;

      console.error(
        `MongoDB write failed | Attempt ${attempt}/${MAX_MONGO_RETRIES} |`,
        error.message
      );

      // Our sales upserts and service source-ID pipeline
      // are safe to replay after partial bulk-write success.
      if (
        !isTransientMongoError(error) &&
        !error.writeErrors
      ) {
        throw error;
      }

      if (attempt === MAX_MONGO_RETRIES) {
        break;
      }

      const delay = retryDelay(attempt);

      console.log(
        `Retrying MongoDB write in ${delay / 1000} seconds...`
      );

      await sleep(delay);
    }
  }

  throw lastError;
};

// ========================================
// SALES IMPORT
// ========================================

const importSalesData = async (salesChassisSet, checkpoint) => {
  let lastSalesId = Number(checkpoint.salesLastId || 0);

  status.phase = "importing-sales";
  status.lastSalesId = lastSalesId;

  console.log(
    `Starting Sales Data import from SQL ID ${lastSalesId}...`
  );

  while (true) {
    const batchStart = Date.now();

    console.log(
      `Fetching sales batch after SQL ID: ${lastSalesId}`
    );

    const sqlStart = Date.now();

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
      [lastSalesId, BATCH_SIZE]
    );

    status.lastSqlDurationMs = Date.now() - sqlStart;

    console.log(
      `SQL returned ${rows.length} sales records | ${status.lastSqlDurationMs}ms`
    );

    if (rows.length === 0) break;

    const operations = [];

    for (const row of rows) {
      const chassisKey = normalizeChassis(row.chassis_no);

      if (!chassisKey) {
        throw new Error(
          `Empty chassis number in Sales SQL ID ${row.id}`
        );
      }

      const salesData = {
        deliveryDate: row.delivery_date,
        saleBranch: row.sale_branch,
        modelGroup: row.model_group,
        customerName: row.cust_name,
        postalCode: row.postal_code,
        mobileNumber: row.mobile_no,
        segment: row.segment,
        sourceCreatedAt: row.created_at
      };

      const documentSize = calculateObjectSize({
        chassisKey,
        chassisNumber: row.chassis_no,
        sourceSalesId: row.id,
        salesData,
        serviceRecords: []
      });

      if (documentSize > MAX_BSON_SIZE) {
        throw new Error(
          `Sales document exceeds BSON safety limit: ${chassisKey}`
        );
      }

      operations.push({
        updateOne: {
          filter: { chassisKey },

          update: {
            $set: {
              chassisNumber: row.chassis_no,
              salesData,
              lastSyncedAt: new Date()
            },

            $setOnInsert: {
              sourceSalesId: row.id,
              serviceRecords: []
            }
          },

          upsert: true
        }
      });

      salesChassisSet.add(chassisKey);
    }

    const mongoStart = Date.now();

    await retryMongoWrite(operations);

    status.lastMongoDurationMs = Date.now() - mongoStart;

    const newLastId = rows[rows.length - 1].id;

    // Save checkpoint only after MongoDB write succeeds.
    await saveCheckpoint({
      salesLastId: newLastId,
      salesProcessed: status.salesProcessed + rows.length
    });

    status.salesProcessed += rows.length;
    status.lastSalesId = newLastId;
    status.batchNumber++;

    lastSalesId = newLastId;

    status.lastBatchDurationMs = Date.now() - batchStart;

    console.log(
      `Sales: ${status.salesProcessed} | ` +
      `Last ID: ${lastSalesId} | ` +
      `SQL: ${status.lastSqlDurationMs}ms | ` +
      `MongoDB: ${status.lastMongoDurationMs}ms | ` +
      `Total: ${status.lastBatchDurationMs}ms`
    );
  }

  await saveCheckpoint({
    salesCompleted: true,
    salesLastId: lastSalesId
  });

  console.log(
    `Sales import completed: ${status.salesProcessed}`
  );
};

// ========================================
// LOAD SALES CHASSIS FROM MONGODB
// ========================================

const loadSalesChassis = async () => {
  console.log("Loading Sales Master chassis keys...");

  const chassisSet = new Set();

  const cursor = SalesMaster.collection.find(
    {},
    { projection: { chassisKey: 1 } }
  );

  for await (const document of cursor) {
    if (document.chassisKey) {
      chassisSet.add(document.chassisKey);
    }
  }

  console.log(
    `Loaded ${chassisSet.size} sales chassis keys`
  );

  return chassisSet;
};

// ========================================
// SERVICE IMPORT
// ========================================

const importServiceData = async (salesChassisSet, checkpoint) => {
  let lastServiceId = Number(checkpoint.serviceLastId || 0);

  status.phase = "importing-services";
  status.lastServiceId = lastServiceId;

  console.log(
    `Starting Service Data import from SQL ID ${lastServiceId}...`
  );

  while (true) {
    const batchStart = Date.now();

    console.log(
      `Fetching service batch after SQL ID: ${lastServiceId}`
    );

    const sqlStart = Date.now();

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
      [lastServiceId, BATCH_SIZE]
    );

    status.lastSqlDurationMs = Date.now() - sqlStart;

    console.log(
      `SQL returned ${rows.length} service records | ${status.lastSqlDurationMs}ms`
    );

    if (rows.length === 0) break;

    const groups = new Map();

    let batchMatched = 0;
    let batchUnmatched = 0;

    for (const row of rows) {
      const chassisKey = normalizeChassis(row.chassis_number);

      if (!chassisKey || !salesChassisSet.has(chassisKey)) {
        batchUnmatched++;
        continue;
      }

      const serviceRecord = {
        sourceServiceId: row.id,
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
      };

      if (!groups.has(chassisKey)) {
        groups.set(chassisKey, []);
      }

      groups.get(chassisKey).push(serviceRecord);
      batchMatched++;
    }

    const operations = [];
    const syncTime = new Date();

    for (const [chassisKey, services] of groups) {
      const size = calculateObjectSize({
        serviceRecords: services
      });

      if (size > MAX_BSON_SIZE) {
        throw new Error(
          `Service batch exceeds BSON safety limit: ${chassisKey}`
        );
      }

      // Append only service IDs that are not already present.
      operations.push({
        updateOne: {
          filter: { chassisKey },

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
                            input: {
                              $literal: services
                            },

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

                lastSyncedAt: {
                  $literal: syncTime
                }
              }
            }
          ],

          upsert: false
        }
      });
    }

    console.log(
      `Service batch grouped into ${operations.length} MongoDB operations`
    );

    const mongoStart = Date.now();

    if (operations.length > 0) {
      await retryMongoWrite(operations);
    }

    status.lastMongoDurationMs = Date.now() - mongoStart;

    const newLastId = rows[rows.length - 1].id;

    // Checkpoint after all MongoDB operations succeed.
    await saveCheckpoint({
      serviceLastId: newLastId,
      serviceProcessed: status.serviceProcessed + rows.length,
      matchedServiceRecords:
        status.matchedServiceRecords + batchMatched,
      unmatchedServiceRecords:
        status.unmatchedServiceRecords + batchUnmatched
    });

    status.serviceProcessed += rows.length;
    status.matchedServiceRecords += batchMatched;
    status.unmatchedServiceRecords += batchUnmatched;

    status.lastServiceId = newLastId;
    status.batchNumber++;

    lastServiceId = newLastId;

    status.lastBatchDurationMs = Date.now() - batchStart;

    console.log(
      `Services: ${status.serviceProcessed} | ` +
      `Matched: ${status.matchedServiceRecords} | ` +
      `Unmatched: ${status.unmatchedServiceRecords} | ` +
      `Last ID: ${lastServiceId} | ` +
      `SQL: ${status.lastSqlDurationMs}ms | ` +
      `MongoDB: ${status.lastMongoDurationMs}ms | ` +
      `Total: ${status.lastBatchDurationMs}ms`
    );
  }

  await saveCheckpoint({
    servicesCompleted: true,
    serviceLastId: lastServiceId
  });

  console.log(
    `Service import completed: ${status.serviceProcessed}`
  );
};

// ========================================
// FINAL VERIFICATION
// ========================================

const verifyImport = async () => {
  status.phase = "verifying";

  console.log("Verifying MongoDB data...");

  const masterDocuments = await SalesMaster.countDocuments();

  const verification = await SalesMaster.aggregate([
    {
      $project: {
        serviceCount: {
          $size: {
            $ifNull: ["$serviceRecords", []]
          }
        }
      }
    },
    {
      $group: {
        _id: null,

        totalMasters: { $sum: 1 },

        mastersWithServices: {
          $sum: {
            $cond: [
              { $gt: ["$serviceCount", 0] },
              1,
              0
            ]
          }
        },

        totalServiceRecords: {
          $sum: "$serviceCount"
        },

        maxServicesPerMaster: {
          $max: "$serviceCount"
        }
      }
    }
  ]);

  const result = verification[0] || {
    totalMasters: 0,
    mastersWithServices: 0,
    totalServiceRecords: 0,
    maxServicesPerMaster: 0
  };

  status.masterDocuments = masterDocuments;

  console.log("Final MongoDB verification:", result);

  if (masterDocuments !== status.salesProcessed) {
    throw new Error(
      `Sales count mismatch. Expected ${status.salesProcessed}, found ${masterDocuments}`
    );
  }

  if (
    result.totalServiceRecords !==
    status.matchedServiceRecords
  ) {
    throw new Error(
      `Service count mismatch. Expected ${status.matchedServiceRecords}, found ${result.totalServiceRecords}`
    );
  }

  if (
    result.mastersWithServices +
    (masterDocuments - result.mastersWithServices) !==
    masterDocuments
  ) {
    throw new Error("Master document verification failed");
  }

  await saveCheckpoint({
    importCompleted: true,
    finalVerification: result,
    completedAt: new Date()
  });

  console.log("All MongoDB verification checks passed!");

  return result;
};

// ========================================
// MAIN IMPORT
// ========================================

const runRetentionImport = async () => {
  console.log("Initializing Retention Data import...");

  await SalesMaster.init();

  let checkpoint = await loadCheckpoint();

  const existingMasters = await SalesMaster.countDocuments();

  // If Sales Master was deleted but an old checkpoint remains,
  // start a completely fresh import.
  if (
    existingMasters === 0 &&
    checkpoint &&
    (
      checkpoint.salesLastId > 0 ||
      checkpoint.serviceLastId > 0
    )
  ) {
    console.log(
      "Sales Master is empty. Resetting old import checkpoint."
    );

    await checkpointCollection().deleteOne({
      _id: CHECKPOINT_ID
    });

    checkpoint = null;
  }

  if (!checkpoint) {
    checkpoint = {
      salesLastId: 0,
      serviceLastId: 0,
      salesProcessed: 0,
      serviceProcessed: 0,
      matchedServiceRecords: 0,
      unmatchedServiceRecords: 0
    };
  }

  status.salesProcessed = Number(checkpoint.salesProcessed || 0);
  status.serviceProcessed = Number(checkpoint.serviceProcessed || 0);

  status.matchedServiceRecords = Number(
    checkpoint.matchedServiceRecords || 0
  );

  status.unmatchedServiceRecords = Number(
    checkpoint.unmatchedServiceRecords || 0
  );

  status.lastSalesId = Number(checkpoint.salesLastId || 0);
  status.lastServiceId = Number(checkpoint.serviceLastId || 0);

  console.log("Import checkpoint loaded:", {
    salesLastId: status.lastSalesId,
    serviceLastId: status.lastServiceId
  });

  const salesChassisSet = await loadSalesChassis();

  await importSalesData(salesChassisSet, checkpoint);

  // Rebuild the set in case this is a resumed import.
  const completeSalesChassisSet = await loadSalesChassis();

  const latestCheckpoint = await loadCheckpoint();

  await importServiceData(
    completeSalesChassisSet,
    latestCheckpoint || checkpoint
  );

  await verifyImport();

  status.phase = "completed";

  console.log("Retention import completed successfully!");
};

// ========================================
// START IMPORT
// ========================================

const startRetentionImport = async () => {
  if (status.running) {
    throw new Error("An import is already running");
  }

  Object.assign(status, {
    running: true,
    phase: "starting",

    salesProcessed: 0,
    serviceProcessed: 0,

    matchedServiceRecords: 0,
    unmatchedServiceRecords: 0,

    masterDocuments: 0,

    lastSalesId: 0,
    lastServiceId: 0,

    batchNumber: 0,

    lastBatchDurationMs: 0,
    lastSqlDurationMs: 0,
    lastMongoDurationMs: 0,

    error: null,
    startedAt: new Date(),
    completedAt: null
  });

  runRetentionImport()
    .then(() => {
      status.running = false;
      status.phase = "completed";
      status.completedAt = new Date();
    })
    .catch((error) => {
      console.error("Retention import failed:", error);

      status.running = false;
      status.phase = "failed";
      status.error = error.message;
      status.completedAt = new Date();

      console.error(
        "Checkpoint preserved. Restart the import after resolving the error."
      );
    });

  return getImportStatus();
};

module.exports = {
  startRetentionImport,
  getImportStatus
};
