
const express = require("express");
const router = express.Router();

const {
  getServiceData
} = require("../controllers/serviceDataController");

const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getServiceData);

module.exports = router;
