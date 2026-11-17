
const express = require("express");

const {
  login,
  getMe
} = require("../controllers/authController");

const {
  protect
} = require("../middleware/authMiddleware");

const router = express.Router();

// Public login
router.post("/login", login);

// Protected logged-in user profile
router.get("/me", protect, getMe);

module.exports = router;

