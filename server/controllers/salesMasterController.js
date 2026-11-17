
const { pool } = require("../config/db");

// ========================================
// GET MASTER CHASSIS LIST
// ========================================


const getSalesMaster = async (req, res) => {
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
          m.chassis_no LIKE ?
          OR m.cust_name LIKE ?
          OR m.mobile_no LIKE ?
          OR m.sale_branch LIKE ?
          OR m.model_group LIKE ?
          OR EXISTS (
            SELECT 1
            FROM ro_master_combined sr
            WHERE sr.chassis_number = m.chassis_no
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

        // Total matching records
        const [countResult] = await pool.query(
            `
      SELECT COUNT(*) AS total
      FROM sales_master_chassis m
      ${whereClause}
      `,
            searchParams
        );

        const total = Number(countResult[0].total);

        // Matching records with latest Free/Paid service
        const [records] = await pool.query(
            `
      SELECT
        m.id,
        m.chassis_no,
        m.delivery_date,
        m.sale_branch,
        m.model_group,
        m.cust_name,
        m.postal_code,
        m.mobile_no,
        m.segment,
        m.service_count,
        m.updated_at,

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

      FROM sales_master_chassis m

      LEFT JOIN ro_master_combined last_service
        ON last_service.id = (
          SELECT s2.id
          FROM ro_master_combined s2
          WHERE s2.chassis_number = m.chassis_no
            AND s2.service_category IN (
              'Free Service',
              'Paid Service'
            )
          ORDER BY s2.bill_date DESC, s2.id DESC
          LIMIT 1
        )

      ${whereClause}

      ORDER BY m.id DESC
      LIMIT ? OFFSET ?
      `,
            [...searchParams, limit, offset]
        );

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

            return {
                _id: row.id,
                chassisNumber: row.chassis_no,

                salesData: {
                    deliveryDate: row.delivery_date,
                    saleBranch: row.sale_branch,
                    modelGroup: row.model_group,
                    customerName: row.cust_name,
                    postalCode: row.postal_code,
                    mobileNumber: row.mobile_no,
                    segment: row.segment,
                },

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
        console.error("MySQL Sales Master Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch Master Chassis records",
        });
    }
};



// ========================================
// GET CHASSIS DETAILS + COMPLETE HISTORY
// ========================================

const getSalesMasterDetails = async (req, res) => {
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

        // 1. Get master chassis and sales information.
        const [masterRows] = await pool.query(
            `
      SELECT
        id,
        chassis_no,
        delivery_date,
        sale_branch,
        model_group,
        cust_name,
        postal_code,
        mobile_no,
        segment,
        service_count,
        source_sales_id,
        created_at,
        updated_at
      FROM sales_master_chassis
      WHERE chassis_no = ?
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

        // 2. Get ALL matching service records.
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

        // 3. Format service history to match the old MongoDB response.
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

        // 4. Build response.
        const record = {
            _id: master.id,
            chassisNumber: master.chassis_no,

            salesData: {
                deliveryDate: master.delivery_date,
                saleBranch: master.sale_branch,
                modelGroup: master.model_group,
                customerName: master.cust_name,
                postalCode: master.postal_code,
                mobileNumber: master.mobile_no,
                segment: master.segment,
            },

            serviceRecords,
            serviceCount: serviceRecords.length,

            sourceSalesId: master.source_sales_id,
            createdAt: master.created_at,
            lastSyncedAt: master.updated_at,
        };

        return res.status(200).json({
            success: true,
            record,
        });

    } catch (error) {
        console.error("MySQL Sales Master Details Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch chassis details",
        });
    }
};


module.exports = {
    getSalesMaster,
    getSalesMasterDetails,
};
