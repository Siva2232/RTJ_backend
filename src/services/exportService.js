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

module.exports = { exportCarsToExcel };
