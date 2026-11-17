
const express = require("express");
const router = express.Router();

const { syncSalesFromAPI } = require("../controllers/salesApiSyncController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/sync",
  protect,
  authorize("admin"),
  syncSalesFromAPI
);

module.exports = router;
