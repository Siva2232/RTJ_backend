const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ApiError = require("../utils/ApiError");

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(400, "Only JPEG, PNG, WEBP images and PDF files are allowed."),
      false
    );
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subfolder = "others";
    if (file.fieldname === "images") subfolder = "cars";
    else if (file.fieldname === "carImage" || file.fieldname === "bills") subfolder = "repairs";
    else if (file.fieldname === "billImage") subfolder = "expenses";

    const dest = path.join(__dirname, "../uploads", subfolder);
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

/** Upload up to 30 car images (field name: images) and up to 20 expense bills (field name: expenseBills) */
const uploadCarImages = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).fields([
  { name: "images", maxCount: 35 },
  { name: "expenseBills", maxCount: 20 },
]);

/** Upload repair media — single car photo + up to 20 bill images/PDFs */
const uploadRepairMedia = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: "carImage", maxCount: 1 },
  { name: "bills", maxCount: 20 },
]);

/** Upload a single bill image for an expense */
const uploadBillImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
}).single("billImage");

module.exports = { uploadCarImages, uploadRepairMedia, uploadBillImage };
