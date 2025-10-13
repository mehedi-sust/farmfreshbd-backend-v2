/**
 * Management API - Consolidated endpoint for admin, finance, stats, and reports
 * This consolidation reduces serverless function count for Vercel Hobby plan
 */

const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { verifyToken } = require('../src/config/auth');
const { asyncHandler, serializeDoc } = require('../src/utils/helpers');

const router = express.Router();

// Basic admin endpoint
router.get('/admin/health', (req, res) => {
  res.json({ status: 'ok', message: 'Admin API is running' });
});

// Basic finance endpoint
router.get('/finance/health', (req, res) => {
  res.json({ status: 'ok', message: 'Finance API is running' });
});

// Basic stats endpoint
router.get('/stats/health', (req, res) => {
  res.json({ status: 'ok', message: 'Stats API is running' });
});

// Helper function to calculate farm stats
async function calculateFarmStats(farmIdObj, db) {
  const { products, expenses, sales, farms } = await getCollections(db);
  
  // Get all products for this farm
  const farmProducts = await products.find({ farm_id: farmIdObj }).toArray();
  
  // Get all expenses for this farm
  const farmExpenses = await expenses.find({ farm_id: farmIdObj }).toArray();
  
  // Get all sales for this farm
  const farmSales = await sales.find({ farm_id: farmIdObj }).toArray();
  
  // Calculate totals
  const total_products = farmProducts.reduce((sum, product) => sum + (product.price * product.quantity || 0), 0);
  const total_expenses = farmExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const total_sales = farmSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
  const product_count = farmProducts.reduce((sum, product) => sum + (product.quantity || 0), 0);
  const sold_product_count = farmSales.reduce((sum, sale) => sum + (sale.quantity || 0), 0);
  const total_profit = total_sales - total_expenses;
  const total_investments = farmExpenses.filter(e => e.category === 'investment').reduce((sum, e) => sum + e.amount, 0);
  
  return {
    total_products,
    total_expenses,
    product_count,
    total_profit,
    total_investments,
    total_sales,
    sold_product_count
  };
}

// GET /stats/farm/:farm_id - Get farm statistics
router.get('/stats/farm/:farm_id', asyncHandler(async (req, res) => {
  const { farm_id } = req.params;
  const { db } = await connectToDatabase();
  const { ObjectId } = require('mongodb');
  
  if (!ObjectId.isValid(farm_id)) {
    return res.status(400).json({ error: 'Invalid farm ID' });
  }
  
  const farmIdObj = new ObjectId(farm_id);
  const stats = await calculateFarmStats(farmIdObj, db);
  
  res.json(stats);
}));

// POST /stats/farm/:farm_id/update_stats_data - Update and recalculate stats
router.post('/stats/farm/:farm_id/update_stats_data', asyncHandler(async (req, res) => {
  const { farm_id } = req.params;
  const { db } = await connectToDatabase();
  const { ObjectId } = require('mongodb');
  
  if (!ObjectId.isValid(farm_id)) {
    return res.status(400).json({ error: 'Invalid farm ID' });
  }
  
  const farmIdObj = new ObjectId(farm_id);
  const current_stats = await calculateFarmStats(farmIdObj, db);
  
  res.json({
    message: 'Stats updated successfully',
    current_stats
  });
}));

// GET /stats/farm/:farm_id/monthly_financial - Get 12 months financial data
router.get('/stats/farm/:farm_id/monthly_financial', asyncHandler(async (req, res) => {
  const { farm_id } = req.params;
  const { db } = await connectToDatabase();
  const { ObjectId } = require('mongodb');
  
  if (!ObjectId.isValid(farm_id)) {
    return res.status(400).json({ error: 'Invalid farm ID' });
  }
  
  const farmIdObj = new ObjectId(farm_id);
  const { expenses, sales } = await getCollections(db);
  
  // Get last 12 months data
  const months = [];
  const now = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    
    // Get expenses for this month
    const monthExpenses = await expenses.find({
      farm_id: farmIdObj,
      created_at: { $gte: date, $lt: nextDate }
    }).toArray();
    
    // Get sales for this month
    const monthSales = await sales.find({
      farm_id: farmIdObj,
      created_at: { $gte: date, $lt: nextDate }
    }).toArray();
    
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalSales = monthSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const investments = monthExpenses.filter(e => e.category === 'investment').reduce((sum, e) => sum + e.amount, 0);
    
    months.push({
      month: date.toISOString().substring(0, 7), // YYYY-MM format
      investments,
      expenses: totalExpenses,
      product_value: 0, // This would need product data by month
      profit: totalSales - totalExpenses,
      sales: totalSales
    });
  }
  
  res.json(months);
}));

// GET /stats/farm/:farm_id/current_year_profit - Get current year profit trends
router.get('/stats/farm/:farm_id/current_year_profit', asyncHandler(async (req, res) => {
  const { farm_id } = req.params;
  const { db } = await connectToDatabase();
  const { ObjectId } = require('mongodb');
  
  if (!ObjectId.isValid(farm_id)) {
    return res.status(400).json({ error: 'Invalid farm ID' });
  }
  
  const farmIdObj = new ObjectId(farm_id);
  const { expenses, sales } = await getCollections(db);
  
  // Get current year data by month
  const currentYear = new Date().getFullYear();
  const months = [];
  
  for (let month = 0; month < 12; month++) {
    const date = new Date(currentYear, month, 1);
    const nextDate = new Date(currentYear, month + 1, 1);
    
    // Get expenses for this month
    const monthExpenses = await expenses.find({
      farm_id: farmIdObj,
      created_at: { $gte: date, $lt: nextDate }
    }).toArray();
    
    // Get sales for this month
    const monthSales = await sales.find({
      farm_id: farmIdObj,
      created_at: { $gte: date, $lt: nextDate }
    }).toArray();
    
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalSales = monthSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    
    months.push({
      month: date.toISOString().substring(0, 7), // YYYY-MM format
      profit: totalSales - totalExpenses,
      expenses: totalExpenses,
      revenue: totalSales
    });
  }
  
  res.json(months);
}));

// GET /farms/:farm_id - Get farm details
router.get('/farms/:farm_id', asyncHandler(async (req, res) => {
  const { farm_id } = req.params;
  const { db } = await connectToDatabase();
  const { ObjectId } = require('mongodb');
  
  if (!ObjectId.isValid(farm_id)) {
    return res.status(400).json({ error: 'Invalid farm ID' });
  }
  
  const farmIdObj = new ObjectId(farm_id);
  const { farms } = await getCollections(db);
  
  const farm = await farms.findOne({ _id: farmIdObj });
  
  if (!farm) {
    return res.status(404).json({ error: 'Farm not found' });
  }
  
  res.json(serializeDoc(farm));
}));

// Basic reports endpoint
router.get('/reports/health', (req, res) => {
  res.json({ status: 'ok', message: 'Reports API is running' });
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Management API is running',
    endpoints: ['admin', 'finance', 'stats', 'reports']
  });
});

// Export the router
module.exports = router;