
const { pool } = require("../config/db");

// GET ALL ACTIVE CASE STATUSES
const getCaseStatuses = async (req, res) => {
    try {
        const [statuses] = await pool.query(`
      SELECT
        id,
        status_name,
        is_active
      FROM call_case_statuses
      WHERE is_active = 1
      ORDER BY status_name ASC
    `);

        res.json({
            success: true,
            statuses,
        });
    } catch (error) {
        console.error("Get case statuses error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load case statuses",
        });
    }
};


// CREATE CASE STATUS
const createCaseStatus = async (req, res) => {
    try {
        const { statusName } = req.body;

        if (!statusName || !statusName.trim()) {
            return res.status(400).json({
                success: false,
                message: "Case status name is required",
            });
        }

        const name = statusName.trim();

        const [existing] = await pool.query(
            `SELECT id FROM call_case_statuses
       WHERE LOWER(status_name) = LOWER(?)
       LIMIT 1`,
            [name]
        );

        if (existing.length) {
            return res.status(409).json({
                success: false,
                message: "This case status already exists",
            });
        }

        const [result] = await pool.query(
            `INSERT INTO call_case_statuses
       (status_name, created_by)
       VALUES (?, ?)`,
            [name, String(req.user.id)]
        );

        res.status(201).json({
            success: true,
            message: "Case status created successfully",
            status: {
                id: result.insertId,
                statusName: name,
            },
        });
    } catch (error) {
        console.error("Create case status error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to create case status",
        });
    }
};


// UPDATE / ACTIVATE / DEACTIVATE CASE STATUS
const updateCaseStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { statusName, isActive } = req.body;

        const [rows] = await pool.query(
            `SELECT id FROM call_case_statuses WHERE id = ?`,
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Case status not found",
            });
        }

        if (
            statusName === undefined &&
            isActive === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Nothing to update",
            });
        }

        if (statusName !== undefined) {
            if (!statusName.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Status name cannot be empty",
                });
            }

            const [duplicate] = await pool.query(
                `SELECT id FROM call_case_statuses
         WHERE LOWER(status_name) = LOWER(?)
         AND id != ?
         LIMIT 1`,
                [statusName.trim(), id]
            );

            if (duplicate.length) {
                return res.status(409).json({
                    success: false,
                    message: "This status name already exists",
                });
            }
        }

        if (
            isActive !== undefined &&
            ![0, 1, true, false].includes(isActive)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid active status",
            });
        }

        const updates = [];
        const values = [];

        if (statusName !== undefined) {
            updates.push("status_name = ?");
            values.push(statusName.trim());
        }

        if (isActive !== undefined) {
            updates.push("is_active = ?");
            values.push(isActive ? 1 : 0);
        }

        values.push(id);

        await pool.query(
            `UPDATE call_case_statuses
       SET ${updates.join(", ")}
       WHERE id = ?`,
            values
        );

        res.json({
            success: true,
            message: "Case status updated successfully",
        });
    } catch (error) {
        console.error("Update case status error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update case status",
        });
    }
};


// GET SUBSTATUSES FOR A SELECTED STATUS
const getCaseSubstatuses = async (req, res) => {
    try {
        const { id } = req.params;

        const [statuses] = await pool.query(
            `SELECT id FROM call_case_statuses
       WHERE id = ? AND is_active = 1`,
            [id]
        );

        if (!statuses.length) {
            return res.status(404).json({
                success: false,
                message: "Case status not found or inactive",
            });
        }

        const [substatuses] = await pool.query(
            `SELECT id, status_id, substatus_name, is_active
       FROM call_case_substatuses
       WHERE status_id = ? AND is_active = 1
       ORDER BY substatus_name ASC`,
            [id]
        );

        res.json({
            success: true,
            substatuses,
        });
    } catch (error) {
        console.error("Get substatuses error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load case substatuses",
        });
    }
};


