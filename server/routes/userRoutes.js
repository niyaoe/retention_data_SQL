
const express = require("express");

const {
  createUser,
  getUsers,
  updateUser,
  updateUserStatus,
} = require("../controllers/userController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

// All user management routes require admin access
router.use(protect, authorize("admin"));

router.post("/", createUser);
router.get("/", getUsers);
router.put("/:id", updateUser);
router.patch("/:id/status", updateUserStatus);

module.exports = router;
