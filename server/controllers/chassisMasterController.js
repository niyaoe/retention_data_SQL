const { pool } = require("../config/db");

// ========================================
// CHASSIS MASTER FILTER OPTIONS CACHE
// ========================================

const FILTER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const filterOptionsCache = new Map();

const getCachedFilterQuery = async (key, sql) => {
    const cached = filterOptionsCache.get(key);

    // Return cached data if still valid
    if (cached && cached.expiresAt > Date.now()) {
        return cached.rows;
    }

    // Fetch fresh data from MySQL
    const [rows] = await pool.query(sql);

    // Store in cache
    filterOptionsCache.set(key, {
        rows,
        expiresAt: Date.now() + FILTER_CACHE_TTL,
    });

    return rows;
};

// ========================================
// GET CHASSIS MASTER LIST
// ========================================

const getChassisMaster = async (req, res) => {
    try {

        const controllerStartedAt = Date.now();
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
        const locationFilter = String(
            req.query.locationFilter || ""
        ).trim();
        const segmentFilter = String(req.query.segment || "").trim();
        const deliveryMonth = String(req.query.deliveryMonth || "").trim();

        const callStatusFilter = String(req.query.callStatus || "").trim();

        const allowedCallStatuses = ["Closed", "Complaint", "Follow-up"];

        if (
            callStatusFilter &&
            !allowedCallStatuses.includes(callStatusFilter)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid call status",
            });
        }
        const caseStatusId = String(req.query.caseStatusId || "").trim();
        const caseSubstatusId = String(req.query.caseSubstatusId || "").trim();

        if (
            (caseStatusId && !/^\d+$/.test(caseStatusId)) ||
            (caseSubstatusId && !/^\d+$/.test(caseSubstatusId))
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid case status filter",
            });
        }

        const conditions = [];
        const searchParams = [];



        const monthQueryStartedAt = Date.now();

        const monthRows = await getCachedFilterQuery(
            "freePaidMonths",
            `
        SELECT DISTINCT
            DATE_FORMAT(css.latest_free_paid_bill_date, '%Y-%m') AS monthValue
        FROM chassis_service_summary css
        INNER JOIN chassis_master cm
            ON cm.chassis_no = css.chassis_number
        WHERE css.latest_free_paid_bill_date IS NOT NULL
        ORDER BY monthValue DESC
    `
        );

        console.log(
            `[Chassis Master] Free/Paid months query: ${Date.now() - monthQueryStartedAt} ms`
        );

        const monthNames = [
            "JAN",
            "FEB",
            "MAR",
            "APR",
            "MAY",
            "JUN",
            "JUL",
            "AUG",
            "SEP",
            "OCT",
            "NOV",
            "DEC",
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

        if (segmentFilter) {
            conditions.push(`
        COALESCE(
            NULLIF(TRIM(s.segment), ''),
            NULLIF(TRIM(segment_service.segment), '')
        ) = ?
    `);
            searchParams.push(segmentFilter);
        }

        if (locationFilter) {
            const locationTerm = `%${locationFilter}%`;

            conditions.push(`
        (
            s.postal_code LIKE ?
            OR pin_filter_details.places LIKE ?
            OR pin_filter_details.districts LIKE ?
        )
    `);

            searchParams.push(
                locationTerm,
                locationTerm,
                locationTerm
            );
        }




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

        if (dealerBranchId === "blank") {
            // Records without an assigned dealer branch
            conditions.push("css.latest_service_branch_id IS NULL");
        } else if (dealerBranchId) {
            if (!/^\d+$/.test(dealerBranchId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Dealer Branch ID",
                });
            }

            conditions.push("css.latest_service_branch_id = ?");
            searchParams.push(Number(dealerBranchId));
        }

        if (freePaidMonth) {
            conditions.push(`
        css.latest_free_paid_bill_date >= ?
        AND css.latest_free_paid_bill_date < ?
    `);

            searchParams.push(freePaidStart, freePaidEnd);
        }

        let deliveryStart = null;
        let deliveryEnd = null;

        if (deliveryMonth) {
            if (!/^\d{4}-\d{2}$/.test(deliveryMonth)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Delivery Date month",
                });
            }

            const [year, month] = deliveryMonth.split("-").map(Number);

            if (month < 1 || month > 12) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Delivery Date month",
                });
            }

            deliveryStart = `${deliveryMonth}-01`;

            deliveryEnd = new Date(Date.UTC(year, month, 1))
                .toISOString()
                .slice(0, 10);
        }

        if (deliveryMonth) {
            conditions.push(`
        s.delivery_date >= ?
        AND s.delivery_date < ?
    `);

            searchParams.push(deliveryStart, deliveryEnd);
        }

        if (callStatusFilter) {
            conditions.push(`
        EXISTS (
    SELECT 1
    FROM chassis_call_cases call_filter
    WHERE call_filter.chassis_number COLLATE utf8mb4_unicode_ci =
          cm.chassis_no COLLATE utf8mb4_unicode_ci
      AND call_filter.call_status = ?
)
    `);

            searchParams.push(callStatusFilter);
        }

        // Case Status + Case Substatus filter
        if (caseStatusId || caseSubstatusId) {
            const caseConditions = [];

            if (caseStatusId) {
                caseConditions.push("case_filter.status_id = ?");
                searchParams.push(Number(caseStatusId));
            }

            if (caseSubstatusId) {
                caseConditions.push("case_filter.substatus_id = ?");
                searchParams.push(Number(caseSubstatusId));
            }

            conditions.push(`
        EXISTS (
            SELECT 1
            FROM chassis_call_cases case_filter
            WHERE case_filter.chassis_number COLLATE utf8mb4_unicode_ci =
                  cm.chassis_no COLLATE utf8mb4_unicode_ci
              AND ${caseConditions.join(" AND ")}
        )
    `);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";


        const countStartedAt = Date.now();

        // Build only the JOINs required by active filters
        const countJoins = [];

        const needsSalesJoin = Boolean(
            segmentFilter ||
            locationFilter ||
            search ||
            saleBranch ||
            deliveryMonth
        );

        const needsCssJoin = Boolean(
            segmentFilter ||
            dealerBranchId ||
            freePaidMonth
        );

        if (needsSalesJoin) {
            countJoins.push(`
        LEFT JOIN sales_data_combined s
            ON s.id = cm.sales_data_id
    `);
        }

        if (locationFilter) {
            countJoins.push(`
        LEFT JOIN pincode_lookup_summary pin_filter_details
            ON pin_filter_details.pincode = TRIM(s.postal_code)
    `);
        }

        if (needsCssJoin) {
            countJoins.push(`
        LEFT JOIN chassis_service_summary css
            ON css.chassis_number = cm.chassis_no
    `);
        }

        if (segmentFilter) {
            countJoins.push(`
        LEFT JOIN ro_master_combined segment_service
            ON segment_service.id = css.latest_service_id
    `);
        }

        const [countResult] = await pool.query(
            `
        SELECT COUNT(*) AS total
        FROM chassis_master cm
        ${countJoins.join("\n")}
        ${whereClause}
    `,
            searchParams
        );

        console.log(
            `[Chassis Master] Count query: ${Date.now() - countStartedAt} ms`
        );

        const total = Number(countResult[0].total);


        // 1. Total matching chassis






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

base.segment AS sales_segment,

COALESCE(
    NULLIF(TRIM(base.segment), ''),
    NULLIF(TRIM(last_any_service.segment), '')
) AS segment,

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
pin_details.districts AS pin_districts,

ccs.status_name AS case_status,
ccsub.substatus_name AS case_substatus,
cc.call_status AS call_status


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
            s.segment,

            css.latest_service_id,
css.latest_free_paid_id,
latest_sort.bill_date AS latest_service_sort_date

        FROM chassis_master cm

       LEFT JOIN sales_data_combined s
    ON s.id = cm.sales_data_id

${locationFilter ? `
LEFT JOIN pincode_lookup_summary pin_filter_details
    ON pin_filter_details.pincode = TRIM(s.postal_code)
` : ""}

LEFT JOIN chassis_service_summary css
    ON css.chassis_number = cm.chassis_no

    LEFT JOIN ro_master_combined latest_sort
    ON latest_sort.id = css.latest_service_id

    ${segmentFilter ? `
    LEFT JOIN ro_master_combined segment_service
        ON segment_service.id = css.latest_service_id
` : ""}

        ${whereClause}

        ORDER BY
    latest_sort.bill_date DESC,
    latest_sort.id DESC,
    cm.id DESC
LIMIT ? OFFSET ?

    ) AS base

