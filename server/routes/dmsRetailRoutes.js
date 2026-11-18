
const express = require("express");
const router = express.Router();

const {
  getDmsRetail,
  syncDmsRetail,
} = require("../controllers/dmsRetailController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

// View records
router.get("/", protect, getDmsRetail);

// Manual sync - admin only
router.post(
  "/sync",
  protect,
  authorize("admin"),
  syncDmsRetail
);

module.exports = router;
