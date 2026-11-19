
const { pool } = require("../config/db");
const XLSX = require("xlsx");

// ========================================
// FORMAT BRANCH RESPONSE
// ========================================

const formatBranch = (row) => ({
  _id: row.id,
  id: row.id,
  district: row.district,
  branchName: row.branch_name,
  locationCode: row.location_code,
  dmsName: row.dms_name,
  mdReportName: row.for_md_report,
  branchShort: row.branch_short,
  slC: row.sl_c,
  slB: row.sl_b,
  aopDistrict: row.aop_district,
  bsZone: row.bs_zone,
  dCode: row.d_code,
  preH2: row.pre_h2,
  status: Number(row.is_active) === 1 ? "active" : "inactive",
});

// ========================================
// GET ALL BRANCHES
// ========================================

const getBranches = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        district,
        branch_name,
        location_code,
        dms_name,
        for_md_report,
        branch_short,
        sl_c,
        sl_b,
        aop_district,
        bs_zone,
        d_code,
        pre_h2,
        is_active,
        created_at
      FROM branch_master
      ORDER BY branch_name ASC
    `);

    const branches = rows.map(formatBranch);

    return res.status(200).json({
      success: true,
      count: branches.length,
      branches,
    });

  } catch (error) {
    console.error("Get branches error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch branches.",
    });
  }
};

// ========================================
// IMPORT BRANCHES FROM EXCEL
// ========================================

const importBranches = async (req, res) => {
  let connection;
  let transactionStarted = false;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an Excel file.",
      });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
    });

    const worksheet = workbook.Sheets["Branch_list"];

    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: "Branch_list worksheet not found.",
      });
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
      raw: false,
    });

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "No branch records found in Excel.",
      });
    }

    const clean = (value) => String(value ?? "").trim();

    const requiredHeaders = [
      "District",
      "Branch name",
      "Location code",
      "Branch-Short",
    ];

    const availableHeaders = Object.keys(rows[0]);

    const missingHeaders = requiredHeaders.filter(
      (header) => !availableHeaders.includes(header)
    );

    if (missingHeaders.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid Excel format.",
        missingHeaders,
      });
    }

    const locationCodes = new Set();
    const branchShorts = new Set();
    const mappedBranches = [];

    // Validate Excel rows
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
        preH2: clean(row["PRE-H2"]),
      };

      if (
        !branch.district ||
        !branch.branchName ||
        !branch.locationCode ||
        !branch.branchShort
      ) {
        return res.status(400).json({
          success: false,
          message: `Required branch fields missing at Excel row ${index + 2}.`,
        });
      }

      if (locationCodes.has(branch.locationCode)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate location code: ${branch.locationCode}`,
        });
      }

      if (branchShorts.has(branch.branchShort)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate branch short: ${branch.branchShort}`,
        });
      }

      locationCodes.add(branch.locationCode);
      branchShorts.add(branch.branchShort);

      mappedBranches.push(branch);
    }

    // Check existing branch-short conflicts
    const [existingBranches] = await pool.query(
      `
        SELECT location_code, branch_short
        FROM branch_master
        WHERE UPPER(branch_short) IN (?)
      `,
      [[...branchShorts]]
    );

    const existingShortMap = new Map(
      existingBranches.map((branch) => [
        String(branch.branch_short).toUpperCase(),
        branch.location_code,
      ])
    );

    for (const branch of mappedBranches) {
      const existingLocation = existingShortMap.get(
        branch.branchShort
      );

      if (
        existingLocation &&
        existingLocation !== branch.locationCode
      ) {
        return res.status(409).json({
          success: false,
          message: `Branch short ${branch.branchShort} already belongs to another branch.`,
        });
      }
    }

    // ========================================
    // DATABASE IMPORT
    // ========================================

    connection = await pool.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    let inserted = 0;
    let updated = 0;

    for (const branch of mappedBranches) {
      const [existing] = await connection.query(
        `
          SELECT id
          FROM branch_master
          WHERE location_code = ?
          ORDER BY id
          LIMIT 1
          FOR UPDATE
        `,
        [branch.locationCode]
      );

      if (existing.length) {
        // Update existing branch.
        // Preserve its current is_active status.
        await connection.query(
          `
            UPDATE branch_master
            SET
              district = ?,
              branch_name = ?,
              dms_name = ?,
              for_md_report = ?,
              branch_short = ?,
              sl_c = ?,
              sl_b = ?,
              aop_district = ?,
              bs_zone = ?,
              d_code = ?,
              pre_h2 = ?
            WHERE id = ?
          `,
          [
            branch.district,
            branch.branchName,
            branch.dmsName || null,
            branch.mdReportName || null,
            branch.branchShort,
            branch.slC || null,
            branch.slB || null,
            branch.aopDistrict || null,
            branch.bsZone || null,
            branch.dCode || null,
            branch.preH2 || null,
            existing[0].id,
          ]
        );

        updated++;

      } else {
        // Insert new branch as active
        await connection.query(
          `
            INSERT INTO branch_master
            (
              district,
              branch_name,
              location_code,
              dms_name,
              for_md_report,
              branch_short,
              sl_c,
              sl_b,
              aop_district,
              bs_zone,
              d_code,
              pre_h2,
              is_active
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          `,
          [
            branch.district,
            branch.branchName,
            branch.locationCode,
            branch.dmsName || null,
            branch.mdReportName || null,
            branch.branchShort,
            branch.slC || null,
            branch.slB || null,
            branch.aopDistrict || null,
            branch.bsZone || null,
            branch.dCode || null,
            branch.preH2 || null,
          ]
        );

        inserted++;
      }
    }

    await connection.commit();
    transactionStarted = false;

    const [verified] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM branch_master
        WHERE location_code IN (?)
      `,
      [[...locationCodes]]
    );

    return res.status(200).json({
      success: true,
      message: "Branch Excel import completed successfully.",
      summary: {
        excelRows: rows.length,
        inserted,
        updated,
        matched: updated,
        totalVerified: Number(verified[0].total),
      },
    });

  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    console.error("Branch import error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Duplicate branch location code or branch short.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Branch import failed.",
      error: error.message,
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
};


// ========================================
// CREATE BRANCH
// ========================================

const createBranch = async (req, res) => {
  try {
    const clean = (value) => String(value ?? "").trim();

    const branch = {
      district: clean(req.body.district),
      branchName: clean(req.body.branchName),
      locationCode: clean(req.body.locationCode),
      dmsName: clean(req.body.dmsName),
      mdReportName: clean(req.body.mdReportName),
      branchShort: clean(req.body.branchShort).toUpperCase(),
      slC: clean(req.body.slC),
      slB: clean(req.body.slB),
      aopDistrict: clean(req.body.aopDistrict),
      bsZone: clean(req.body.bsZone),
      dCode: clean(req.body.dCode),
      preH2: clean(req.body.preH2),
    };

    if (
      !branch.district ||
      !branch.branchName ||
      !branch.locationCode ||
      !branch.branchShort
    ) {
      return res.status(400).json({
        success: false,
        message: "District, branch name, location code and branch short are required.",
      });
    }

    const [duplicates] = await pool.query(
      `SELECT id, branch_name, location_code, branch_short
       FROM branch_master
       WHERE location_code = ? OR UPPER(branch_short) = ?
       LIMIT 1`,
      [branch.locationCode, branch.branchShort]
    );

    if (duplicates.length) {
      return res.status(409).json({
        success: false,
        message: "Location code or branch short already exists.",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO branch_master (
        district, branch_name, location_code, dms_name,
        for_md_report, branch_short, sl_c, sl_b,
        aop_district, bs_zone, d_code, pre_h2, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        branch.district,
        branch.branchName,
        branch.locationCode,
        branch.dmsName || null,
        branch.mdReportName || null,
        branch.branchShort,
        branch.slC || null,
        branch.slB || null,
        branch.aopDistrict || null,
        branch.bsZone || null,
        branch.dCode || null,
        branch.preH2 || null,
      ]
    );

    const [rows] = await pool.query(
      `SELECT * FROM branch_master WHERE id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Branch created successfully.",
      branch: formatBranch(rows[0]),
    });
  } catch (error) {
    console.error("Create branch error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create branch.",
    });
  }
};


// ========================================
// UPDATE BRANCH
// ========================================

const updateBranch = async (req, res) => {
  try {
    const branchId = Number(req.params.id);

    if (!Number.isInteger(branchId) || branchId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID.",
      });
    }

    const clean = (value) => String(value ?? "").trim();

    const branch = {
      district: clean(req.body.district),
      branchName: clean(req.body.branchName),
      locationCode: clean(req.body.locationCode),
      dmsName: clean(req.body.dmsName),
      mdReportName: clean(req.body.mdReportName),
      branchShort: clean(req.body.branchShort).toUpperCase(),
      slC: clean(req.body.slC),
      slB: clean(req.body.slB),
      aopDistrict: clean(req.body.aopDistrict),
      bsZone: clean(req.body.bsZone),
      dCode: clean(req.body.dCode),
      preH2: clean(req.body.preH2),
    };

    if (
      !branch.district ||
      !branch.branchName ||
      !branch.locationCode ||
      !branch.branchShort
    ) {
      return res.status(400).json({
        success: false,
        message: "District, branch name, location code and branch short are required.",
      });
    }

    const [existing] = await pool.query(
      `SELECT id FROM branch_master WHERE id = ? LIMIT 1`,
      [branchId]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: "Branch not found.",
      });
    }

    const [duplicates] = await pool.query(
      `SELECT id FROM branch_master
       WHERE id <> ?
       AND (location_code = ? OR UPPER(branch_short) = ?)
       LIMIT 1`,
      [branchId, branch.locationCode, branch.branchShort]
    );

    if (duplicates.length) {
      return res.status(409).json({
        success: false,
        message: "Location code or branch short already belongs to another branch.",
      });
    }

    await pool.query(
      `UPDATE branch_master SET
        district = ?,
        branch_name = ?,
        location_code = ?,
        dms_name = ?,
        for_md_report = ?,
        branch_short = ?,
        sl_c = ?,
        sl_b = ?,
        aop_district = ?,
        bs_zone = ?,
        d_code = ?,
        pre_h2 = ?
       WHERE id = ?`,
      [
        branch.district,
        branch.branchName,
        branch.locationCode,
        branch.dmsName || null,
        branch.mdReportName || null,
        branch.branchShort,
        branch.slC || null,
        branch.slB || null,
        branch.aopDistrict || null,
        branch.bsZone || null,
        branch.dCode || null,
        branch.preH2 || null,
        branchId,
      ]
    );

    const [rows] = await pool.query(
      `SELECT * FROM branch_master WHERE id = ?`,
      [branchId]
    );

    return res.status(200).json({
      success: true,
      message: "Branch updated successfully.",
      branch: formatBranch(rows[0]),
    });
  } catch (error) {
    console.error("Update branch error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update branch.",
    });
  }
};


// ========================================
// ACTIVATE / DEACTIVATE BRANCH
// ========================================

const updateBranchStatus = async (req, res) => {
  try {
    const branchId = Number(req.params.id);
    const isActive = req.body.isActive;

    if (!Number.isInteger(branchId) || branchId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID.",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false.",
      });
    }

    const [result] = await pool.query(
      `UPDATE branch_master
       SET is_active = ?
       WHERE id = ?`,
      [isActive ? 1 : 0, branchId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Branch not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Branch ${isActive ? "activated" : "deactivated"} successfully.`,
      status: isActive ? "active" : "inactive",
    });
  } catch (error) {
    console.error("Update branch status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update branch status.",
    });
  }
};


module.exports = {
  getBranches,
  importBranches,
  createBranch,
  updateBranch,
  updateBranchStatus,
};