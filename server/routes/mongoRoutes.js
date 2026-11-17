
const express = require("express");
const router = express.Router();

const SalesMaster = require("../models/SalesMaster");

router.get("/status", async (req, res) => {
  try {
    await SalesMaster.init();

    const totalRecords = await SalesMaster.countDocuments();

    res.json({
      success: true,
      database: "MongoDB Atlas",
      collection: SalesMaster.collection.collectionName,
      totalRecords,
      message: "Sales Master collection is ready"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


router.get("/verify-services", async (req, res) => {
  try {
    const result = await SalesMaster.aggregate([
      {
        $project: {
          serviceCount: {
            $size: {
              $ifNull: ["$serviceRecords", []]
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalMasters: { $sum: 1 },
          mastersWithServices: {
            $sum: {
              $cond: [
                { $gt: ["$serviceCount", 0] },
                1,
                0
              ]
            }
          },
          totalServiceRecords: {
            $sum: "$serviceCount"
          },
          maxServicesPerMaster: {
            $max: "$serviceCount"
          }
        }
      }
    ]);

    res.json({
      success: true,
      verification: result[0] || {
        totalMasters: 0,
        mastersWithServices: 0,
        totalServiceRecords: 0,
        maxServicesPerMaster: 0
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


module.exports = router;
