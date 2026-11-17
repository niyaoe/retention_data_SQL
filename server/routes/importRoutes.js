
const express = require("express");
const router = express.Router();

const {
  checkImportReadiness
} = require("../services/importPreflightService");

const {
  startRetentionImport,
  getImportStatus
} = require("../services/importService");

// Existing read-only preflight API
router.get("/preflight", async (req, res) => {
  try {
    const result = await checkImportReadiness();

    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Start import
router.post("/start", async (req, res) => {
  try {
    const importSecret = process.env.IMPORT_SECRET;

    if (!importSecret) {
      return res.status(503).json({
        success: false,
        message: "IMPORT_SECRET is not configured"
      });
    }

    if (req.get("x-import-secret") !== importSecret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const status = await startRetentionImport();

    res.status(202).json({
      success: true,
      message: "Import started",
      status
    });

  } catch (error) {
    res.status(409).json({
      success: false,
      message: error.message
    });
  }
});

// Check import progress
router.get("/status", (req, res) => {
  res.json({
    success: true,
    status: getImportStatus()
  });
});

module.exports = router;
