
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Branch = require("../models/Branch");

// CREATE USER
const createUser = async (req, res) => {
  try {
    const { name, email, password, branchId } = req.body;

    if (!name || !email || !password || !branchId) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password and branch are required."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists."
      });
    }

    const branch = await Branch.findOne({
      _id: branchId,
      status: "active"
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Active branch not found."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "user",
      branchId,
      status: "active"
    });

    const createdUser = await User.findById(user._id)
      .select("-password")
      .populate("branchId", "branchName locationCode branchShort");

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      user: createdUser
    });

  } catch (error) {
    console.error("Create user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create user."
    });
  }
};

// GET ALL USERS
const getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("branchId", "branchName locationCode branchShort")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users
    });

  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users."
    });
  }
};


const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, branchId } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    // Only normal users can be edited through this endpoint
    if (user.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Admin accounts cannot be edited here."
      });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty."
        });
      }
      user.name = name.trim();
    }

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: "Email cannot be empty."
        });
      }

      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: id }
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email already exists."
        });
      }

      user.email = normalizedEmail;
    }

    if (branchId !== undefined) {
      const branch = await Branch.findOne({
        _id: branchId,
        status: "active"
      });

      if (!branch) {
        return res.status(404).json({
          success: false,
          message: "Active branch not found."
        });
      }

      user.branchId = branchId;
    }

    if (password !== undefined && password !== "") {
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least 8 characters."
        });
      }

      user.password = await bcrypt.hash(password, 12);
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select("-password")
      .populate("branchId", "branchName locationCode branchShort");

    return res.status(200).json({
      success: true,
      message: "User updated successfully.",
      user: updatedUser
    });

  } catch (error) {
    console.error("Update user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user."
    });
  }
};


const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or inactive."
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (user.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Admin account status cannot be changed here."
      });
    }

    user.status = status;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `User ${status} successfully.`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });

  } catch (error) {
    console.error("Update user status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user status."
    });
  }
};



module.exports = {
  createUser,
  getUsers,
  updateUser,
  updateUserStatus
};
