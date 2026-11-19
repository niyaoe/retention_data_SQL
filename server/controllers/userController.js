
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");

// Get user with branch information
const getUserById = async (id) => {
  const [rows] = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.phone,
        u.role,
        u.branch_id,
        u.is_active,
        u.created_at,
        u.updated_at,
        b.branch_name,
        b.location_code,
        b.branch_short
      FROM users u
      LEFT JOIN branch_master b
        ON b.id = u.branch_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [id]
  );

  if (!rows.length) return null;

  const row = rows[0];

  const branch = row.branch_id
    ? {
        _id: row.branch_id,
        id: row.branch_id,
        branchName: row.branch_name,
        locationCode: row.location_code,
        branchShort: row.branch_short,
      }
    : null;

  return {
    _id: row.id,
    id: row.id,
    username: row.username,
    name: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    branchId: branch,
    status: Number(row.is_active) === 1 ? "active" : "inactive",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// CREATE USER
const createUser = async (req, res) => {
  try {
    const { name, email, password, branchId } = req.body;

    if (!name || !email || !password || !branchId) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password and branch are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();
    const normalizedBranchId = Number(branchId);

    if (!normalizedName || !normalizedEmail || !Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid user and branch details.",
      });
    }

    const [existingUsers] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail]
    );

    if (existingUsers.length) {
      return res.status(409).json({
        success: false,
        message: "Email already exists.",
      });
    }

    const [branches] = await pool.query(
      `
        SELECT id
        FROM branch_master
        WHERE id = ? AND is_active = 1
        LIMIT 1
      `,
      [normalizedBranchId]
    );

    if (!branches.length) {
      return res.status(404).json({
        success: false,
        message: "Active branch not found.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Existing schema requires username.
    // Email is used as the unique username.
    const [result] = await pool.query(
      `
        INSERT INTO users
        (
          username,
          email,
          password_hash,
          full_name,
          role,
          branch_id,
          is_active
        )
        VALUES (?, ?, ?, ?, 'user', ?, 1)
      `,
      [
        normalizedEmail,
        normalizedEmail,
        hashedPassword,
        normalizedName,
        normalizedBranchId,
      ]
    );

    const createdUser = await getUserById(result.insertId);

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      user: createdUser,
    });

  } catch (error) {
    console.error("Create user error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create user.",
    });
  }
};

// GET ALL USERS
const getUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT id
        FROM users
        ORDER BY created_at DESC, id DESC
      `
    );

    const users = await Promise.all(
      rows.map((row) => getUserById(row.id))
    );

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });

  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users.",
    });
  }
};

// UPDATE USER
const updateUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, password, branchId } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const user = await getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Admin accounts cannot be edited here.",
      });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty.",
        });
      }

      updates.push("full_name = ?");
      values.push(name.trim());
    }

    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({
          success: false,
          message: "Email cannot be empty.",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const [existingUsers] = await pool.query(
        "SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1",
        [normalizedEmail, id]
      );

      if (existingUsers.length) {
        return res.status(409).json({
          success: false,
          message: "Email already exists.",
        });
      }

      updates.push("email = ?", "username = ?");
      values.push(normalizedEmail, normalizedEmail);
    }

    if (branchId !== undefined) {
      const normalizedBranchId = Number(branchId);

      if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Please select a valid branch.",
        });
      }

      const [branches] = await pool.query(
        `
          SELECT id
          FROM branch_master
          WHERE id = ? AND is_active = 1
          LIMIT 1
        `,
        [normalizedBranchId]
      );

      if (!branches.length) {
        return res.status(404).json({
          success: false,
          message: "Active branch not found.",
        });
      }

      updates.push("branch_id = ?");
      values.push(normalizedBranchId);
    }

    if (password !== undefined && password !== "") {
      if (typeof password !== "string" || password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least 8 characters.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      updates.push("password_hash = ?");
      values.push(hashedPassword);
    }

    if (updates.length > 0) {
      values.push(id);

      await pool.query(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        values
      );
    }

    const updatedUser = await getUserById(id);

    return res.status(200).json({
      success: true,
      message: "User updated successfully.",
      user: updatedUser,
    });

  } catch (error) {
    console.error("Update user error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update user.",
    });
  }
};

// ACTIVATE / DEACTIVATE USER
const updateUserStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or inactive.",
      });
    }

    const user = await getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Admin account status cannot be changed here.",
      });
    }

    await pool.query(
      "UPDATE users SET is_active = ? WHERE id = ?",
      [status === "active" ? 1 : 0, id]
    );

    const updatedUser = await getUserById(id);

    return res.status(200).json({
      success: true,
      message: `User ${status} successfully.`,
      user: updatedUser,
    });

  } catch (error) {
    console.error("Update user status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user status.",
    });
  }
};

module.exports = {
  createUser,
  getUsers,
  updateUser,
  updateUserStatus,
};
