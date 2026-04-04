const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String },
    action: {
      type: String,
      enum: [
        'car_created',
        'car_updated',
        'car_deleted',
        'status_changed',
        'expense_added',
        'expense_deleted',
        'repair_added',
        'repair_deleted',
        'car_sold',
        'user_created',
        'user_login',
      ],
      required: true,
    },
    car: { type: mongoose.Schema.Types.ObjectId, ref: 'Car' },
    carInfo: { type: String }, // Snapshot: "Hyundai i20 (KL07C1234)"
    details: { type: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ car: 1, createdAt: -1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
