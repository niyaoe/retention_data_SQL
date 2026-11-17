
const express = require("express");
const multer = require("multer");

const {
  previewSalesExcel,
  importSalesExcel
} = require("../controllers/salesExcelController");

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const allowedExtensions = [".xlsx", ".xls"];
    const extension = file.originalname
      .toLowerCase()
      .slice(file.originalname.lastIndexOf("."));

    if (!allowedExtensions.includes(extension)) {
      return callback(
        new Error("Only .xlsx and .xls Excel files are allowed.")
      );
    }

    callback(null, true);
  }
});

router.post(
  "/preview",
  protect,
  authorize("admin"),
  upload.single("file"),
  previewSalesExcel
);

router.post(
  "/import",
  protect,
  authorize("admin"),
  upload.single("file"),
  importSalesExcel
);

module.exports = router;
