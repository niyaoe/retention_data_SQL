
const express = require("express");

const {
  createUser,
  getUsers,
  updateUser,
  updateUserStatus
} = require("../controllers/userController");

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

const router = express.Router();

// All user management routes require admin access
router.use(protect, authorize("admin"));

// Create a new user
router.post("/", createUser);

// Get all users
router.get("/", getUsers);

// Update user details and branch assignment
router.put("/:id", updateUser);

// Activate / deactivate user
router.patch("/:id/status", updateUserStatus);

module.exports = router;
