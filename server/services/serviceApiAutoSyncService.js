
const {
    runServiceApiSync,
} = require("../controllers/serviceApiSyncController");

let isRunning = false;
let scheduledTimer = null;

function getDelayUntilNextHourIST() {
    const now = new Date();

    const istOffset = 330 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);

    const nextHour = new Date(istNow);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1);
    nextHour.setUTCMinutes(0, 0, 0);

    return nextHour.getTime() - istNow.getTime();
}

function scheduleNextSync() {
    const delay = getDelayUntilNextHourIST();

    const nextRun = new Date(Date.now() + delay);

    console.log(
        `[SERVICE MYSQL AUTO SYNC] Next run: ${nextRun.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
        })}`
    );

    scheduledTimer = setTimeout(async () => {
        if (isRunning) {
            console.log("[SERVICE MYSQL AUTO SYNC] Previous sync still running. Skipping.");
            scheduleNextSync();
            return;
        }

        isRunning = true;

        try {
            console.log("[SERVICE MYSQL AUTO SYNC] Started.");

            const report = await runServiceApiSync();

            console.log("[SERVICE MYSQL AUTO SYNC] Completed:", report);
        } catch (error) {
            console.error("[SERVICE MYSQL AUTO SYNC] Failed:", error);
        } finally {
            isRunning = false;
            scheduleNextSync();
        }
    }, delay);
}

exports.startServiceApiAutoSync = () => {
    console.log(
        "[SERVICE MYSQL AUTO SYNC] Hourly scheduler enabled (Asia/Kolkata)."
    );

    scheduleNextSync();
};
