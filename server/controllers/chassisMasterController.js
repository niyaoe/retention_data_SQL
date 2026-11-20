const { pool } = require("../config/db");

// ========================================
// GET CHASSIS MASTER LIST
// ========================================

const getChassisMaster = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

        const limit = Math.min(
            100,
            Math.max(1, Number.parseInt(req.query.limit, 10) || 25),
        );

        const search = String(req.query.search || "").trim();
        const offset = (page - 1) * limit;

        const saleBranch = String(req.query.saleBranch || "").trim();
        const dealerBranchId = String(req.query.dealerBranchId || "").trim();

        const freePaidMonth = String(req.query.freePaidMonth || "").trim();

        const [monthRows] = await pool.query(`
    SELECT DISTINCT
        DATE_FORMAT(fp.bill_date, '%Y-%m') AS monthValue
    FROM ro_master_combined fp
    INNER JOIN chassis_master cm
        ON cm.chassis_no = fp.chassis_number
    WHERE fp.service_category IN ('Free Service', 'Paid Service')
      AND fp.bill_date IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM ro_master_combined newer
          WHERE newer.chassis_number = fp.chassis_number
            AND newer.service_category IN ('Free Service', 'Paid Service')
            AND (
                newer.bill_date > fp.bill_date
                OR (
                    newer.bill_date = fp.bill_date
                    AND newer.id > fp.id
                )
            )
      )
    ORDER BY monthValue DESC
`);

        const monthNames = [
            "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
            "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
        ];

        const freePaidMonths = monthRows.map((row) => {
            const [year, month] = row.monthValue.split("-");

            return {
                value: row.monthValue,
                label: `${monthNames[Number(month) - 1]}-${year.slice(-2)}`,
            };
        });

        let freePaidStart = null;
        let freePaidEnd = null;

        if (freePaidMonth) {
            if (!/^\d{4}-\d{2}$/.test(freePaidMonth)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Free/Paid month",
                });
            }

            const [year, month] = freePaidMonth.split("-").map(Number);

            if (month < 1 || month > 12) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Free/Paid month",
                });
            }

            freePaidStart = `${freePaidMonth}-01`;
            freePaidEnd = new Date(Date.UTC(year, month, 1))
                .toISOString()
                .slice(0, 10);
        }

        const conditions = [];
        const searchParams = [];

        if (search) {
            conditions.push(`
        (
            cm.chassis_no LIKE ?
            OR s.cust_name LIKE ?
            OR s.mobile_no LIKE ?
            OR s.sale_branch LIKE ?
            OR s.model_group LIKE ?
            OR EXISTS (
                SELECT 1
                FROM ro_master_combined sr
                WHERE sr.chassis_number = cm.chassis_no
                AND (
                    sr.registration_number LIKE ?
                    OR sr.repair_order_number LIKE ?
                )
            )
        )
    `);

            const term = `%${search}%`;

            searchParams.push(term, term, term, term, term, term, term);
        }

        if (saleBranch) {
            conditions.push("s.sale_branch = ?");
            searchParams.push(saleBranch);
        }

        if (dealerBranchId) {
            if (!/^\d+$/.test(dealerBranchId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Dealer Branch ID",
                });
            }

            conditions.push(`
        EXISTS (
            SELECT 1
            FROM ro_master_combined dl
            WHERE dl.id = (
                SELECT dl2.id
                FROM ro_master_combined dl2
                WHERE dl2.chassis_number = cm.chassis_no
                ORDER BY dl2.bill_date DESC, dl2.id DESC
                LIMIT 1
            )
            AND dl.dealer_branch_id = ?
        )
    `);

            searchParams.push(Number(dealerBranchId));
        }

        if (freePaidMonth) {
            conditions.push(`
        EXISTS (
            SELECT 1
            FROM ro_master_combined fp
            WHERE fp.id = (
                SELECT fp2.id
                FROM ro_master_combined fp2
                WHERE fp2.chassis_number = cm.chassis_no
                  AND fp2.service_category IN (
                      'Free Service',
                      'Paid Service'
                  )
                ORDER BY fp2.bill_date DESC, fp2.id DESC
                LIMIT 1
            )
            AND fp.bill_date >= ?
            AND fp.bill_date < ?
        )
    `);

            searchParams.push(freePaidStart, freePaidEnd);
        }



        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const countStartedAt = Date.now();

        // 1. Total matching chassis
        const [countResult] = await pool.query(
            `
                SELECT COUNT(*) AS total
                FROM chassis_master cm
                LEFT JOIN sales_data_combined s
                    ON s.id = cm.sales_data_id
                ${whereClause}
            `,
            searchParams,
        );

        console.log(
            `[Chassis Master] Count query: ${Date.now() - countStartedAt} ms`,
        );

        const total = Number(countResult[0].total);

        const recordsStartedAt = Date.now();

        // 2. Get chassis list and latest Free/Paid service

        const [records] = await pool.query(
            `
        SELECT
            base.id,
            base.chassis_no,
            base.sales_data_id,
            base.service_count,
            base.created_at,
            base.updated_at,

            base.delivery_date,
            base.sale_branch,
            base.model_group,
            base.cust_name,
            base.postal_code,
            base.mobile_no,
            base.segment,

            last_service.id AS last_service_id,
            last_service.bill_date AS last_service_bill_date,
            last_service.dealer_location AS last_service_location,
            last_service.repair_order_number AS last_service_ro,
            last_service.ro_date AS last_service_ro_date,
            last_service.registration_number AS last_service_registration,
            last_service.chassis_number AS last_service_chassis,
            last_service.service_category AS last_service_category,
            last_service.service_type AS last_service_type,
            last_service.ro_service_advisor AS last_service_advisor,
            last_service.product_name AS last_service_product,

last_any_service.service_type AS last_service_type_any,
last_any_service.bill_date AS last_service_date_any,
last_any_service.dealer_location AS last_service_location_any,
last_any_branch.branch_name AS last_service_branch_name_any,

            pin_details.places AS pin_places,
            pin_details.districts AS pin_districts

        FROM (
            SELECT
                cm.id,
                cm.chassis_no,
                cm.sales_data_id,
                cm.service_count,
                cm.created_at,
                cm.updated_at,

                s.delivery_date,
                s.sale_branch,
                s.model_group,
                s.cust_name,
                s.postal_code,
                s.mobile_no,
                s.segment

            FROM chassis_master cm

            LEFT JOIN sales_data_combined s
                ON s.id = cm.sales_data_id

            ${whereClause}

            ORDER BY cm.id DESC
            LIMIT ? OFFSET ?

        ) AS base

        LEFT JOIN ro_master_combined last_service
            ON last_service.id = (
                SELECT s2.id
                FROM ro_master_combined s2
                WHERE s2.chassis_number = base.chassis_no
                  AND s2.service_category IN (
                      'Free Service',
                      'Paid Service'
                  )
                ORDER BY s2.bill_date DESC, s2.id DESC
                LIMIT 1
            )

        LEFT JOIN ro_master_combined last_any_service
            ON last_any_service.id = (
                SELECT s3.id
                FROM ro_master_combined s3
                WHERE s3.chassis_number = base.chassis_no
                ORDER BY s3.bill_date DESC, s3.id DESC
                LIMIT 1
            )
                LEFT JOIN branch_master last_any_branch
    ON last_any_branch.id = last_any_service.dealer_branch_id

        LEFT JOIN (
            SELECT
                TRIM(pincode) AS pincode,
                GROUP_CONCAT(
                    DISTINCT place
                    ORDER BY place
                    SEPARATOR ', '
                ) AS places,
                GROUP_CONCAT(
                    DISTINCT district
                    ORDER BY district
                    SEPARATOR ', '
                ) AS districts
            FROM serv_dms_data.kerala_pincodes
            WHERE pincode IS NOT NULL
              AND TRIM(pincode) <> ''
            GROUP BY TRIM(pincode)
        ) pin_details
            ON TRIM(base.postal_code) = pin_details.pincode

        ORDER BY base.id DESC
    `,
            [...searchParams, limit, offset],
        );

        console.log(
            `[Chassis Master] Records query: ${Date.now() - recordsStartedAt} ms`,
        );

        // 3. Format response
        const formattedRecords = records.map((row) => {
            let lastFreePaidService = null;

            if (row.last_service_id) {
                lastFreePaidService = {
                    sourceServiceId: row.last_service_id,
                    billDate: row.last_service_bill_date,
                    dealerLocation: row.last_service_location,
                    repairOrderNumber: row.last_service_ro,
                    roDate: row.last_service_ro_date,
                    registrationNumber: row.last_service_registration,
                    chassisNumber: row.last_service_chassis,
                    serviceCategory: row.last_service_category,
                    serviceType: row.last_service_type,
                    roServiceAdvisor: row.last_service_advisor,
                    productName: row.last_service_product,
                };
            }

            const salesData = row.sales_data_id
                ? {
                    deliveryDate: row.delivery_date,
                    saleBranch: row.sale_branch,
                    modelGroup: row.model_group,
                    customerName: row.cust_name,
                    postalCode: row.postal_code,
                    mobileNumber: row.mobile_no,
                    segment: row.segment,
                }
                : null;

            return {
                _id: row.id,
                chassisNumber: row.chassis_no,
                salesData,
                lastFreePaidService,
                serviceCount: Number(row.service_count || 0),
                lastSyncedAt: row.updated_at,
                lastServiceType: row.last_service_type_any || null,
                lastServiceDate: row.last_service_date_any || null,
                lastServiceDealerLocation:
                    row.last_service_branch_name_any ||
                    row.last_service_location_any ||
                    null,
                place: row.pin_places || null,
                district: row.pin_districts || null,
            };
        });

        console.log(
            `[Chassis Master] Total controller time: ${Date.now() - countStartedAt} ms`,
        );

        // Only branches that have sales-linked chassis records
        const [branchRows] = await pool.query(`
    SELECT DISTINCT s.sale_branch
    FROM chassis_master cm
    INNER JOIN sales_data_combined s
        ON s.id = cm.sales_data_id
    WHERE s.sale_branch IS NOT NULL
      AND TRIM(s.sale_branch) <> ''
    ORDER BY s.sale_branch
`);

        const branches = branchRows.map((row) => row.sale_branch);

        const [dealerBranchRows] = await pool.query(`
    SELECT id, branch_name
    FROM branch_master
    WHERE is_active = 1
      AND branch_name IS NOT NULL
      AND TRIM(branch_name) <> ''
    ORDER BY branch_name
`);

        const dealerBranches = dealerBranchRows.map((row) => ({
            id: row.id,
            branchName: row.branch_name,
        }));

        return res.status(200).json({
            success: true,
            records: formattedRecords,
            branches,
            dealerBranches,
            freePaidMonths,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("MySQL Chassis Master Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch Chassis Master records",
        });
    }
};

