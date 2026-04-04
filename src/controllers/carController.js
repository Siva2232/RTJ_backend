const Car = require('../models/Car');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/ApiResponse');
const { getCarWithDetails, buildCarQuery, enrichCar } = require('../services/carService');
const { logActivity } = require('../services/activityService');
const { sendNotification } = require('../services/notificationService');
const { exportCarsToExcel } = require('../services/exportService');

// ─── GET /api/cars ────────────────────────────────────────────────────────────
const getAllCars = async (req, res) => {
  const { filter, sort } = buildCarQuery(req.query);
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  const skip  = (page - 1) * limit;

  const [total, cars] = await Promise.all([
    Car.countDocuments(filter),
    Car.find(filter)
      .populate('purchasedBy', 'name role')
      .populate('soldBy', 'name role')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
  ]);

  let enriched = cars.map(enrichCar);

  // Computed-field sorting must happen in JS
  if (req.query.sortBy === 'profit') {
    enriched.sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));
  } else if (req.query.sortBy === 'totalCost') {
    enriched.sort((a, b) => b.totalCost - a.totalCost);
  }

  return sendSuccess(
    res,
    200,
    {
      cars: enriched,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    },
    'Cars fetched'
  );
};

// ─── GET /api/cars/:id ────────────────────────────────────────────────────────
const getCarById = async (req, res) => {
  const car = await getCarWithDetails(req.params.id);
  if (!car) throw new ApiError(404, 'Car not found');
  return sendSuccess(res, 200, { car: enrichCar(car) }, 'Car details fetched');
};

// ─── POST /api/cars ───────────────────────────────────────────────────────────
const createCar = async (req, res) => {
  const {
    brand, model, year, fuelType, ownerType,
    registrationNumber, chassisNumber, mileage, purchasePrice, purchaseDate,
  } = req.body;

  const regNo = registrationNumber.toUpperCase();
  const existing = await Car.findOne({ registrationNumber: regNo });
  if (existing) {
    throw new ApiError(409, `Car with registration '${regNo}' already exists`);
  }

  // Support local storage paths - handle .fields() from multer
  const imageUrls = req.files && req.files.images 
    ? req.files.images.map((f) => `/uploads/cars/${f.filename}`) 
    : [];

  const purchaseExpenses = req.body.purchaseExpenses ? JSON.parse(req.body.purchaseExpenses) : [];
  const bills = req.files && req.files.expenseBills ? req.files.expenseBills : [];
  
  // Map bills to expenses
  let billCounter = 0;
  const processedExpenses = purchaseExpenses.map(exp => {
    const expense = {
      title: exp.title,
      amount: Number(exp.amount),
      addedBy: req.user._id, // Set the user who added the expense
    };
    if (exp.bill && bills[billCounter]) {
      expense.billImage = `/uploads/expenses/${bills[billCounter].filename}`;
      billCounter++;
    }
    return expense;
  });

  const car = await Car.create({
    brand, model, year: Number(year), fuelType, ownerType,
    registrationNumber: regNo,
    chassisNumber,
    mileage: Number(mileage) || 0,
    purchasePrice: Number(purchasePrice),
    purchasedBy: req.user._id,
    purchaseDate: purchaseDate || new Date(),
    images: imageUrls,
    purchaseExpenses: processedExpenses,
  });

  await logActivity({
    user: req.user,
    action: 'car_created',
    car,
    details: { purchasePrice },
    ipAddress: req.ip,
  });

  return sendSuccess(res, 201, { car }, 'Car added successfully');
};

// ─── DELETE /api/cars/:id (admin — soft delete) ───────────────────────────────
const deleteCar = async (req, res) => {
  const car = await Car.findOne({ _id: req.params.id, isDeleted: false });
  if (!car) throw new ApiError(404, 'Car not found');

  car.isDeleted  = true;
  car.deletedAt  = new Date();
  car.deletedBy  = req.user._id;
  await car.save();

  await logActivity({
    user: req.user,
    action: 'car_deleted',
    car,
    details: { registrationNumber: car.registrationNumber },
    ipAddress: req.ip,
  });

  return sendSuccess(res, 200, null, 'Car deleted successfully');
};

