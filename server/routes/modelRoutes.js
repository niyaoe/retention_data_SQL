
const express = require("express");
const router = express.Router();

const {
  getModels,
  createModel,
  updateModel,
  toggleModelStatus
} = require("../controllers/modelController");

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

router.get("/", protect, getModels);

router.post(
  "/",
  protect,
  authorize("admin"),
  createModel
);

router.put(
  "/:id",
  protect,
  authorize("admin"),
  updateModel
);

router.patch(
  "/:id/status",
  protect,
  authorize("admin"),
  toggleModelStatus
);

module.exports = router;
