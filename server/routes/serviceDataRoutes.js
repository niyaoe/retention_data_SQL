
const express = require("express");
const router = express.Router();

const {
  getServiceData,
  exportServiceData,
  exportServiceDataCSV
} = require("../controllers/serviceDataController");

const { protect } = require("../middleware/authMiddleware");

// Public export endpoints
router.get("/export", exportServiceData);
router.get("/export.csv", exportServiceDataCSV);

// Existing protected endpoint
router.get("/", protect, getServiceData);

module.exports = router;
