
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
        const allowedCallStatuses = [
            "Closed",
            "Complaint",
            "Follow-up",
        ];

        const cleanCallStatus =
            callStatus === "" ||
                callStatus === undefined ||
                callStatus === null
                ? null
                : String(callStatus);

        if (
            cleanCallStatus !== null &&
            !allowedCallStatuses.includes(cleanCallStatus)
        ) {
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
                cleanPhoneNumber,
                cleanPincode,
                cleanCustomerVoice,
                updatedBy,
                updatedByName,
                oldCase.id,
            ]
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
};