// ─── POST /api/cars/:id/purchase-expense ──────────────────────────────────────
const addPurchaseExpense = async (req, res) => {
  const { title, amount, date } = req.body;
  const billImage = req.file ? `/uploads/expenses/${req.file.filename}` : undefined;

  const car = await Car.findOne({ _id: req.params.id, isDeleted: false });    
  if (!car) throw new ApiError(404, 'Car not found');

  car.purchaseExpenses.push({
    title,
    amount: Number(amount),
    addedBy: req.user._id,
    date: date || new Date(),
    billImage,
  });
  await car.save();

  await logActivity({
    user: req.user,
    action: 'expense_added',
    car,
    details: { type: 'purchase', title, amount: Number(amount) },
    ipAddress: req.ip,
  });

  return sendSuccess(res, 201, { car }, 'Purchase expense added');
};
// ─── DELETE /api/cars/:id/purchase-expense/:expId ─────────────────────────────
const deletePurchaseExpense = async (req, res) => {
  const car = await Car.findOne({ _id: req.params.id, isDeleted: false });
  if (!car) throw new ApiError(404, 'Car not found');

  const before = car.purchaseExpenses.length;
  car.purchaseExpenses.pull({ _id: req.params.expId });
  if (car.purchaseExpenses.length === before) {
    throw new ApiError(404, 'Purchase expense not found');
  }

  await car.save();

  await logActivity({
    user: req.user,
    action: 'expense_deleted',
    car,
    details: { expId: req.params.expId },
    ipAddress: req.ip,
  });

  return sendSuccess(res, 200, { car }, 'Purchase expense deleted');
};

// ─── POST /api/cars/:id/repair ────────────────────────────────────────────────
const addRepairCost = async (req, res) => {
  const { title, amount, date } = req.body;
  const billImage = req.file ? `/uploads/expenses/${req.file.filename}` : undefined;

  const car = await Car.findOne({ _id: req.params.id, isDeleted: false });    
  if (!car) throw new ApiError(404, 'Car not found');

  car.repairCosts.push({
    title,
    amount: Number(amount),
    addedBy: req.user._id,
    date: date || new Date(),
    billImage,
  });
  await car.save();

  await logActivity({
    user: req.user,
    action: 'repair_added',
    car,
    details: { title, amount: Number(amount) },
    ipAddress: req.ip,
  });

  return sendSuccess(res, 201, { car }, 'Repair cost added');
};
// ─── DELETE /api/cars/:id/repair/:repId ──────────────────────────────────────
const deleteRepairCost = async (req, res) => {
  const car = await Car.findOne({ _id: req.params.id, isDeleted: false });
  if (!car) throw new ApiError(404, 'Car not found');

  const before = car.repairCosts.length;
  car.repairCosts.pull({ _id: req.params.repId });
  if (car.repairCosts.length === before) {
    throw new ApiError(404, 'Repair record not found');
  }

  await car.save();

  await logActivity({
    user: req.user,
    action: 'repair_deleted',
    car,
    details: { repId: req.params.repId },
    ipAddress: req.ip,
  });

  return sendSuccess(res, 200, { car }, 'Repair cost deleted');
};

// ─── PUT /api/cars/:id/status ─────────────────────────────────────────────────
const updateStatus = async (req, res) => {
  const VALID_STATUSES = ['purchased', 'repair', 'ready', 'sold'];
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const car = await Car.findOne({ _id: req.params.id, isDeleted: false });
  if (!car) throw new ApiError(404, 'Car not found');
  if (car.status === 'sold') throw new ApiError(400, 'Sold cars cannot be status-changed');

  const oldStatus = car.status;
  car.status = status;
  await car.save();

  await logActivity({
    user: req.user,
    action: 'status_changed',
    car,
    details: { from: oldStatus, to: status },
    ipAddress: req.ip,
  });

  return sendSuccess(res, 200, { car }, `Status updated to '${status}'`);
};

// ─── PUT /api/cars/:id/mark-ready ─────────────────────────────────────────────
const markReady = async (req, res) => {
  const car = await Car.findOne({ _id: req.params.id, isDeleted: false });
  if (!car) throw new ApiError(404, 'Car not found');
  if (car.status === 'sold') throw new ApiError(400, 'Car is already sold');

  // Handle Cloudinary-uploaded files
  if (req.files) {
    if (req.files.carImage?.[0]) {
      car.repairImages = [req.files.carImage[0].path];
    }
    if (req.files.bills?.length) {
      car.repairBills = req.files.bills.map((f) => f.path);
    }
  }

  if (req.body.repairTotalAmount) {
    car.repairTotalAmount = Number(req.body.repairTotalAmount);
  }

  car.status = 'ready';
  await car.save();

  await logActivity({
    user: req.user,
    action: 'status_changed',
    car,
    details: {
      from: 'repair',
      to: 'ready',
      repairTotalAmount: car.repairTotalAmount,
    },
    ipAddress: req.ip,
  });

  return sendSuccess(res, 200, { car }, 'Car marked as ready to sell');
};

