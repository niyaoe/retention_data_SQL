
const express = require("express");
const router = express.Router();

const { protect, authorize } = require("../middleware/authMiddleware");
const {
    syncServiceFromAPI,
} = require("../controllers/serviceApiSyncController");

router.post("/sync", protect, authorize("admin"), syncServiceFromAPI);

module.exports = router;
