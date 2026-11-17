
const { runSalesSync } = require("../controllers/salesApiSyncController");

let started = false;
let timer = null;

function getMillisecondsUntilNextISTHour() {
  const now = new Date();

  // Convert current time to IST (UTC + 5:30).
  const istTime = new Date(now.getTime() + 330 * 60 * 1000);

  // Move to the next full IST hour.
  istTime.setMinutes(0, 0, 0);
  istTime.setHours(istTime.getHours() + 1);

  const nextRunUTC = istTime.getTime() - 330 * 60 * 1000;

  return Math.max(1000, nextRunUTC - now.getTime());
}

async function executeSalesSync() {
  const startedAt = new Date().toISOString();

  console.log(`[SALES AUTO SYNC] Started: ${startedAt}`);

  try {
    const report = await runSalesSync();

    console.log("[SALES AUTO SYNC] Completed successfully", {
      apiRows: report.apiRows,
      validRows: report.validRows,
      skippedRows: report.skippedRows,
      upsertedRows: report.upsertedRows,
      batchesCompleted: report.batchesCompleted,
    });
  } catch (error) {
    console.error("[SALES AUTO SYNC] Failed:", error.message);
  }
}

function scheduleNextRun() {
  const delay = getMillisecondsUntilNextISTHour();

  console.log(
    `[SALES AUTO SYNC] Next run in ${Math.round(delay / 60000)} minutes.`
  );

  timer = setTimeout(async () => {
    await executeSalesSync();
    scheduleNextRun();
  }, delay);
}

exports.startSalesAutoSync = () => {
  if (started) return;

  started = true;

  console.log("[SALES AUTO SYNC] Hourly scheduler enabled (Asia/Kolkata).");

  scheduleNextRun();
};

exports.stopSalesAutoSync = () => {
  if (timer) clearTimeout(timer);
  timer = null;
  started = false;
};
