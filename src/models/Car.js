const mongoose = require('mongoose');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
    billImage: { type: String }, // Cloudinary URL
  },
  { _id: true }
);

// ─── Main Car Schema ──────────────────────────────────────────────────────────

const carSchema = new mongoose.Schema(
  {
    // ── Basic Info ────────────────────────────────────────────────────────────
    brand: { type: String, required: [true, 'Brand is required'], trim: true },
    model: { type: String, required: [true, 'Model is required'], trim: true },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [1990, 'Year must be 1990 or later'],
      max: [new Date().getFullYear() + 1, 'Year cannot be in the future'],
    },
    fuelType: {
      type: String,
      enum: ['petrol', 'diesel', 'electric', 'cng', 'hybrid'],
      required: [true, 'Fuel type is required'],
    },
    ownerType: {
      type: String,
      enum: ['1st', '2nd', '3rd', '4th+'],
      required: [true, 'Owner type is required'],
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    mileage: { type: Number, default: 0 }, // Added: how many kilometers car runs
    chassisNumber: { type: String, trim: true },
    images: [{ type: String }],        // Cloudinary URLs — car photos
    repairImages: [{ type: String }],   // After-repair photos
    repairBills: [{ type: String }],    // Repair bill images/PDFs

    // ── Purchase Info ─────────────────────────────────────────────────────────
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: 0,
    },
    paymentMode: {
      type: String,
      enum: ['cash', 'gpay', 'neft', 'other'],
      default: 'cash',
    },
    utrNumber: {
      type: String,
      trim: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    paymentDescription: {
      type: String,
      trim: true,
    },
    purchasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    purchaseDate: { type: Date, default: Date.now },

    // ── Expenses ──────────────────────────────────────────────────────────────
    purchaseExpenses: [expenseSchema], // Transport, food, fuel, etc.
    repairCosts: [expenseSchema],      // Engine, paint, service, etc.
    repairTotalAmount: { type: Number, default: 0 }, // Manual summary from Sales team

    // ── Sale Info ─────────────────────────────────────────────────────────────
    sellingPrice: { type: Number, default: 0 },
    soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    soldDate: { type: Date },
    customerDetails: {
      name: { type: String, trim: true },
      phone: { type: String },
      address: { type: String },
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['purchased', 'repair', 'ready', 'sold', 'sale_pending'],
      default: 'purchased',
    },

    // ── Approval Info ─────────────────────────────────────────────────────────
    saleApproval: {
      isPending: { type: Boolean, default: false },
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      requestedAt: { type: Date },
      requestedPrice: { type: Number },
      customerDetails: {
        name: { type: String, trim: true },
        phone: { type: String },
        address: { type: String },
      },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approvedAt: { type: Date },
    },

    // ── Soft Delete ───────────────────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────

carSchema.virtual('totalPurchaseExpenses').get(function () {
  return (this.purchaseExpenses || []).reduce((sum, e) => sum + e.amount, 0);
});

carSchema.virtual('totalRepairCost').get(function () {
  return (this.repairCosts || []).reduce((sum, e) => sum + e.amount, 0);
});

carSchema.virtual('totalCost').get(function () {
  return this.purchasePrice + this.totalPurchaseExpenses + this.totalRepairCost;
});

carSchema.virtual('profit').get(function () {
  if (this.status !== 'sold') return null;
  return this.sellingPrice - this.totalCost;
});

carSchema.virtual('isLoss').get(function () {
  if (this.profit === null) return null;
  return this.profit < 0;
});

// ─── Indexes ──────────────────────────────────────────────────────────────────

carSchema.index({ status: 1 });
// registrationNumber already has unique:true on the field definition — no duplicate index needed
carSchema.index({ brand: 1, model: 1 });
carSchema.index({ purchasedBy: 1 });
carSchema.index({ createdAt: -1 });
carSchema.index({ isDeleted: 1, status: 1 });

module.exports = mongoose.model('Car', carSchema);
