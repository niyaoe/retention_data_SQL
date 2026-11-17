
const express = require("express");
const router = express.Router();

const {
  analyzeRetentionData
} = require("../services/dataAnalysisService");

router.get("/profile", async (req, res) => {
  try {
    const result = await analyzeRetentionData();

    res.json({
      success: true,
      analysis: result
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Data analysis failed"
    });
  }
});

module.exports = router;
