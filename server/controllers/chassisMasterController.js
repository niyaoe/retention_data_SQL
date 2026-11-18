
const { pool } = require("../config/db");

// ========================================
// GET CHASSIS MASTER LIST
// ========================================

const getChassisMaster = async (req, res) => {
    try {
        const page = Math.max(
            1,
            Number.parseInt(req.query.page, 10) || 1
        );

        const limit = Math.min(
            100,
            Math.max(1, Number.parseInt(req.query.limit, 10) || 25)
        );

        const search = String(req.query.search || "").trim();
        const offset = (page - 1) * limit;

        let whereClause = "";
        const searchParams = [];

        if (search) {
            whereClause = `
                WHERE
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
            `;

            const term = `%${search}%`;

            searchParams.push(
                term,
                term,
                term,
                term,
                term,
                term,
                term
            );
        }

        // 1. Total matching chassis
        const [countResult] = await pool.query(
            `
                SELECT COUNT(*) AS total
                FROM chassis_master cm
                LEFT JOIN sales_data_combined s
                    ON s.id = cm.sales_data_id
                ${whereClause}
            `,
            searchParams
        );

        const total = Number(countResult[0].total);

        // 2. Get chassis list and latest Free/Paid service
        const [records] = await pool.query(
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
                    last_service.product_name AS last_service_product

                FROM chassis_master cm

                LEFT JOIN sales_data_combined s
                    ON s.id = cm.sales_data_id

                LEFT JOIN ro_master_combined last_service
                    ON last_service.id = (
                        SELECT s2.id
                        FROM ro_master_combined s2
                        WHERE s2.chassis_number = cm.chassis_no
                          AND s2.service_category IN (
                              'Free Service',
                              'Paid Service'
                          )
                        ORDER BY s2.bill_date DESC, s2.id DESC
                        LIMIT 1
                    )

                ${whereClause}

                ORDER BY cm.id DESC
                LIMIT ? OFFSET ?
            `,
            [...searchParams, limit, offset]
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
            };
        });

        return res.status(200).json({
            success: true,
            records: formattedRecords,
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
                    s.segment

                FROM chassis_master cm

                LEFT JOIN sales_data_combined s
                    ON s.id = cm.sales_data_id

                WHERE cm.chassis_no = ?
                LIMIT 1
            `,
            [chassisNumber]
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
            [master.chassis_no]
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