// ─── POST /api/cars/:id/sell (request approval) ───────────────────────────────
const sellCar = async (req, res) => {
  const { sellingPrice, customerDetails } = req.body;

  const car = await Car.findOne({ _id: req.params.id, isDeleted: false });
  if (!car) throw new ApiError(404, 'Car not found');
  if (car.status === 'sold') throw new ApiError(400, 'Car is already sold');
  if (car.status === 'sale_pending') throw new ApiError(400, 'Sale approval is already pending');
  if (car.status !== 'ready') {
    throw new ApiError(400, 'Only cars with status "ready" can be sold');
  }

  // Set pending approval state instead of selling immediately
  car.status = 'sale_pending';
  car.saleApproval = {
    isPending: true,
    requestedBy: req.user._id,
    requestedAt: new Date(),
    requestedPrice: Number(sellingPrice),
    customerDetails,
  };

  await car.save();

  await logActivity({
    user: req.user,
    action: 'sale_requested',
    car,
    details: { requestedPrice: Number(sellingPrice), customer: customerDetails?.name },
    ipAddress: req.ip,
  });

  return sendSuccess(res, 200, { car }, 'Sale request sent to admin for approval');
};

// ─── PUT /api/cars/:id/approve-sale (Admin only) ──────────────────────────────
const approveSale = async (req, res) => {
  const { action } = req.body; // 'approve' or 'reject'

  const car = await Car.findOne({ _id: req.params.id, isDeleted: false });
  if (!car) throw new ApiError(404, 'Car not found');
  if (car.status !== 'sale_pending') throw new ApiError(400, 'No pending sale for this car');

  if (action === 'approve') {
    car.status = 'sold';
    car.sellingPrice = car.saleApproval.requestedPrice;
    car.customerDetails = car.saleApproval.customerDetails;
    car.soldBy = car.saleApproval.requestedBy;
    car.soldDate = new Date();

    car.saleApproval.isPending = false;
    car.saleApproval.approvedBy = req.user._id;
    car.saleApproval.approvedAt = new Date();

    await car.save();

    // Notify the sales staff who requested this approval
    if (car.soldBy) {
      await sendNotification(
        car.soldBy,
        "Sale Approved!",
        `Congratulations! Your sale request for ${car.brand} ${car.model} has been approved.`,
        "sale_approved",
        car._id
      );
    }

    // Notify the purchase staff who bought this car
    if (car.purchasedBy) {
      await sendNotification(
        car.purchasedBy,
        "Car Sold!",
        `Great work! The car you purchased (${car.brand} ${car.model}) has just been sold.`,
        "purchase_sold_success",
        car._id
      );
    }

    await logActivity({
      user: req.user,
      action: 'sale_approved',
      car,
      details: { sellingPrice: car.sellingPrice },
      ipAddress: req.ip,
    });

    return sendSuccess(res, 200, { car }, 'Sale approved and car marked as sold');
  } else if (action === 'reject') {
    const originalRequester = car.saleApproval.requestedBy;
    const carDetails = `${car.brand} ${car.model}`;
    const carId = car._id;

    car.status = 'ready'; // Move back to ready
    car.saleApproval.isPending = false;

    await car.save();

    // Notify the sales staff who requested this approval
    if (originalRequester) {
      await sendNotification(
        originalRequester,
        "Sale Request Rejected",
        `Your sale request for ${carDetails} has been rejected by the admin. The car is back in inventory.`,
        "sale_rejected",
        carId
      );
    }

    await logActivity({
      user: req.user,
      action: 'sale_rejected',
      car,
      ipAddress: req.ip,
    });

    return sendSuccess(res, 200, { car }, 'Sale request rejected, car is back in inventory');
  } else {
    throw new ApiError(400, 'Invalid action. Use "approve" or "reject".');
  }
};

// ─── GET /api/cars/export/excel ───────────────────────────────────────────────
const exportExcel = async (req, res) => {
  const { filter } = buildCarQuery(req.query);
  const cars = await Car.find(filter)
    .populate('purchasedBy', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const workbook  = await exportCarsToExcel(cars);
  const filename  = `cars-export-${Date.now()}.xlsx`;

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
};

module.exports = {
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
};
