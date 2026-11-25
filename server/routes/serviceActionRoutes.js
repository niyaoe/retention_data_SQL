const express = require("express");
const multer = require("multer");


const router = express.Router();

const {
    getServiceAction,
    importServiceAction,
} = require("../controllers/serviceActionController");

const { protect } = require("../middleware/authMiddleware");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        const allowed = /.(xlsx|xls)$/i.test(file.originalname);

        if (!allowed) {
            return cb(new Error("Only Excel files are allowed"));
        }

        cb(null, true);
    },
});

router.get("/", protect, getServiceAction);

router.post(
    "/import",
    protect,
    upload.single("file"),
    importServiceAction
);

module.exports = router;