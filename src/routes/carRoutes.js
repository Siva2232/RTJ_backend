const router = require('express').Router();
const {
  getAllCars,
  getCarById,
  createCar,
  deleteCar,
  addPurchaseExpense,
  deletePurchaseExpense,
  addRepairCost,
  deleteRepairCost,
  updateStatus,
  markReady,
  sellCar,
  approveSale,
  exportExcel,
} = require('../controllers/carController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  addCarRules,
  addExpenseRules,
  sellCarRules,
  validate,
} = require('../validators/carValidator');
const { uploadCarImages, uploadRepairMedia, uploadBillImage } = require('../middleware/uploadMiddleware');

// ── Export route (must come before /:id to avoid collision) ──────────────────
router.get('/export/excel', protect, exportExcel);

// ── Base car routes ───────────────────────────────────────────────────────────
router
  .route('/')
  .get(protect, getAllCars)
  .post(
    protect,
    authorizeRoles('admin', 'purchase'),
    uploadCarImages,
    addCarRules,
    validate,
    createCar
  );

router
  .route('/:id')
  .get(protect, getCarById)
  .delete(protect, authorizeRoles('admin'), deleteCar);

// ── Purchase expenses ─────────────────────────────────────────────────────────
router.post(
  '/:id/purchase-expense',
  protect,
  authorizeRoles('admin', 'purchase'),
  uploadBillImage, // Single image upload for bills/receipts
  addExpenseRules,
  validate,
  addPurchaseExpense
);
router.delete(
  '/:id/purchase-expense/:expId',
  protect,
  authorizeRoles('admin', 'purchase'),
  deletePurchaseExpense
);

// ── Repair costs ──────────────────────────────────────────────────────────────
router.post(
  '/:id/repair',
  protect,
  authorizeRoles('admin', 'sales'),
  uploadBillImage, // Single image upload for bills/receipts
  addExpenseRules,
  validate,
  addRepairCost
);
router.delete(
  '/:id/repair/:repId',
  protect,
  authorizeRoles('admin', 'sales'),
  deleteRepairCost
);

// ── Status management ─────────────────────────────────────────────────────────
router.put('/:id/status',     protect, authorizeRoles('admin', 'sales'), updateStatus);
router.put('/:id/mark-ready', protect, authorizeRoles('admin', 'sales'), uploadRepairMedia, markReady);

// ── Sell & Approvals ─────────────────────────────────────────────────────────
router.post(
  '/:id/sell',
  protect,
  authorizeRoles('admin', 'sales'),
  sellCarRules,
  validate,
  sellCar
);

router.put(
  '/:id/approve-sale',
  protect,
  authorizeRoles('admin'),
  approveSale
);

module.exports = router;
