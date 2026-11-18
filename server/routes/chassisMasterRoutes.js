const express = require("express");
const router = express.Router();

const {
  getChassisMaster,
  getChassisMasterDetails
} = require("../controllers/chassisMasterController");

const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getChassisMaster);

router.get("/:chassisNumber", protect, getChassisMasterDetails);

module.exports = router;