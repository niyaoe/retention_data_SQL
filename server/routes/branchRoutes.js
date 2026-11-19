
const express = require("express");
const multer = require("multer");

const {
  getBranches,
  importBranches,
  createBranch,
  updateBranch,
  updateBranchStatus,
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

router.get("/", protect, getBranches);

router.post("/", protect, authorize("admin"), createBranch);

router.put("/:id", protect, authorize("admin"), updateBranch);

router.patch(
  "/:id/status",
  protect,
  authorize("admin"),
  updateBranchStatus
);

router.post(
  "/import",
  protect,
  authorize("admin"),
  upload.single("file"),
  importBranches
);

module.exports = router;
