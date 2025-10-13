/**
 * Commerce API - Consolidated endpoint for cart, orders, and sales
 * This consolidation reduces serverless function count for Vercel Hobby plan
 */

const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const router = express.Router();

// Basic cart endpoints
router.get('/cart/health', (req, res) => {
  res.json({ status: 'ok', message: 'Cart API is running' });
});

// Basic orders endpoints
router.get('/orders/health', (req, res) => {
  res.json({ status: 'ok', message: 'Orders API is running' });
});

// Sales routes (embedded to avoid creating separate file)
// Create sale - POST /sales
router.post('/sales', authenticate, asyncHandler(async (req, res) => {
  const { product_id, quantity_sold, price_per_unit, farm_id, sale_date } = req.body;

  if (!product_id || !quantity_sold || !price_per_unit || !farm_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { sales, products, expenses, productBatches } = getCollections(db);

  // Verify product exists and get its details
  const product = await products.findOne({ _id: toObjectId(product_id) });
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Check if enough quantity is available
  if (product.quantity < parseInt(quantity_sold)) {
    return res.status(400).json({ 
      error: `Insufficient quantity. Available: ${product.quantity}, Requested: ${quantity_sold}` 
    });
  }

  // Get batch name
  let batchName = product.product_batch;
  if (product.product_batch) {
    const batch = await productBatches.findOne({ _id: toObjectId(product.product_batch) });
    if (batch) {
      batchName = batch.name;
    }
  }

  // Calculate total expenses for this batch
  let totalBatchExpenses = 0;
  if (product.product_batch) {
    const batchExpenses = await expenses.find({ 
      product_batch: product.product_batch.toString(),
      farm_id: toObjectId(farm_id)
    }).toArray();
    
    totalBatchExpenses = batchExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  }

  // Calculate average expense per unit for this batch
  const avgExpensePerUnit = product.quantity > 0 ? totalBatchExpenses / product.quantity : 0;

  // Calculate profit per unit: selling price - (unit cost + avg expense per unit)
  const costPerUnit = product.unit_price + avgExpensePerUnit;
  const profitPerUnit = parseFloat(price_per_unit) - costPerUnit;
  const totalProfit = profitPerUnit * parseInt(quantity_sold);

  const saleDoc = {
    product_id: toObjectId(product_id),
    product_name: product.name,
    product_batch: batchName,
    product_batch_id: product.product_batch,
    quantity_sold: parseInt(quantity_sold),
    price_per_unit: parseFloat(price_per_unit),
    unit_cost: product.unit_price,
    avg_expense_per_unit: avgExpensePerUnit,
    total_cost_per_unit: costPerUnit,
    profit_per_unit: profitPerUnit,
    profit: totalProfit,
    farm_id: toObjectId(farm_id),
    sale_date: sale_date ? new Date(sale_date) : new Date(),
    created_at: new Date(),
  };

  // Update product quantity and status
  const newQuantity = product.quantity - parseInt(quantity_sold);
  const updateData = {
    quantity: newQuantity,
    updated_at: new Date()
  };

  // If quantity becomes 0, mark as sold
  if (newQuantity === 0) {
    updateData.status = 'sold';
  }

  await products.updateOne(
    { _id: toObjectId(product_id) },
    { $set: updateData }
  );

  const result = await sales.insertOne(saleDoc);
  const created = await sales.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(created));
}));

// Get sales by farm - GET /sales/farm/:farm_id
router.get('/sales/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;
  const { start_date, end_date, product_id } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { sales, productBatches } = getCollections(db);

  const query = { farm_id: toObjectId(farm_id) };
  
  if (product_id) {
    query.product_id = toObjectId(product_id);
  }

  // Add date range filter if provided
  if (start_date || end_date) {
    query.sale_date = {};
    if (start_date) {
      query.sale_date.$gte = new Date(start_date);
    }
    if (end_date) {
      query.sale_date.$lte = new Date(end_date);
    }
  }

  const salesList = await sales.find(query).sort({ sale_date: -1 }).toArray();
  
  // Populate batch names for sales that only have batch IDs
  for (let sale of salesList) {
    if (sale.product_batch_id && (!sale.product_batch || sale.product_batch.length === 24)) {
      // If product_batch looks like an ID (24 chars), fetch the name
      try {
        const batch = await productBatches.findOne({ _id: toObjectId(sale.product_batch_id) });
        if (batch) {
          sale.product_batch = batch.name;
        }
      } catch (err) {
        // If conversion fails, it's already a name
      }
    }
  }
  
  res.json(serializeDocs(salesList));
}));

// Reverse sale - POST /sales/:id/reverse
router.post('/sales/:id/reverse', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { db } = await connectToDatabase();
  const { sales, products } = getCollections(db);

  // Find the sale
  const sale = await sales.findOne({ _id: toObjectId(id) });
  
  if (!sale) {
    return res.status(404).json({ error: 'Sale not found' });
  }

  // Verify farm access
  await verifyFarmAccess(sale.farm_id.toString(), req.user.userId, db);

  // Find the product
  const product = await products.findOne({ _id: sale.product_id });
  
  if (!product) {
    return res.status(404).json({ 
      error: 'Product not found. It may have been deleted.' 
    });
  }

  // Restore product quantity
  const restoredQuantity = product.quantity + sale.quantity_sold;
  
  const updateData = {
    quantity: restoredQuantity,
    status: 'unsold', // Always set back to unsold when reversing
    updated_at: new Date()
  };

  await products.updateOne(
    { _id: sale.product_id },
    { $set: updateData }
  );

  // Delete the sale record
  await sales.deleteOne({ _id: toObjectId(id) });

  res.json({ 
    message: 'Sale reversed successfully',
    product_id: product._id.toString(),
    restored_quantity: restoredQuantity,
    new_status: 'unsold'
  });
}));

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Commerce API is running',
    endpoints: ['cart', 'orders', 'sales']
  });
});

// Export the router
module.exports = router;