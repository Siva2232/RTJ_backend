const ActivityLog = require('../models/ActivityLog');
const { sendSuccess } = require('../utils/ApiResponse');

// ─── GET /api/activity ────────────────────────────────────────────────────────
const getLogs = async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 30);
  const skip  = (page - 1) * limit;

  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.user)   filter.user   = req.query.user;
  if (req.query.car)    filter.car    = req.query.car;

  const [total, logs] = await Promise.all([
    ActivityLog.countDocuments(filter),
    ActivityLog.find(filter)
      .populate('user', 'name role')
      .populate('car', 'brand model registrationNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return sendSuccess(
    res,
    200,
    {
      logs,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    },
    'Activity logs fetched'
  );
};

module.exports = { getLogs };
