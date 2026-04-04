const ExcelJS = require('exceljs');
const { enrichCar } = require('./carService');

/**
 * Generate an Excel workbook for the provided cars array.
 * Returns an ExcelJS.Workbook instance — caller writes to response.
 */
const exportCarsToExcel = async (cars) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Car Service Manager';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Cars Inventory', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // ─── Column definitions ────────────────────────────────────────────────────
  sheet.columns = [
    { header: '#',                  key: 'sno',           width: 5  },
    { header: 'Brand',              key: 'brand',         width: 14 },
    { header: 'Model',              key: 'model',         width: 16 },
    { header: 'Year',               key: 'year',          width: 8  },
    { header: 'Reg. No.',           key: 'regNo',         width: 14 },
    { header: 'Fuel',               key: 'fuel',          width: 10 },
    { header: 'Owner',              key: 'owner',         width: 8  },
    { header: 'Status',             key: 'status',        width: 12 },
    { header: 'Purchase Price (₹)', key: 'purchasePrice', width: 20 },
    { header: 'Purchase Exp. (₹)',  key: 'purchaseExp',   width: 18 },
    { header: 'Repair Cost (₹)',    key: 'repairCost',    width: 16 },
    { header: 'Total Cost (₹)',     key: 'totalCost',     width: 16 },
    { header: 'Selling Price (₹)',  key: 'sellingPrice',  width: 18 },
    { header: 'Profit / Loss (₹)',  key: 'profit',        width: 18 },
    { header: 'Customer',           key: 'customer',      width: 18 },
    { header: 'Sold Date',          key: 'soldDate',      width: 14 },
    { header: 'Purchased By',       key: 'purchasedBy',   width: 16 },
  ];

  // ─── Style header row ──────────────────────────────────────────────────────
  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.font   = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // ─── Data rows ─────────────────────────────────────────────────────────────
  cars.forEach((car, idx) => {
    const e = enrichCar(car);
    const row = sheet.addRow({
      sno:          idx + 1,
      brand:        car.brand,
      model:        car.model,
      year:         car.year,
      regNo:        car.registrationNumber,
      fuel:         car.fuelType,
      owner:        car.ownerType,
      status:       car.status,
      purchasePrice: car.purchasePrice,
      purchaseExp:  e.totalPurchaseExpenses,
      repairCost:   e.totalRepairCost,
      totalCost:    e.totalCost,
      sellingPrice: car.status === 'sold' ? car.sellingPrice : '—',
      profit:       e.profit !== null ? e.profit : '—',
      customer:     car.customerDetails?.name || '—',
      soldDate:     car.soldDate
        ? new Date(car.soldDate).toLocaleDateString('en-IN')
        : '—',
      purchasedBy:  car.purchasedBy?.name || '—',
    });

    // Color profit/loss cell
    if (e.profit !== null) {
      const cell = row.getCell('profit');
      cell.font = {
        bold: true,
        color: { argb: e.profit >= 0 ? 'FF16A34A' : 'FFDC2626' },
      };
    }

    // Zebra striping
    if (idx % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      });
    }
  });

  // ─── Auto-filter ───────────────────────────────────────────────────────────
  sheet.autoFilter = { from: 'A1', to: 'Q1' };

  return workbook;
};

/**
 * Generate a period report workbook (2 sheets: Summary + Car Details).
 * @param {object[]} soldCars  — enriched sold cars within the period
 * @param {object[]} allCars   — all enriched cars purchased within the period
 * @param {string}   period    — 'weekly' | 'monthly' | 'yearly'
 * @param {Date}     from      — period start date
 * @param {Date}     to        — period end date
 */
