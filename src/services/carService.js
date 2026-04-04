const Car = require('../models/Car');

/**
 * Fetch a single car with all populated references and virtual fields.
 */
const getCarWithDetails = async (carId) => {
  return Car.findOne({ _id: carId, isDeleted: false })
    .populate('purchasedBy', 'name email role')
    .populate('soldBy', 'name email role')
    .populate('purchaseExpenses.addedBy', 'name role')
    .populate('repairCosts.addedBy', 'name role')
    .lean({ virtuals: true });
};

/**
 * Build a MongoDB filter + sort object from request query params.
 *
 * Supported params:
 *   status     — purchased | repair | ready | sold | all
 *   search     — partial match on brand, model, registrationNumber, chassisNumber
 *   minPrice   — purchasePrice >= minPrice
 *   maxPrice   — purchasePrice <= maxPrice
 *   sortBy     — date (default) | purchasePrice | profit | totalCost
 */
const buildCarQuery = (queryParams = {}) => {
  const { status, search, minPrice, maxPrice, sortBy } = queryParams;
  const filter = { isDeleted: false };

  if (status && status !== 'all') filter.status = status;

  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { brand: rx },
      { model: rx },
      { registrationNumber: rx },
      { chassisNumber: rx },
    ];
  }

  if (minPrice || maxPrice) {
    filter.purchasePrice = {};
    if (minPrice) filter.purchasePrice.$gte = Number(minPrice);
    if (maxPrice) filter.purchasePrice.$lte = Number(maxPrice);
  }

  // profit and totalCost are computed fields — sorted in JS after fetching
  const sort =
    sortBy === 'purchasePrice' ? { purchasePrice: -1 } : { createdAt: -1 };

  return { filter, sort };
};

/**
 * Enrich a lean car object with computed financial fields.
 * Safe to call on Mongoose document virtuals too (they won't be double-counted).
 */
const enrichCar = (car) => {
  const totalPurchaseExpenses = (car.purchaseExpenses || []).reduce(
    (s, e) => s + (e.amount || 0),
    0
  );
  const totalRepairCost = (car.repairCosts || []).reduce(
    (s, e) => s + (e.amount || 0),
    0
  );
  const totalCost = (car.purchasePrice || 0) + totalPurchaseExpenses + totalRepairCost;
  const profit = car.status === 'sold' ? (car.sellingPrice || 0) - totalCost : null;

  return {
    ...car,
    totalPurchaseExpenses,
    totalRepairCost,
    totalCost,
    profit,
    isLoss: profit !== null ? profit < 0 : null,
  };
};

module.exports = { getCarWithDetails, buildCarQuery, enrichCar };
