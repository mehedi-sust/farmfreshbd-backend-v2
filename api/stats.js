/**
 * @api {get} /api/stats Get Farm Statistics
 * @apiName GetStats
 * @apiGroup Statistics
 * @apiVersion 1.0.0
 * @apiPermission authenticated
 * 
 * @apiHeader {String} Authorization Bearer token
 * 
 * @apiQuery {String} farm_id Farm ID
 * 
 * @apiSuccess {Object} stats Farm statistics including products, expenses, investments, sales
 */

const express = require('express');

const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const router = express.Router();



// Helper function to calculate stats
async function calculateFarmStats(farmIdObj, db) {
  const { products, expenses, investments, sales } = await getCollections(db);

  // Get products stats
  const productsList = await products.find({ farm_id: farmIdObj }).toArray();
  const totalProductValue = productsList.reduce((sum, p) => sum + (p.total_value || 0), 0);
  const productCount = productsList.reduce((sum, p) => sum + (p.quantity || 0), 0);

  // Get expenses stats
  const expensesList = await expenses.find({ farm_id: farmIdObj }).toArray();
  const totalExpenses = expensesList.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Get investments stats
  const investmentsList = await investments.find({ farm_id: farmIdObj }).toArray();
  const totalInvestments = investmentsList.reduce((sum, i) => sum + (i.amount || 0), 0);

  // Get sales stats - use profit from sales records (which includes expenses)
  const salesList = await sales.find({ farm_id: farmIdObj }).toArray();
  const totalSalesRevenue = salesList.reduce((sum, s) => sum + (s.quantity_sold * s.price_per_unit), 0);
  const soldProductCount = salesList.reduce((sum, s) => sum + (s.quantity_sold || 0), 0);
  
  // Calculate profit from sales (sales already have profit calculated including expenses)
  const salesProfit = salesList.reduce((sum, s) => sum + (s.profit || 0), 0);

  // Calculate Farm's Gross Profit: Sales Profit - Total Investments
  // This represents the overall profitability after considering all investments
  const grossProfit = salesProfit - totalInvestments;

  // Calculate total investment (investments + product costs for ROI calculation)
  const totalInvestment = totalInvestments + totalProductValue;

  // Calculate ROI: (Farm's Gross Profit / Total Investment) × 100
  // This shows the return on the total investment made (can be negative)
  const roi = totalInvestment > 0 ? (grossProfit / totalInvestment) * 100 : 0;

  return {
    total_products: totalProductValue,
    total_expenses: totalExpenses,
    product_count: productCount,
    total_profit: salesProfit, // Profit from sales (before investment deduction)
    gross_profit: grossProfit, // Farm's overall profit (after investment deduction)
    total_investments: totalInvestments,
    total_sales: totalSalesRevenue,
    sold_product_count: soldProductCount,
    roi: roi,
    total_investment: totalInvestment,
  };
}

// Get farm stats (query param version)
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const farmIdObj = toObjectId(farm_id);
  const stats = await calculateFarmStats(farmIdObj, db);

  res.json({
    farm_id,
    ...stats,
    updated_at: new Date().toISOString(),
  });
}));

// Get farm stats (path param version - what frontend uses)
router.get('/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const farmIdObj = toObjectId(farm_id);
  const stats = await calculateFarmStats(farmIdObj, db);

  res.json({
    farm_id,
    ...stats,
    updated_at: new Date().toISOString(),
  });
}));

// Update stats data (recalculate and return)
router.post('/farm/:farm_id/update_stats_data', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const farmIdObj = toObjectId(farm_id);
  const stats = await calculateFarmStats(farmIdObj, db);

  res.json({
    message: 'Stats updated successfully',
    current_stats: {
      farm_id,
      ...stats,
    },
    updated_at: new Date().toISOString(),
  });
}));