// CREATE CASE SUBSTATUS
const createCaseSubstatus = async (req, res) => {
    try {
        const { statusId, substatusName } = req.body;

        if (!statusId || !substatusName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Status and substatus name are required",
            });
        }

        const [statuses] = await pool.query(
            `SELECT id FROM call_case_statuses
       WHERE id = ? AND is_active = 1`,
            [statusId]
        );

        if (!statuses.length) {
            return res.status(404).json({
                success: false,
                message: "Active case status not found",
            });
        }

        const name = substatusName.trim();

        const [existing] = await pool.query(
            `SELECT id FROM call_case_substatuses
       WHERE status_id = ?
       AND LOWER(substatus_name) = LOWER(?)
       LIMIT 1`,
            [statusId, name]
        );

        if (existing.length) {
            return res.status(409).json({
                success: false,
                message: "This substatus already exists for this status",
            });
        }

        const [result] = await pool.query(
            `INSERT INTO call_case_substatuses
       (status_id, substatus_name, created_by)
       VALUES (?, ?, ?)`,
            [statusId, name, String(req.user.id)]
        );

        res.status(201).json({
            success: true,
            message: "Case substatus created successfully",
            substatus: {
                id: result.insertId,
                statusId,
                substatusName: name,
            },
        });
    } catch (error) {
        console.error("Create substatus error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to create case substatus",
        });
    }
};


// UPDATE / ACTIVATE / DEACTIVATE SUBSTATUS
const updateCaseSubstatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { substatusName, isActive } = req.body;

        const [rows] = await pool.query(
            `SELECT id, status_id
       FROM call_case_substatuses
       WHERE id = ?`,
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Case substatus not found",
            });
        }

        if (
            substatusName === undefined &&
            isActive === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Nothing to update",
            });
        }

        if (substatusName !== undefined) {
            if (!substatusName.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Substatus name cannot be empty",
                });
            }

            const [duplicate] = await pool.query(
                `SELECT id FROM call_case_substatuses
         WHERE status_id = ?
         AND LOWER(substatus_name) = LOWER(?)
         AND id != ?
         LIMIT 1`,
                [rows[0].status_id, substatusName.trim(), id]
            );

            if (duplicate.length) {
                return res.status(409).json({
                    success: false,
                    message: "This substatus already exists",
                });
            }
        }

        if (
            isActive !== undefined &&
            ![0, 1, true, false].includes(isActive)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid active status",
            });
        }

        const updates = [];
        const values = [];

        if (substatusName !== undefined) {
            updates.push("substatus_name = ?");
            values.push(substatusName.trim());
        }

        if (isActive !== undefined) {
            updates.push("is_active = ?");
            values.push(isActive ? 1 : 0);
        }

        values.push(id);

        await pool.query(
            `UPDATE call_case_substatuses
       SET ${updates.join(", ")}
       WHERE id = ?`,
            values
        );

        res.json({
            success: true,
            message: "Case substatus updated successfully",
        });
    } catch (error) {
        console.error("Update substatus error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update case substatus",
        });
    }
};


// GET CURRENT CALL CASE FOR A CHASSIS
const getCallCase = async (req, res) => {
    try {
        const { chassisNumber } = req.params;

        const [rows] = await pool.query(
            `SELECT
        c.id,
        c.chassis_number,
        c.status_id,
        c.substatus_id,
        c.call_status,
        s.status_name,
        ss.substatus_name,
        DATE_FORMAT(c.contact_date, '%Y-%m-%d') AS contact_date,
        DATE_FORMAT(c.followup_date, '%Y-%m-%d') AS followup_date,
        c.assigned_to,
c.followup_completed_at,
u.full_name AS assigned_to_name,
        c.phone_number,
        c.pincode,
        c.customer_voice,
        c.updated_by,
        c.updated_by_name,
        c.created_at,
        c.updated_at
      FROM chassis_call_cases c
      LEFT JOIN call_case_statuses s ON s.id = c.status_id
      LEFT JOIN call_case_substatuses ss ON ss.id = c.substatus_id
      LEFT JOIN users u ON u.id = c.assigned_to
      WHERE c.chassis_number = ?
      LIMIT 1`,
            [chassisNumber]
        );

        res.json({
            success: true,
            callCase: rows[0] || null,
        });
    } catch (error) {
        console.error("Get call case error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load call case",
        });
    }
};


