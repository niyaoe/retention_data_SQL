const express = require("express");
const router = express.Router();

const {
  getSalesMaster,
  getSalesMasterDetails
} = require("../controllers/salesMasterController");

const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getSalesMaster);

router.get("/:chassisNumber", protect, getSalesMasterDetails);

module.exports = router;