const Car = require('../models/Car');
const ActivityLog = require('../models/ActivityLog');
const { sendSuccess } = require('../utils/ApiResponse');
const { enrichCar } = require('../services/carService');

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────
const getStats = async (req, res) => {
  const [allCars, recentActivity] = await Promise.all([
    Car.find({ isDeleted: false }).lean(),
    ActivityLog.find({})
      .sort({ createdAt: -1 })
      .limit(15)
      .populate('user', 'name role')
      .lean(),
  ]);

  const enriched  = allCars.map(enrichCar);
  const soldCars  = enriched.filter((c) => c.status === 'sold');
  const activeCars = enriched.filter((c) => c.status !== 'sold');

  const totalInvestment = enriched.reduce((s, c) => s + c.totalCost, 0);
  const totalRevenue    = soldCars.reduce((s, c) => s + (c.sellingPrice || 0), 0);
  const totalProfit     = soldCars.reduce((s, c) => s + (c.profit || 0), 0);
  const lossCount       = soldCars.filter((c) => c.isLoss).length;

  const byStatus = {
    purchased: enriched.filter((c) => c.status === 'purchased').length,
    repair:    enriched.filter((c) => c.status === 'repair').length,
    ready:     enriched.filter((c) => c.status === 'ready').length,
    sold:      soldCars.length,
  };

  // ─── Monthly stats (last 12 months) ───────────────────────────────────────
  const now = new Date();
  const monthlySales = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthCars = soldCars.filter((c) => {
      const sd = new Date(c.soldDate);
      return (
        sd.getFullYear() === d.getFullYear() &&
        sd.getMonth() === d.getMonth()
      );
    });
    monthlySales.push({
      month:   d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
      revenue: monthCars.reduce((s, c) => s + (c.sellingPrice || 0), 0),
      profit:  monthCars.reduce((s, c) => s + (c.profit || 0), 0),
      count:   monthCars.length,
    });
  }

  // ─── Top 5 most profitable sold cars ──────────────────────────────────────
  const topProfitCars = soldCars
    .sort((a, b) => (b.profit || 0) - (a.profit || 0))
    .slice(0, 5)
    .map((c) => ({
      id:                 c._id,
      brand:              c.brand,
      model:              c.model,
      registrationNumber: c.registrationNumber,
      totalCost:          c.totalCost,
      sellingPrice:       c.sellingPrice,
      profit:             c.profit,
    }));

  return sendSuccess(
    res,
    200,
    {
      overview: {
        totalCars:        enriched.length,
        activeCars:       activeCars.length,
        soldCars:         soldCars.length,
        totalInvestment,
        totalRevenue,
        totalProfit,
        lossCount,
        byStatus,
      },
      monthlySales,
      topProfitCars,
      recentActivity,
    },
    'Dashboard stats fetched'
  );
};

module.exports = { getStats };