// CREATE OR UPDATE CALL CASE
const saveCallCase = async (req, res) => {
    let connection;
    let transactionStarted = false;

    try {

        connection = await pool.getConnection();

        const { chassisNumber } = req.params;

        const {
            statusId,
            substatusId,
            callStatus,
            contactDate,
            followupDate,
            phoneNumber,
            pincode,
            customerVoice,
        } = req.body;

        if (!chassisNumber || !chassisNumber.trim()) {


            return res.status(400).json({
                success: false,
                message: "Chassis number is required",
            });
        }

        const cleanChassisNumber = chassisNumber.trim().toUpperCase();

        const cleanStatusId =
            statusId === "" || statusId === undefined || statusId === null
                ? null
                : Number(statusId);

        const cleanSubstatusId =
            substatusId === "" || substatusId === undefined || substatusId === null
                ? null
                : Number(substatusId);

        if (
            cleanStatusId !== null &&
            (!Number.isInteger(cleanStatusId) || cleanStatusId <= 0)
        ) {


            return res.status(400).json({
                success: false,
                message: "Invalid case status",
            });
        }

        if (
            cleanSubstatusId !== null &&
            (!Number.isInteger(cleanSubstatusId) || cleanSubstatusId <= 0)
        ) {


            return res.status(400).json({
                success: false,
                message: "Invalid case substatus",
            });
        }

        if (cleanSubstatusId !== null && cleanStatusId === null) {


            return res.status(400).json({
                success: false,
                message: "Select a case status before selecting a substatus",
            });
        }
        const cleanCallStatus = String(callStatus || "").trim();

        const allowedCallStatuses = [
            "Closed",
            "Complaint",
            "Follow-up",
        ];

        if (!cleanCallStatus) {
            return res.status(400).json({
                success: false,
                message: "Call status is required",
            });
        }

        if (!allowedCallStatuses.includes(cleanCallStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid call status",
            });
        }

        const cleanContactDate = contactDate || null;
        const cleanFollowupDate = followupDate || null;
        const cleanCustomerVoice =
            customerVoice === undefined || customerVoice === null
                ? null
                : String(customerVoice).trim() || null;

        const cleanPhoneNumber =
            phoneNumber === undefined || phoneNumber === null
                ? null
                : String(phoneNumber).replace(/\D/g, "").trim() || null;

        const cleanPincode =
            pincode === undefined || pincode === null
                ? null
                : String(pincode).replace(/\D/g, "").trim() || null;

        if (cleanPhoneNumber && !/^\d{10}$/.test(cleanPhoneNumber)) {
            return res.status(400).json({
                success: false,
                message: "Phone number must contain exactly 10 digits",
            });
        }

        if (cleanPincode && !/^\d{6}$/.test(cleanPincode)) {
            return res.status(400).json({
                success: false,
                message: "Pincode must contain exactly 6 digits",
            });
        }

        const validDate = (value) => {
            if (value === null) return true;

            if (
                typeof value !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(value)
            ) {
                return false;
            }

            const [year, month, day] = value.split("-").map(Number);
            const date = new Date(Date.UTC(year, month - 1, day));

            return (
                date.getUTCFullYear() === year &&
                date.getUTCMonth() === month - 1 &&
                date.getUTCDate() === day
            );
        };

        if (
            !validDate(cleanContactDate) ||
            !validDate(cleanFollowupDate)
        ) {


            return res.status(400).json({
                success: false,
                message: "Invalid contact date or follow-up date",
            });
        }

        // Validate selected status
        if (cleanStatusId !== null) {
            const [statuses] = await connection.query(
                `SELECT id, status_name
         FROM call_case_statuses
         WHERE id = ? AND is_active = 1
         LIMIT 1`,
                [cleanStatusId]
            );

            if (!statuses.length) {


                return res.status(400).json({
                    success: false,
                    message: "Selected case status is not active or does not exist",
                });
            }
        }

        // Validate substatus belongs to selected status
        if (cleanSubstatusId !== null) {
            const [substatuses] = await connection.query(
                `SELECT id
         FROM call_case_substatuses
         WHERE id = ?
           AND status_id = ?
           AND is_active = 1
         LIMIT 1`,
                [cleanSubstatusId, cleanStatusId]
            );

            if (!substatuses.length) {


                return res.status(400).json({
                    success: false,
                    message: "Selected substatus is invalid for this status",
                });
            }
        }

        await connection.beginTransaction();
        transactionStarted = true;

        // Create an empty row if this chassis does not have a case yet.
        // The unique chassis_number constraint prevents duplicate cases.
        await connection.query(
            `INSERT IGNORE INTO chassis_call_cases (chassis_number)
       VALUES (?)`,
            [cleanChassisNumber]
        );

        // Lock the case row while saving, preventing simultaneous updates
        const [existingRows] = await connection.query(
            `SELECT
        c.*,
        s.status_name,
        ss.substatus_name,
        DATE_FORMAT(c.contact_date, '%Y-%m-%d') AS old_contact_date,
        DATE_FORMAT(c.followup_date, '%Y-%m-%d') AS old_followup_date
      FROM chassis_call_cases c
      LEFT JOIN call_case_statuses s ON s.id = c.status_id
      LEFT JOIN call_case_substatuses ss ON ss.id = c.substatus_id
      WHERE c.chassis_number = ?
      LIMIT 1
      FOR UPDATE`,
            [cleanChassisNumber]
        );

        const oldCase = existingRows[0];

        const [newStatusRows] =
            cleanStatusId === null
                ? [[{ status_name: null }]]
                : await connection.query(
                    `SELECT status_name
             FROM call_case_statuses
             WHERE id = ?`,
                    [cleanStatusId]
                );

        const [newSubstatusRows] =
            cleanSubstatusId === null
                ? [[{ substatus_name: null }]]
                : await connection.query(
                    `SELECT substatus_name
             FROM call_case_substatuses
             WHERE id = ?`,
                    [cleanSubstatusId]
                );

        const newStatusName = newStatusRows[0]?.status_name || null;
        const newSubstatusName =
            newSubstatusRows[0]?.substatus_name || null;

        const oldValues = {
            status: oldCase.status_name || null,
            substatus: oldCase.substatus_name || null,
            callStatus: oldCase.call_status || null,
            contactDate: oldCase.old_contact_date || null,
            followupDate: oldCase.old_followup_date || null,
            customerVoice: oldCase.customer_voice || null,
            phoneNumber: oldCase.phone_number || null,
            pincode: oldCase.pincode || null,
        };

        const newValues = {
            status: newStatusName,
            substatus: newSubstatusName,
            callStatus: cleanCallStatus,
            contactDate: cleanContactDate,
            followupDate: cleanFollowupDate,
            customerVoice: cleanCustomerVoice,
            phoneNumber: cleanPhoneNumber,
            pincode: cleanPincode,
        };

        const changedFields = [];

        if (oldCase.status_id !== cleanStatusId) {
            changedFields.push("status");
        }

        if (oldCase.substatus_id !== cleanSubstatusId) {
            changedFields.push("substatus");
        }
        if (oldValues.callStatus !== newValues.callStatus) {
            changedFields.push("callStatus");
        }

        if (oldValues.contactDate !== newValues.contactDate) {
            changedFields.push("contactDate");
        }

        if (oldValues.followupDate !== newValues.followupDate) {
            changedFields.push("followupDate");
        }

        if (oldValues.customerVoice !== newValues.customerVoice) {
            changedFields.push("customerVoice");
        }

        if (oldValues.phoneNumber !== newValues.phoneNumber) {
            changedFields.push("phoneNumber");
        }

        if (oldValues.pincode !== newValues.pincode) {
            changedFields.push("pincode");
        }


        // Ownership restrictions removed.
        // Any authenticated user can update any call record.
        // Do not automatically assign records to the current user.

        // Preserve existing assignment value without enforcing ownership.

        const followupChanged =
            oldValues.followupDate !== newValues.followupDate;

        const followupCompletedAt = followupChanged
            ? null
            : oldCase.followup_completed_at;



        const updatedBy = String(req.user.id);
        const updatedByName =
            req.user.name || req.user.fullName || "Unknown";

        await connection.query(
            `UPDATE chassis_call_cases
   SET
     status_id = ?,
     substatus_id = ?,
     call_status = ?,
     contact_date = ?,
           followup_date = ?,
      followup_completed_at = ?,
     phone_number = ?,
     pincode = ?,
     customer_voice = ?,
     updated_by = ?,
     updated_by_name = ?,
     updated_at = CURRENT_TIMESTAMP
   WHERE id = ?`,
            [
                cleanStatusId,
                cleanSubstatusId,
                cleanCallStatus,
                cleanContactDate,
                cleanFollowupDate,

                followupCompletedAt,
                cleanPhoneNumber,
                cleanPincode,
                cleanCustomerVoice,
                updatedBy,
                updatedByName,
                oldCase.id,
            ]
        );

        // Track every user who saves this case.
        // Never remove previous users from this table.
        await connection.query(
            `INSERT INTO chassis_call_case_users
        (case_id, user_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
        last_updated_at = CURRENT_TIMESTAMP`,
            [oldCase.id, Number(req.user.id)]
        );

        // Add history only when something actually changed
        if (changedFields.length > 0) {
            await connection.query(
                `INSERT INTO chassis_call_history (
          case_id,
          chassis_number,
          old_status,
          new_status,
          old_call_status,
          new_call_status,
          old_substatus,
          new_substatus,
          old_contact_date,
          new_contact_date,
          old_followup_date,
          new_followup_date,
          old_phone_number,
          new_phone_number,
          old_pincode,
          new_pincode,
          old_customer_voice,
          new_customer_voice,
          changed_fields,
          updated_by,
          updated_by_name
                ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?
        )`,
                [
                    oldCase.id,
                    cleanChassisNumber,
                    oldValues.status,
                    newValues.status,
                    oldValues.callStatus,
                    newValues.callStatus,
                    oldValues.substatus,
                    newValues.substatus,
                    oldValues.contactDate,
                    newValues.contactDate,
                    oldValues.followupDate,
                    newValues.followupDate,
                    oldValues.phoneNumber,
                    newValues.phoneNumber,
                    oldValues.pincode,
                    newValues.pincode,
                    oldValues.customerVoice,
                    newValues.customerVoice,
                    JSON.stringify(changedFields),
                    updatedBy,
                    updatedByName,
                ]
            );
        }

        await connection.commit();
        transactionStarted = false;

        res.json({
            success: true,
            message: "Call case saved successfully",
            changedFields,
        });
    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error("Save call case error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to save call case",
        });
    } finally {
        if (connection) {
            connection.release();
        }

    }
};


