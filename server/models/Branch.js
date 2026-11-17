
const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
  {
    district: {
      type: String,
      required: true,
      trim: true
    },

    branchName: {
      type: String,
      required: true,
      trim: true
    },

    locationCode: {
      type: String,
      required: true,
      trim: true
    },

    dmsName: {
      type: String,
      default: "",
      trim: true
    },

    mdReportName: {
      type: String,
      default: "",
      trim: true
    },

    branchShort: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },

    slC: String,
    slB: String,
    aopDistrict: String,
    bsZone: String,
    dCode: String,
    preH2: String,

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    }
  },
  { timestamps: true }
);

branchSchema.index({ locationCode: 1 }, { unique: true });
branchSchema.index({ branchShort: 1 }, { unique: true });
branchSchema.index({ district: 1 });
branchSchema.index({ bsZone: 1 });

module.exports = mongoose.model("Branch", branchSchema);
