
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { testMySQLConnection } = require("./config/db");
const connectMongo = require("./config/mongo");

const sqlRoutes = require("./routes/sqlRoutes");
const analysisRoutes = require("./routes/analysisRoutes");
const mongoRoutes = require("./routes/mongoRoutes");
const importRoutes = require("./routes/importRoutes");
// const { startAutoSync } = require("./services/syncService");
const authRoutes = require("./routes/authRoutes");
const branchRoutes = require("./routes/branchRoutes");
const userRoutes = require("./routes/userRoutes");
const salesDataRoutes = require("./routes/salesDataRoutes");
const serviceDataRoutes = require("./routes/serviceDataRoutes");
const chassisMasterRoutes = require("./routes/chassisMasterRoutes");
const salesExcelRoutes = require("./routes/salesExcelRoutes");
const modelRoutes = require("./routes/modelRoutes");
const modelImportRoutes = require("./routes/modelImportRoutes");
const salesApiSyncRoutes = require("./routes/salesApiSyncRoutes");
const serviceExcelRoutes = require("./routes/serviceExcelRoutes");
const { startSalesAutoSync } = require("./services/salesAutoSyncService");
const dmsRetailRoutes = require("./routes/dmsRetailRoutes");
const serviceApiSyncRoutes = require("./routes/serviceApiSyncRoutes");
const {
  startServiceApiAutoSync,
} = require("./services/serviceApiAutoSyncService");
const {
  startDmsRetailAutoSync,
} = require("./services/dmsRetailAutoSyncService");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Retention Data API is running"
  });
});
app.use("/api/sql", sqlRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/mongo", mongoRoutes);
// app.use("/api/import", importRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/users", userRoutes);
app.use("/api/sales-data", salesDataRoutes);
app.use("/api/service-data", serviceDataRoutes);
app.use("/api/chassis-master", chassisMasterRoutes);
app.use("/api/sales-excel", salesExcelRoutes);
app.use("/api/models", modelRoutes);
app.use("/api/model-import", modelImportRoutes);
app.use("/api/sales-api-sync", salesApiSyncRoutes);
app.use("/api/service-excel", serviceExcelRoutes);
app.use("/api/dms-retail", dmsRetailRoutes);
app.use("/api/service-api-sync", serviceApiSyncRoutes);


const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectMongo();
    await testMySQLConnection();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);

      startSalesAutoSync();
      startDmsRetailAutoSync();
      startServiceApiAutoSync();


    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();