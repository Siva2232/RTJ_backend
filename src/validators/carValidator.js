const { body, validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

const CURRENT_YEAR = new Date().getFullYear();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msgs = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    return next(new ApiError(422, 'Validation failed', msgs));
  }
  next();
};

const addCarRules = [
  body('brand').trim().notEmpty().withMessage('Brand is required'),
  body('model').trim().notEmpty().withMessage('Model is required'),
  body('year')
    .isInt({ min: 1990, max: CURRENT_YEAR + 1 })
    .withMessage(`Year must be between 1990 and ${CURRENT_YEAR + 1}`),
  body('fuelType')
    .isIn(['petrol', 'diesel', 'electric', 'cng', 'hybrid'])
    .withMessage('Fuel type must be: petrol, diesel, electric, cng, or hybrid'),
  body('ownerType')
    .isIn(['1st', '2nd', '3rd', '4th+'])
    .withMessage('Owner type must be: 1st, 2nd, 3rd, or 4th+'),
  body('registrationNumber')
    .trim()
    .notEmpty()
    .withMessage('Registration number is required'),
  body('mileage')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Mileage must be a non-negative number'),
  body('purchasePrice')
    .isFloat({ min: 0 })
    .withMessage('Purchase price must be a positive number'),
];

const addExpenseRules = [
  body('title').trim().notEmpty().withMessage('Expense title is required'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
];

const sellCarRules = [
  body('sellingPrice')
    .isFloat({ min: 1 })
    .withMessage('Selling price must be greater than 0'),
  body('customerDetails.name')
    .trim()
    .notEmpty()
    .withMessage('Customer name is required'),
  body('customerDetails.phone')
    .matches(/^\d{10}$/)
    .withMessage('Customer phone must be a valid 10-digit number'),
];

module.exports = { validate, addCarRules, addExpenseRules, sellCarRules };
