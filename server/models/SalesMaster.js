
const mongoose = require("mongoose");

const serviceRecordSchema = new mongoose.Schema(
  {
    sourceServiceId: {
      type: Number,
      required: true
    },

    billDate: Date,
    dealerLocation: String,
    repairOrderNumber: String,
    roDate: Date,
    registrationNumber: String,
    chassisNumber: String,
    serviceCategory: String,
    serviceType: String,
    roServiceAdvisor: String,
    productName: String,

    // Original SQL created_at
    sourceCreatedAt: Date

  },
  { _id: false }
);

const salesMasterSchema = new mongoose.Schema(
  {
    // Unique normalized chassis key for matching
    chassisKey: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    chassisNumber: {
      type: String,
      required: true,
      trim: true
    },

    // Original SQL sales record ID
    sourceSalesId: {
      type: Number,
      required: true,
      unique: true
    },

    // Sales information
    salesData: {
      deliveryDate: Date,
      saleBranch: String,
      modelGroup: String,
      customerName: String,
      postalCode: String,
      mobileNumber: String,
      segment: String,

       // Original SQL created_at
      sourceCreatedAt: Date
    },

    // Multiple service records for one sales record
    serviceRecords: {
      type: [serviceRecordSchema],
      default: []
    },

    // Future branch mapping
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true
    },

    lastSyncedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    collection: "salesmasters"
  }
);

module.exports = mongoose.model(
  "SalesMaster",
  salesMasterSchema
);
