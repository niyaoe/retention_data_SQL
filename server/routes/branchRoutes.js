
const express = require("express");
const multer = require("multer");

const {
  getBranches,
  importBranches
} = require("../controllers/branchController");

// These middleware exports will be created
// in our authentication step.
const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const allowed = /\.(xlsx|xls)$/i.test(
      file.originalname
    );

    if (!allowed) {
      return cb(
        new Error("Only Excel files are allowed")
      );
    }

    cb(null, true);
  }
});

// Admin and authenticated users can view branches
router.get("/", protect, getBranches);

// Only admin can import branches
router.post(
  "/import",
  protect,
  authorize("admin"),
  upload.single("file"),
  importBranches
);

module.exports = router;