// Get monthly financial data
router.get('/farm/:farm_id/monthly_financial', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { products, expenses, investments, sales } = await getCollections(db);
  const farmIdObj = toObjectId(farm_id);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();

  const monthlyData = await Promise.all(months.map(async (month, index) => {
    const monthNum = index + 1;
    const startDate = new Date(currentYear, index, 1);
    const endDate = new Date(currentYear, index + 1, 0);

    // Get expenses for this month
    const monthExpenses = await expenses.find({
      farm_id: farmIdObj,
      date: { $gte: startDate, $lte: endDate }
    }).toArray();
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Get investments for this month
    const monthInvestments = await investments.find({
      farm_id: farmIdObj,
      date: { $gte: startDate, $lte: endDate }
    }).toArray();
    const totalInvestments = monthInvestments.reduce((sum, i) => sum + (i.amount || 0), 0);

    // Get sales for this month
    const monthSales = await sales.find({
      farm_id: farmIdObj,
      sale_date: { $gte: startDate, $lte: endDate }
    }).toArray();
    const totalSales = monthSales.reduce((sum, s) => sum + (s.quantity_sold * s.price_per_unit), 0);
    
    // Calculate profit from sales (sales already have profit calculated)
    const profit = monthSales.reduce((sum, s) => sum + (s.profit || 0), 0);

    // Get products created in this month
    const monthProducts = await products.find({
      farm_id: farmIdObj,
      created_at: { $gte: startDate, $lte: endDate }
    }).toArray();
    const productValue = monthProducts.reduce((sum, p) => sum + (p.total_value || 0), 0);

    return {
      month,
      investments: totalInvestments,
      expenses: totalExpenses,
      productValue,
      profit,
      sales: totalSales,
    };
  }));

  res.json(monthlyData);
}));

// Get current year profit data
router.get('/farm/:farm_id/current_year_profit', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { expenses, sales } = await getCollections(db);
  const farmIdObj = toObjectId(farm_id);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();

  const yearlyData = await Promise.all(months.map(async (month, index) => {
    const startDate = new Date(currentYear, index, 1);
    const endDate = new Date(currentYear, index + 1, 0);

    // Get expenses for this month
    const monthExpenses = await expenses.find({
      farm_id: farmIdObj,
      date: { $gte: startDate, $lte: endDate }
    }).toArray();
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Get sales for this month
    const monthSales = await sales.find({
      farm_id: farmIdObj,
      sale_date: { $gte: startDate, $lte: endDate }
    }).toArray();
    const revenue = monthSales.reduce((sum, s) => sum + (s.quantity_sold * s.price_per_unit), 0);
    
    // Calculate profit from sales (sales already have profit calculated)
    const profit = monthSales.reduce((sum, s) => sum + (s.profit || 0), 0);

    return {
      month,
      profit,
      expenses: totalExpenses,
      revenue,
    };
  }));

  res.json(yearlyData);
}));

// Get profit over time (for chart)
router.get('/farm/:farm_id/profit_over_time', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { expenses, sales } = await getCollections(db);
  const farmIdObj = toObjectId(farm_id);

  // Get last 12 months of data
  const currentDate = new Date();
  const profitData = [];

  for (let i = 11; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    // Get expenses for this month
    const monthExpenses = await expenses.find({
      farm_id: farmIdObj,
      date: { $gte: startDate, $lte: endDate }
    }).toArray();
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Get sales for this month
    const monthSales = await sales.find({
      farm_id: farmIdObj,
      sale_date: { $gte: startDate, $lte: endDate }
    }).toArray();
    const revenue = monthSales.reduce((sum, s) => sum + (s.quantity_sold * s.price_per_unit), 0);
    
    // Calculate profit from sales (sales already have profit calculated)
    const profit = monthSales.reduce((sum, s) => sum + (s.profit || 0), 0);

    profitData.push({
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      value: profit,
    });
  }

  res.json(profitData);
}));

