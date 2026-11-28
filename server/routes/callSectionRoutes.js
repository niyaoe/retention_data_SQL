
const express = require("express");
const router = express.Router();

const {
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

    getFollowupSummary,
    getFollowups,
    assignFollowup,
} = require("../controllers/callSectionController");

const {
    protect,
    authorize,
} = require("../middleware/authMiddleware");

// STATUS ROUTES
router.get("/statuses", protect, getCaseStatuses);

router.post(
    "/statuses",
    protect,
    authorize("admin"),
    createCaseStatus
);

router.put(
    "/statuses/:id",
    protect,
    authorize("admin"),
    updateCaseStatus
);

// SUBSTATUS ROUTES
router.get(
    "/statuses/:id/substatuses",
    protect,
    getCaseSubstatuses
);

router.post(
    "/substatuses",
    protect,
    authorize("admin"),
    createCaseSubstatus
);

router.put(
    "/substatuses/:id",
    protect,
    authorize("admin"),
    updateCaseSubstatus
);

router.get(
    "/admin/statuses",
    protect,
    authorize("admin"),
    getAdminCaseStatuses
);

// FOLLOW-UP ROUTES
router.get("/followups/summary", protect, getFollowupSummary);

router.get("/followups", protect, getFollowups);


router.put(
    "/followups/:id/assign",
    protect,
    authorize("admin"),
    assignFollowup
);

router.get("/:chassisNumber", protect, getCallCase);

router.put("/:chassisNumber", protect, saveCallCase);

router.get("/:chassisNumber/history", protect, getCallCaseHistory);

module.exports = router;
