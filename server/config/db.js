
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  connectTimeout: 15000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

pool.on("connection", () => {
  console.log("MySQL pool: New connection established");
});

pool.on("error", (error) => {
  console.error("MySQL pool error:", error.message);
});

const testMySQLConnection = async () => {
  let connection;

  try {
    connection = await pool.getConnection();

    await connection.ping();

    console.log("MySQL connected successfully!");
  } catch (error) {
    console.error("MySQL connection failed:", error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  pool,
  testMySQLConnection
};