// GET CALL CASE HISTORY
const getCallCaseHistory = async (req, res) => {
    try {
        const { chassisNumber } = req.params;

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(
            100,
            Math.max(1, parseInt(req.query.limit, 10) || 20)
        );
        const offset = (page - 1) * limit;

        const [history] = await pool.query(
            `SELECT
        id,
        chassis_number,
        old_status,
        new_status,
        old_substatus,
        new_substatus,
        old_call_status,
        new_call_status,
        old_contact_date,
        new_contact_date,
        old_followup_date,
        new_followup_date,
        old_phone_number,
        new_phone_number,
        old_pincode,
        new_pincode,
        old_customer_voice,
        new_customer_voice,
        changed_fields,
        updated_by,
        updated_by_name,
        updated_at
      FROM chassis_call_history
      WHERE chassis_number = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT ? OFFSET ?`,
            [chassisNumber, limit, offset]
        );

        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total
       FROM chassis_call_history
       WHERE chassis_number = ?`,
            [chassisNumber]
        );

        res.json({
            success: true,
            history,
            pagination: {
                page,
                limit,
                total: countRows[0].total,
                totalPages: Math.ceil(countRows[0].total / limit),
            },
        });
    } catch (error) {
        console.error("Get call case history error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load call case history",
        });
    }
};



const getAdminCaseStatuses = async (req, res) => {
    try {
        const [statuses] = await pool.query(`
      SELECT id, status_name, is_active, created_at
      FROM call_case_statuses
      ORDER BY status_name ASC
    `);

        const [substatuses] = await pool.query(`
      SELECT id, status_id, substatus_name, is_active, created_at
      FROM call_case_substatuses
      ORDER BY substatus_name ASC
    `);

        res.json({
            success: true,
            statuses,
            substatuses,
        });
    } catch (error) {
        console.error("Get admin case statuses error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load case status management",
        });
    }
};


// GET FOLLOW-UP DASHBOARD SUMMARY
const getFollowupSummary = async (req, res) => {
    try {
        const isAdmin = req.user.role === "admin";
        const where = [];
        const params = [];

        // All users can see all call records.
        // Admin can optionally filter by assigned user.
        // Admin can optionally filter by assigned user.
        // Admin can filter by the user who last updated the record.
        // Admin can filter by any user who has handled the case.
        if (isAdmin && req.query.updatedBy) {
            const updatedBy = Number(req.query.updatedBy);

            if (!Number.isInteger(updatedBy) || updatedBy <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid user ID",
                });
            }

            where.push(`
        EXISTS (
            SELECT 1
            FROM chassis_call_case_users cu
            WHERE cu.case_id = chassis_call_cases.id
              AND cu.user_id = ?
        )
    `);

            params.push(updatedBy);
        }

        // Regular users see every case they have handled.
        if (!isAdmin) {
            where.push(`
        EXISTS (
            SELECT 1
            FROM chassis_call_case_users cu
            WHERE cu.case_id = chassis_call_cases.id
              AND cu.user_id = ?
        )
    `);

            params.push(Number(req.user.id));
        }

        // Regular users see only records they last updated.
        // if (!isAdmin) {
        //     where.push("updated_by = ?");
        //     params.push(String(req.user.id));
        // }

        const whereSQL = where.length
            ? `WHERE ${where.join(" AND ")}`
            : "";

        const [rows] = await pool.query(
            `SELECT
                COUNT(*) AS total,
                COALESCE(SUM(call_status IN ('Complaint', 'Follow-up')), 0) AS open,
                COALESCE(SUM(call_status = 'Closed'), 0) AS closed,
                COALESCE(SUM(call_status = 'Complaint'), 0) AS complaints,
                COALESCE(SUM(call_status = 'Follow-up'), 0) AS followups
             FROM chassis_call_cases
             ${whereSQL}`,
            params
        );

        const summary = rows[0];

        res.json({
            success: true,
            summary: {
                total: Number(summary.total),
                open: Number(summary.open),
                closed: Number(summary.closed),
                complaints: Number(summary.complaints),
                followups: Number(summary.followups),
            },
        });
    } catch (error) {
        console.error("Follow-up summary error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load follow-up summary",
        });
    }
};


// GET FOLLOW-UP DASHBOARD LIST
const getFollowups = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(
            100,
            Math.max(1, parseInt(req.query.limit, 10) || 25)
        );
        const offset = (page - 1) * limit;

        const isAdmin = req.user.role === "admin";
        const view = req.query.view || "open";
        const status = req.query.status;

        if (!["open", "closed", "all"].includes(view)) {
            return res.status(400).json({
                success: false,
                message: "Invalid dashboard view",
            });
        }

        if (
            status &&
            !["Complaint", "Follow-up", "Closed"].includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid call status",
            });
        }

        if (
            (view === "open" && status === "Closed") ||
            (view === "closed" && status && status !== "Closed")
        ) {
            return res.status(400).json({
                success: false,
                message: "Call status does not match dashboard view",
            });
        }

        const where = [];
        const params = [];

        // Regular users can only see their assigned records.
        // All users can view and handle every call record.
        // Admin can optionally filter by assigned user.
        // Admin can optionally filter by assigned user.
        // Admin can filter by the user who last updated the record.
        // Admin can filter by any user who has handled the case.
        if (isAdmin && req.query.updatedBy) {
            const updatedBy = Number(req.query.updatedBy);

            if (!Number.isInteger(updatedBy) || updatedBy <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid user ID",
                });
            }

            where.push(`
        EXISTS (
            SELECT 1
            FROM chassis_call_case_users cu
            WHERE cu.case_id = c.id
              AND cu.user_id = ?
        )
    `);

            params.push(updatedBy);
        }

        // Regular users see every case they have handled.
        if (!isAdmin) {
            where.push(`
        EXISTS (
            SELECT 1
            FROM chassis_call_case_users cu
            WHERE cu.case_id = c.id
              AND cu.user_id = ?
        )
    `);

            params.push(Number(req.user.id));
        }

        // Regular users see only records they last updated.
        // if (!isAdmin) {
        //     where.push("c.updated_by = ?");
        //     params.push(String(req.user.id));
        // }

        // Open and closed views are controlled only by call_status.
        if (view === "open") {
            where.push("c.call_status IN ('Complaint', 'Follow-up')");
        } else if (view === "closed") {
            where.push("c.call_status = 'Closed'");
        }

        // Optional status filter inside the open view.
        if (status) {
            where.push("c.call_status = ?");
            params.push(status);
        }

        const whereSQL = where.length
            ? `WHERE ${where.join(" AND ")}`
            : "";

        const [followups] = await pool.query(
            `SELECT
                c.id,
                c.chassis_number,
                c.status_id,
                c.substatus_id,
                s.status_name,
                ss.substatus_name,
                c.call_status,
                DATE_FORMAT(c.contact_date, '%Y-%m-%d') AS contact_date,
                DATE_FORMAT(c.followup_date, '%Y-%m-%d') AS followup_date,
                c.assigned_to,
                u.full_name AS assigned_to_name,
                c.phone_number,
                c.customer_voice,
                c.updated_by_name,
                c.updated_at
             FROM chassis_call_cases c
             LEFT JOIN call_case_statuses s
                ON s.id = c.status_id
             LEFT JOIN call_case_substatuses ss
                ON ss.id = c.substatus_id
             LEFT JOIN users u
                ON u.id = c.assigned_to
             ${whereSQL}
             ORDER BY c.updated_at DESC, c.id DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total
             FROM chassis_call_cases c
             ${whereSQL}`,
            params
        );

        const total = Number(countRows[0].total);

        res.json({
            success: true,
            followups,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Get follow-ups error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load follow-ups",
        });
    }
};


// ADMIN: ASSIGN A RECORD TO A USER
const assignFollowup = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.body.userId);

        if (
            !Number.isInteger(id) ||
            id <= 0 ||
            !Number.isInteger(userId) ||
            userId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid record ID and user ID are required",
            });
        }

        const [users] = await pool.query(
            `SELECT id, full_name
             FROM users
             WHERE id = ? AND is_active = 1
             LIMIT 1`,
            [userId]
        );

        if (!users.length) {
            return res.status(404).json({
                success: false,
                message: "Active user not found",
            });
        }

        const [result] = await pool.query(
            `UPDATE chassis_call_cases
             SET assigned_to = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [userId, id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Record not found",
            });
        }

        res.json({
            success: true,
            message: "Record assigned successfully",
            assignedTo: {
                id: users[0].id,
                name: users[0].full_name,
            },
        });
    } catch (error) {
        console.error("Assign record error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to assign record",
        });
    }
};



module.exports = {
    getCaseStatuses,
    createCaseStatus,
    updateCaseStatus,
    getCaseSubstatuses,
    createCaseSubstatus,
    updateCaseSubstatus,
    getCallCase,
    saveCallCase,
    getCallCaseHistory,
    getAdminCaseStatuses,

    // Follow-up Dashboard APIs
    getFollowupSummary,
    getFollowups,
    assignFollowup,
};
