
const express = require("express");
const router = express.Router();

const { getSalesData } = require("../controllers/salesDataController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getSalesData);

module.exports = router;
