
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const connectMongo = require("../config/mongo");
const User = require("../models/User");

const createAdmin = async () => {
  try {
    await connectMongo();

    const name = process.env.ADMIN_NAME;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!name || !email || !password) {
      throw new Error(
        "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env"
      );
    }

    const existingAdmin = await User.findOne({
      email: email.toLowerCase()
    });

    if (existingAdmin) {
      console.log("Admin account already exists.");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "admin",
      branchId: null,
      status: "active"
    });

    console.log("Admin account created successfully.");

  } catch (error) {
    console.error("Admin creation failed:", error.message);
    process.exitCode = 1;

  } finally {
    await mongoose.disconnect();
  }
};

createAdmin();
