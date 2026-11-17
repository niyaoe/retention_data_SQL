
const express = require("express");
const multer = require("multer");

const {
    previewServiceExcel,
    upsertServiceData,
} = require("../controllers/serviceExcelController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        const allowed =
            file.originalname.toLowerCase().endsWith(".xlsx") ||
            file.originalname.toLowerCase().endsWith(".xls");

        if (!allowed) {
            return cb(new Error("Only Excel files (.xlsx, .xls) are allowed."));
        }

        cb(null, true);
    },
});

router.post(
    "/preview",
    protect,
    authorize("admin"),
    upload.single("file"),
    previewServiceExcel
);

router.post(
    "/upsert",
    protect,
    authorize("admin"),
    upload.single("file"),
    upsertServiceData
);

module.exports = router;