const exportPeriodReport = async (soldCars, allCars, period, from, to) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Car Service Manager';
  workbook.created = new Date();

  const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
  const dateRange = `${from.toLocaleDateString('en-IN')} – ${to.toLocaleDateString('en-IN')}`;

  // ─── Sheet 1: Summary ────────────────────────────────────────────────────
  const summary = workbook.addWorksheet('Summary');
  summary.views = [{}];

  // Title
  summary.mergeCells('A1:D1');
  const titleCell = summary.getCell('A1');
  titleCell.value = `${periodLabel} Business Report`;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF1E40AF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summary.getRow(1).height = 32;

  summary.mergeCells('A2:D2');
  const rangeCell = summary.getCell('A2');
  rangeCell.value = dateRange;
  rangeCell.font = { size: 11, color: { argb: 'FF64748B' } };
  rangeCell.alignment = { horizontal: 'center' };
  summary.getRow(2).height = 20;

  // Section heading helper
  const addSectionHeader = (row, label) => {
    summary.mergeCells(`A${row}:D${row}`);
    const c = summary.getCell(`A${row}`);
    c.value = label;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    c.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    c.alignment = { horizontal: 'left', indent: 1 };
    summary.getRow(row).height = 22;
  };

  const addRow = (rowNum, label, value, isCurrency = false) => {
    const r = summary.getRow(rowNum);
    r.height = 20;
    const lc = r.getCell(1);
    lc.value = label;
    lc.font = { size: 11, color: { argb: 'FF334155' } };
    lc.alignment = { indent: 1 };

    const vc = r.getCell(3);
    vc.value = isCurrency ? { formula: `=C${rowNum}`, sharedFormula: undefined, result: value } : value;
    vc.value = value;
    if (isCurrency) {
      vc.numFmt = '₹#,##0';
    }
    vc.font = { bold: true, size: 11 };
    vc.alignment = { horizontal: 'right' };
  };

  // Compute summary metrics
  const totalRevenue    = soldCars.reduce((s, c) => s + (c.sellingPrice || 0), 0);
  const totalProfit     = soldCars.reduce((s, c) => s + (c.profit || 0), 0);
  const totalInvestment = allCars.reduce((s, c) => s + (c.totalCost || 0), 0);
  const unitsSold       = soldCars.length;
  const unitsPurchased  = allCars.length;
  const avgProfit       = unitsSold ? Math.round(totalProfit / unitsSold) : 0;
  const lossCount       = soldCars.filter((c) => (c.profit || 0) < 0).length;

  // Sales summary
  addSectionHeader(4, 'Sales Overview');
  addRow(5, 'Units Sold', unitsSold);
  addRow(6, 'Total Revenue', totalRevenue, true);
  addRow(7, 'Total Profit / Loss', totalProfit, true);
  addRow(8, 'Average Profit per Unit', avgProfit, true);
  addRow(9, 'Loss-making Sales', lossCount);

  // Purchase summary
  addSectionHeader(11, 'Purchase Overview');
  addRow(12, 'Units Purchased', unitsPurchased);
  addRow(13, 'Total Investment', totalInvestment, true);

  // Staff performance
  const salesTeam = {};
  soldCars.forEach((car) => {
    const name = car.soldBy?.name || 'Unknown';
    if (!salesTeam[name]) salesTeam[name] = { sales: 0, revenue: 0, profit: 0 };
    salesTeam[name].sales++;
    salesTeam[name].revenue += car.sellingPrice || 0;
    salesTeam[name].profit += car.profit || 0;
  });

  addSectionHeader(15, 'Sales Staff Performance');
  const staffHeader = summary.getRow(16);
  staffHeader.height = 18;
  ['Staff', 'Units Sold', 'Revenue (₹)', 'Profit (₹)'].forEach((h, i) => {
    const cell = staffHeader.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: 'FF1E40AF' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });

  let sRow = 17;
  Object.entries(salesTeam).forEach(([name, data]) => {
    const r = summary.getRow(sRow++);
    r.height = 18;
    r.getCell(1).value = name;
    r.getCell(2).value = data.sales;
    const rv = r.getCell(3);
    rv.value = data.revenue;
    rv.numFmt = '₹#,##0';
    const pv = r.getCell(4);
    pv.value = data.profit;
    pv.numFmt = '₹#,##0';
    pv.font = { bold: true, color: { argb: data.profit >= 0 ? 'FF16A34A' : 'FFDC2626' } };
  });

  summary.columns = [
    { key: 'a', width: 28 },
    { key: 'b', width: 10 },
    { key: 'c', width: 20 },
    { key: 'd', width: 20 },
  ];

  // ─── Sheet 2: Sold Cars Detail ───────────────────────────────────────────
  const detail = workbook.addWorksheet('Sold Cars Detail', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  detail.columns = [
    { header: '#',                  key: 'sno',           width: 5  },
    { header: 'Brand',              key: 'brand',         width: 14 },
    { header: 'Model',              key: 'model',         width: 16 },
    { header: 'Year',               key: 'year',          width: 8  },
    { header: 'Reg. No.',           key: 'regNo',         width: 14 },
    { header: 'Total Cost (₹)',     key: 'totalCost',     width: 16 },
    { header: 'Selling Price (₹)',  key: 'sellingPrice',  width: 18 },
    { header: 'Profit / Loss (₹)',  key: 'profit',        width: 18 },
    { header: 'Customer',           key: 'customer',      width: 18 },
    { header: 'Sold By',            key: 'soldBy',        width: 16 },
    { header: 'Sold Date',          key: 'soldDate',      width: 14 },
  ];

  const dHeaderRow = detail.getRow(1);
  dHeaderRow.height = 22;
  dHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  soldCars.forEach((car, idx) => {
    const row = detail.addRow({
      sno:          idx + 1,
      brand:        car.brand,
      model:        car.model,
      year:         car.year,
      regNo:        car.registrationNumber,
      totalCost:    car.totalCost,
      sellingPrice: car.sellingPrice,
      profit:       car.profit,
      customer:     car.customerDetails?.name || '—',
      soldBy:       car.soldBy?.name || '—',
      soldDate:     car.soldDate ? new Date(car.soldDate).toLocaleDateString('en-IN') : '—',
    });

    const profitCell = row.getCell('profit');
    profitCell.numFmt = '₹#,##0';
    profitCell.font = { bold: true, color: { argb: (car.profit || 0) >= 0 ? 'FF16A34A' : 'FFDC2626' } };

    if (idx % 2 === 0) {
      row.eachCell((cell) => {
        if (!cell.fill || cell.fill.fgColor?.argb !== 'FF16A34A') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      });
    }
  });

  detail.autoFilter = { from: 'A1', to: 'K1' };

  return workbook;
};

module.exports = { exportCarsToExcel, exportPeriodReport };