LEFT JOIN chassis_call_cases cc
    ON cc.chassis_number COLLATE utf8mb4_unicode_ci =
       base.chassis_no COLLATE utf8mb4_unicode_ci

LEFT JOIN call_case_statuses ccs
    ON ccs.id = cc.status_id

LEFT JOIN call_case_substatuses ccsub
    ON ccsub.id = cc.substatus_id

LEFT JOIN ro_master_combined last_service
    ON last_service.id = base.latest_free_paid_id

    LEFT JOIN ro_master_combined last_any_service
        ON last_any_service.id = base.latest_service_id

    LEFT JOIN branch_master last_any_branch
        ON last_any_branch.id = last_any_service.dealer_branch_id

    LEFT JOIN pincode_lookup_summary pin_details
    ON pin_details.pincode = TRIM(base.postal_code)

    ORDER BY
    base.latest_service_sort_date DESC,
    base.latest_service_id DESC,
    base.id DESC
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
                    segment: row.sales_segment || null,
                }
                : null;

            return {
                _id: row.id,
                chassisNumber: row.chassis_no,
                salesData,
                segment: row.segment || null,
                lastFreePaidService,
                serviceCount: Number(row.service_count || 0),

                caseStatus: row.case_status || null,
                caseSubstatus: row.case_substatus || null,
                callStatus: row.call_status || null,

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



        // Only branches that have sales-linked chassis records
        const branchQueryStartedAt = Date.now();

        const branchRows = await getCachedFilterQuery(
            "saleBranches",
            `
        SELECT DISTINCT s.sale_branch
        FROM chassis_master cm
        INNER JOIN sales_data_combined s
            ON s.id = cm.sales_data_id
        WHERE s.sale_branch IS NOT NULL
          AND TRIM(s.sale_branch) <> ''
        ORDER BY s.sale_branch
    `
        );

        console.log(
            `[Chassis Master] Sale branches query: ${Date.now() - branchQueryStartedAt} ms`
        );

        const branches = branchRows.map((row) => row.sale_branch);

        const dealerBranchQueryStartedAt = Date.now();

        const dealerBranchRows = await getCachedFilterQuery(
            "dealerBranches",
            `
        SELECT id, branch_name
        FROM branch_master
        WHERE is_active = 1
          AND branch_name IS NOT NULL
          AND TRIM(branch_name) <> ''
        ORDER BY branch_name
    `
        );

        console.log(
            `[Chassis Master] Dealer branches query: ${Date.now() - dealerBranchQueryStartedAt} ms`
        );
        const dealerBranches = dealerBranchRows.map((row) => ({
            id: row.id,
            branchName: row.branch_name,
        }));

        const queryStartedAt = Date.now();

        const segmentRows = await getCachedFilterQuery(
            "segments",
            `
        SELECT DISTINCT resolved.segment
        FROM (
            SELECT
                COALESCE(
                    NULLIF(TRIM(s.segment), ''),
                    NULLIF(TRIM(rs.segment), '')
                ) AS segment
            FROM chassis_master cm
            LEFT JOIN sales_data_combined s
                ON s.id = cm.sales_data_id
            LEFT JOIN chassis_service_summary css
                ON css.chassis_number = cm.chassis_no
            LEFT JOIN ro_master_combined rs
                ON rs.id = css.latest_service_id
        ) AS resolved
        WHERE resolved.segment IS NOT NULL
          AND resolved.segment <> ''
        ORDER BY resolved.segment
    `
        );

        const segments = segmentRows.map((row) => row.segment);

        console.log(
            `[Chassis Master] segment query: ${Date.now() - queryStartedAt} ms`
        );



        const deliveryMonthQueryStartedAt = Date.now();

        const deliveryMonthRows = await getCachedFilterQuery(
            "deliveryMonths",
            `
        SELECT DISTINCT
            DATE_FORMAT(s.delivery_date, '%Y-%m') AS monthValue
        FROM chassis_master cm
        INNER JOIN sales_data_combined s
            ON s.id = cm.sales_data_id
        WHERE s.delivery_date IS NOT NULL
        ORDER BY monthValue DESC
    `
        );

        const caseStatuses = await getCachedFilterQuery(
            "caseStatuses",
            `
        SELECT id, status_name
        FROM call_case_statuses
        WHERE is_active = 1
        ORDER BY status_name
    `
        );

        const caseSubstatuses = await getCachedFilterQuery(
            "caseSubstatuses",
            `
        SELECT id, status_id, substatus_name
        FROM call_case_substatuses
        WHERE is_active = 1
        ORDER BY substatus_name
    `
        );

        console.log(
            `[Chassis Master] Delivery months query: ${Date.now() - deliveryMonthQueryStartedAt} ms`
        );

        // const monthNames = [
        //     "JAN", "FEB", "MAR", "APR",
        //     "MAY", "JUN", "JUL", "AUG",
        //     "SEP", "OCT", "NOV", "DEC"
        // ];

        const deliveryMonths = deliveryMonthRows.map((row) => {
            const [year, month] = row.monthValue.split("-");

            return {
                value: row.monthValue,
                label: `${monthNames[Number(month) - 1]}-${year.slice(-2)}`,
            };
        });

        console.log(
            `[Chassis Master] Total API time: ${Date.now() - controllerStartedAt
            } ms`
        );


        return res.status(200).json({
            success: true,
            records: formattedRecords,
            branches,
            dealerBranches,
            freePaidMonths,
            segments,
            deliveryMonths,
            caseStatuses,
            caseSubstatuses,
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
s.segment AS sales_segment,

COALESCE(
    NULLIF(TRIM(s.segment), ''),
    NULLIF(TRIM(latest_service.segment), '')
) AS segment,
pin_details.places AS pin_places,
pin_details.districts AS pin_districts

                FROM chassis_master cm

                LEFT JOIN sales_data_combined s
                    ON s.id = cm.sales_data_id

                    LEFT JOIN chassis_service_summary css
    ON css.chassis_number = cm.chassis_no

LEFT JOIN ro_master_combined latest_service
    ON latest_service.id = css.latest_service_id

                   LEFT JOIN pincode_lookup_summary pin_details
    ON pin_details.pincode = TRIM(s.postal_code)

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
segment,
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
            segment: service.segment || null,
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
                segment: master.sales_segment || null,
            }
            : null;

        // 5. Build response
        const record = {
            _id: master.id,
            chassisNumber: master.chassis_no,

            salesData,

            place: master.pin_places || null,
            district: master.pin_districts || null,
            segment: master.segment || null,

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


const updateSalesContactDetails = async (req, res) => {
    try {
        const chassisNumber = String(req.params.chassisNumber || "")
            .trim()
            .toUpperCase();

        const mobileNumber = String(req.body.mobileNumber || "").trim();
        const postalCode = String(req.body.postalCode || "").trim();

        if (!/^\d{10}$/.test(mobileNumber)) {
            return res.status(400).json({
                success: false,
                message: "Mobile number must contain exactly 10 digits",
            });
        }

        if (!/^\d{6}$/.test(postalCode)) {
            return res.status(400).json({
                success: false,
                message: "PIN code must contain exactly 6 digits",
            });
        }

        const [result] = await pool.query(
            `
        UPDATE sales_data_combined s
        INNER JOIN chassis_master cm
          ON cm.sales_data_id = s.id
        SET
          s.mobile_no = ?,
          s.postal_code = ?
        WHERE cm.chassis_no = ?
      `,
            [mobileNumber, postalCode, chassisNumber]
        );

        if (result.affectedRows === 0) {
            const [rows] = await pool.query(
                `SELECT id FROM chassis_master WHERE chassis_no = ?`,
                [chassisNumber]
            );

            if (!rows.length) {
                return res.status(404).json({
                    success: false,
                    message: "Chassis record not found",
                });
            }

            return res.status(400).json({
                success: false,
                message: "No linked Sales Data record found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Sales contact details updated successfully",
        });
    } catch (error) {
        console.error("Update Sales Contact Details Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update sales contact details",
        });
    }
};


module.exports = {
    getChassisMaster,
    getChassisMasterDetails,
    updateSalesContactDetails
};