// Get batch summaries with cost analysis
router.get('/farm/:farm_id/batch_summaries', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { products, expenses, product_batches: productBatches, sales } = await getCollections(db);
  const farmIdObj = toObjectId(farm_id);

  // Get all batches for this farm
  const batches = await productBatches.find({ farm_id: farmIdObj }).toArray();

  const batchSummaries = [];

  for (const batch of batches) {
    const batchId = batch._id.toString();

    // Get all products in this batch (both sold and unsold)
    const batchProducts = await products.find({
      farm_id: farmIdObj,
      product_batch: batchId
    }).toArray();

    // Get all expenses for this batch
    const batchExpenses = await expenses.find({
      farm_id: farmIdObj,
      product_batch: batchId
    }).toArray();

    const totalExpenses = batchExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Calculate original quantities (current + sold)
    const productsWithSales = await Promise.all(batchProducts.map(async (product) => {
      // Get sales for this product
      const productSales = await sales.find({
        product_id: product._id,
        farm_id: farmIdObj
      }).toArray();

      const soldQuantity = productSales.reduce((sum, s) => sum + (s.quantity_sold || 0), 0);
      const originalQuantity = (product.quantity || 0) + soldQuantity;

      return {
        ...product,
        sold_quantity: soldQuantity,
        original_quantity: originalQuantity
      };
    }));

    // Calculate total original quantity for the batch
    const totalOriginalQuantity = productsWithSales.reduce((sum, p) => sum + (p.original_quantity || 0), 0);

    // Calculate total value of unsold products
    const totalProductsValue = productsWithSales.reduce((sum, p) => sum + (p.total_value || 0), 0);

    // Only include batches that have products
    if (productsWithSales.length > 0) {
      const avgExpensePerUnit = totalOriginalQuantity > 0 ? totalExpenses / totalOriginalQuantity : 0;
      
      batchSummaries.push({
        batch_name: batch.name || 'Unknown',
        batch_id: batchId,
        total_expenses: Number(totalExpenses) || 0,
        total_products_value: Number(totalProductsValue) || 0,
        total_original_quantity_in_batch: Number(totalOriginalQuantity) || 0,
        avg_expense_per_unit: Number(avgExpensePerUnit) || 0,
        products: productsWithSales.map(p => ({
          _id: p._id.toString(),
          name: p.name || 'Unknown',
          quantity: Number(p.quantity) || 0,
          unit_price: Number(p.unit_price) || 0,
          total_value: Number(p.total_value) || 0,
          product_batch: p.product_batch || '',
          status: p.status || 'unknown',
          sold_quantity: Number(p.sold_quantity) || 0,
          original_quantity: Number(p.original_quantity) || 0,
          min_selling_price: Number((p.unit_price || 0) + avgExpensePerUnit) || 0
        }))
      });
    }
  }

  res.json(batchSummaries);
}));

// Get dashboard summary
router.get('/dashboard', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { products, expenses, investments, sales, orders } = await getCollections(db);

  const farmIdObj = toObjectId(farm_id);

  // Recent products
  const recentProducts = await products
    .find({ farm_id: farmIdObj })
    .sort({ created_at: -1 })
    .limit(5)
    .toArray();

  // Recent expenses
  const recentExpenses = await expenses
    .find({ farm_id: farmIdObj })
    .sort({ date: -1 })
    .limit(5)
    .toArray();

  // Recent sales
  const recentSales = await sales
    .find({ farm_id: farmIdObj })
    .sort({ sale_date: -1 })
    .limit(5)
    .toArray();

  // Pending orders
  const pendingOrders = await orders
    .find({ farm_id: farmIdObj, status: 'pending' })
    .sort({ created_at: -1 })
    .toArray();

  // Totals
  const totalProducts = await products.countDocuments({ farm_id: farmIdObj });
  const totalExpenses = await expenses.aggregate([
    { $match: { farm_id: farmIdObj } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]).toArray();

  const totalInvestments = await investments.aggregate([
    { $match: { farm_id: farmIdObj } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]).toArray();

  const totalSalesRevenue = await sales.aggregate([
    { $match: { farm_id: farmIdObj } },
    { 
      $group: { 
        _id: null, 
        total: { $sum: { $multiply: ['$quantity_sold', '$price_per_unit'] } } 
      } 
    }
  ]).toArray();

  res.json({
    summary: {
      total_products: totalProducts,
      total_expenses: totalExpenses[0]?.total || 0,
      total_investments: totalInvestments[0]?.total || 0,
      total_sales: totalSalesRevenue[0]?.total || 0,
      pending_orders: pendingOrders.length,
    },
    recent: {
      products: recentProducts.map(p => ({
        _id: p._id.toString(),
        name: p.name,
        type: p.type,
        quantity: p.quantity,
        total_value: p.total_value,
        created_at: p.created_at,
      })),
      expenses: recentExpenses.map(e => ({
        _id: e._id.toString(),
        type: e.type,
        description: e.description,
        amount: e.amount,
        date: e.date,
      })),
      sales: recentSales.map(s => ({
        _id: s._id.toString(),
        product_id: s.product_id.toString(),
        quantity_sold: s.quantity_sold,
        price_per_unit: s.price_per_unit,
        sale_date: s.sale_date,
      })),
    },
    pending_orders: pendingOrders.map(o => ({
      _id: o._id.toString(),
      customer_id: o.customer_id.toString(),
      total_amount: o.total_amount,
      items_count: o.items.length,
      created_at: o.created_at,
    })),
  });
}));

module.exports = router;
