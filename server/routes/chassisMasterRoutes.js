const express = require("express");
const router = express.Router();

const {
  getChassisMaster,
  getChassisMasterDetails,
  updateSalesContactDetails
} = require("../controllers/chassisMasterController");

const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getChassisMaster);

router.get("/:chassisNumber", protect, getChassisMasterDetails);

router.put(
  "/:chassisNumber/sales-contact",
  protect,
  updateSalesContactDetails
);

module.exports = router;