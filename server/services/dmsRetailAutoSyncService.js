
const {
  runDmsRetailSync,
} = require("../controllers/dmsRetailController");

function getDelayUntilNextISTHour() {
  const now = new Date();

  const istOffset = 330 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);

  const nextHour = new Date(istNow);

  nextHour.setUTCHours(
    nextHour.getUTCHours() + 1,
    0,
    0,
    0
  );

  return nextHour.getTime() - istNow.getTime();
}

function startDmsRetailAutoSync() {
  console.log(
    "[DMS RETAIL AUTO SYNC] Hourly scheduler enabled (Asia/Kolkata)."
  );

  let timer;

  const scheduleNext = () => {
    const delay = getDelayUntilNextISTHour();

    console.log(
      `[DMS RETAIL AUTO SYNC] Next run in ${Math.round(
        delay / 60000
      )} minutes.`
    );

    timer = setTimeout(async () => {
      try {
        console.log("[DMS RETAIL AUTO SYNC] Started");

        const result = await runDmsRetailSync();

        console.log(
          "[DMS RETAIL AUTO SYNC] Completed",
          result
        );
      } catch (error) {
        console.error(
          "[DMS RETAIL AUTO SYNC] Failed:",
          error.message
        );
      } finally {
        scheduleNext();
      }
    }, delay);
  };

  scheduleNext();

  return () => clearTimeout(timer);
}

module.exports = { startDmsRetailAutoSync };
