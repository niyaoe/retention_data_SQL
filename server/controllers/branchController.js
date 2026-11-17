
const Branch = require("../models/Branch");
const XLSX = require("xlsx");

// ========================================
// GET ALL BRANCHES
// ========================================

const getBranches = async (req, res) => {
  try {
    const branches = await Branch.find()
      .sort({ branchName: 1 });

    res.status(200).json({
      success: true,
      count: branches.length,
      branches
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ========================================
// IMPORT BRANCHES FROM EXCEL
// ========================================

const importBranches = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an Excel file"
      });
    }

    // Read uploaded Excel from memory
    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer"
    });

    // Only use Branch_list worksheet
    const worksheet = workbook.Sheets["Branch_list"];

    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: "Branch_list worksheet not found"
      });
    }

    const rows = XLSX.utils.sheet_to_json(
      worksheet,
      {
        defval: "",
        raw: false
      }
    );

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "No branch records found in Excel"
      });
    }

    const clean = (value) =>
      String(value ?? "").trim();

    const requiredHeaders = [
      "District",
      "Branch name",
      "Location code",
      "Branch-Short"
    ];

    const availableHeaders = Object.keys(rows[0]);

    const missingHeaders = requiredHeaders.filter(
      (header) => !availableHeaders.includes(header)
    );

    if (missingHeaders.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid Excel format",
        missingHeaders
      });
    }

    const operations = [];

    const locationCodes = new Set();
    const branchShorts = new Set();

    // Validate and map Excel rows
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      const branch = {
        district: clean(row["District"]),
        branchName: clean(row["Branch name"]),
        locationCode: clean(row["Location code"]),
        dmsName: clean(row["DMS Name"]),
        mdReportName: clean(row["For MD Report"]),
        branchShort: clean(row["Branch-Short"]).toUpperCase(),
        slC: clean(row["Sl.C"]),
        slB: clean(row["Sl.B"]),
        aopDistrict: clean(row["AOP-District"]),
        bsZone: clean(row["BS Zone"]),
        dCode: clean(row["D-Code"]),
        preH2: clean(row["PRE-H2"])
      };

      if (
        !branch.district ||
        !branch.branchName ||
        !branch.locationCode ||
        !branch.branchShort
      ) {
        return res.status(400).json({
          success: false,
          message: `Required branch fields missing at Excel row ${index + 2}`
        });
      }

      if (locationCodes.has(branch.locationCode)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate location code: ${branch.locationCode}`
        });
      }

      if (branchShorts.has(branch.branchShort)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate branch short: ${branch.branchShort}`
        });
      }

      locationCodes.add(branch.locationCode);
      branchShorts.add(branch.branchShort);

      operations.push({
        updateOne: {
          filter: {
            locationCode: branch.locationCode
          },

          update: {
            $set: branch,

            $setOnInsert: {
              status: "active"
            }
          },

          upsert: true
        }
      });
    }

    // Check existing branch-short conflicts
    const existingBranches = await Branch.find({
      branchShort: { $in: [...branchShorts] }
    }).select("locationCode branchShort");

    for (const existing of existingBranches) {
      const uploadedBranch = rows.find(
        (row) =>
          clean(row["Branch-Short"]).toUpperCase() ===
          existing.branchShort
      );

      if (
        uploadedBranch &&
        clean(uploadedBranch["Location code"]) !==
          existing.locationCode
      ) {
        return res.status(409).json({
          success: false,
          message:
            `Branch short ${existing.branchShort} already belongs to another branch`
        });
      }
    }

    // Ensure unique indexes exist
    await Branch.init();

    // Import or update branches
    const result = await Branch.bulkWrite(
      operations,
      { ordered: true }
    );

    const totalImported = await Branch.countDocuments({
      locationCode: { $in: [...locationCodes] }
    });

    res.status(200).json({
      success: true,
      message: "Branch Excel import completed successfully",

      summary: {
        excelRows: rows.length,
        inserted: result.upsertedCount,
        updated: result.modifiedCount,
        matched: result.matchedCount,
        totalVerified: totalImported
      }
    });

  } catch (error) {
    console.error("Branch import error:", error);

    res.status(500).json({
      success: false,
      message: "Branch import failed",
      error: error.message
    });
  }
};

module.exports = {
  getBranches,
  importBranches
};