// ========================================
// GET CHASSIS DETAILS + COMPLETE HISTORY
// ========================================

const getChassisMasterDetails = async (req, res) => {
    try {
        const chassisNumber = String(req.params.chassisNumber || "")
            .trim()
            .toUpperCase();

        if (!chassisNumber) {
            return res.status(400).json({
                success: false,
                message: "Chassis number is required",
            });
        }

        // 1. Get master chassis and optional Sales information
        const [masterRows] = await pool.query(
            `
                SELECT
                    cm.id,
                    cm.chassis_no,
                    cm.sales_data_id,
                    cm.service_count,
                    cm.created_at,
                    cm.updated_at,

                    s.delivery_date,
                    s.sale_branch,
                    s.model_group,
                    s.cust_name,
                    s.postal_code,
                    s.mobile_no,
s.segment,
pin_details.places AS pin_places,
pin_details.districts AS pin_districts

                FROM chassis_master cm

                LEFT JOIN sales_data_combined s
                    ON s.id = cm.sales_data_id

                    LEFT JOIN (
    SELECT
        TRIM(pincode) AS pincode,
        GROUP_CONCAT(
            DISTINCT place
            ORDER BY place
            SEPARATOR ', '
        ) AS places,
        GROUP_CONCAT(
            DISTINCT district
            ORDER BY district
            SEPARATOR ', '
        ) AS districts
    FROM serv_dms_data.kerala_pincodes
    WHERE pincode IS NOT NULL
      AND TRIM(pincode) <> ''
    GROUP BY TRIM(pincode)
) pin_details
    ON TRIM(s.postal_code) = pin_details.pincode

                WHERE cm.chassis_no = ?
                LIMIT 1
            `,
            [chassisNumber],
        );

        if (!masterRows.length) {
            return res.status(404).json({
                success: false,
                message: "Chassis record not found",
            });
        }

        const master = masterRows[0];

        // 2. Get ALL matching service records
        const [serviceRows] = await pool.query(
            `
                SELECT
                    id,
                    bill_date,
                    dealer_location,
                    repair_order_number,
                    ro_date,
                    registration_number,
                    chassis_number,
                    service_category,
                    service_type,
                    ro_service_advisor,
                    product_name,
                    created_at

                FROM ro_master_combined

                WHERE chassis_number = ?

                ORDER BY
                    bill_date DESC,
                    id DESC
            `,
            [master.chassis_no],
        );

        // 3. Format service history
        const serviceRecords = serviceRows.map((service) => ({
            sourceServiceId: service.id,
            billDate: service.bill_date,
            dealerLocation: service.dealer_location,
            repairOrderNumber: service.repair_order_number,
            roDate: service.ro_date,
            registrationNumber: service.registration_number,
            chassisNumber: service.chassis_number,
            serviceCategory: service.service_category,
            serviceType: service.service_type,
            roServiceAdvisor: service.ro_service_advisor,
            productName: service.product_name,
            sourceCreatedAt: service.created_at,
        }));

        // 4. Sales data is null for service-only chassis
        const salesData = master.sales_data_id
            ? {
                deliveryDate: master.delivery_date,
                saleBranch: master.sale_branch,
                modelGroup: master.model_group,
                customerName: master.cust_name,
                postalCode: master.postal_code,
                mobileNumber: master.mobile_no,
                segment: master.segment,
            }
            : null;

        // 5. Build response
        const record = {
            _id: master.id,
            chassisNumber: master.chassis_no,

            salesData,

            place: master.pin_places || null,
            district: master.pin_districts || null,

            serviceRecords,
            serviceCount: Number(master.service_count || 0),

            sourceSalesId: master.sales_data_id,
            createdAt: master.created_at,
            lastSyncedAt: master.updated_at,
        };

        return res.status(200).json({
            success: true,
            record,
        });
    } catch (error) {
        console.error("MySQL Chassis Master Details Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch chassis details",
        });
    }
};

module.exports = {
    getChassisMaster,
    getChassisMasterDetails,
};
