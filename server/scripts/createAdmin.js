
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");

async function createAdmin() {
  try {
    const username = process.env.ADMIN_USERNAME?.trim();
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const fullName = process.env.ADMIN_NAME?.trim() || "Administrator";

    if (!username || !email || !password) {
      throw new Error(
        "ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD are required."
      );
    }

    if (password.length < 8) {
      throw new Error("Password must contain at least 8 characters.");
    }

    const [existing] = await pool.query(
      `SELECT id FROM users
       WHERE username = ? OR email = ?
       LIMIT 1`,
      [username, email]
    );

    if (existing.length) {
      throw new Error("Username or email already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO users
       (username, email, password_hash, full_name, role, branch_id, is_active)
       VALUES (?, ?, ?, ?, 'admin', NULL, 1)`,
      [username, email, passwordHash, fullName]
    );

    console.log("Admin account created successfully.");

  } catch (error) {
    console.error("Admin creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createAdmin();
