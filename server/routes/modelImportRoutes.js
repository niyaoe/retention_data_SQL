
const express = require("express");
const multer = require("multer");

const { protect, authorize } = require("../middleware/authMiddleware");
const { importModels } = require("../controllers/modelImportController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const extension = file.originalname
      .split(".")
      .pop()
      .toLowerCase();

    if (!["xlsx", "xls"].includes(extension)) {
      return callback(
        new Error("Only Excel files are allowed.")
      );
    }

    callback(null, true);
  }
});

router.post(
  "/import",
  protect,
  authorize("admin"),
  upload.single("file"),
  importModels
);

module.exports = router;
