const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const router = express.Router();

// Get sales for a farm - GET /sales/farm/:farm_id
router.get('/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;
  const { start_date, end_date, product_batch } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { sales } = await getCollections(db);

  const query = { farm_id: toObjectId(farm_id) };
  
  // Add date range filter if provided
  if (start_date || end_date) {
    query.date = {};
    if (start_date) query.date.$gte = new Date(start_date);
    if (end_date) query.date.$lte = new Date(end_date);
  }

  // Add product batch filter if provided
  if (product_batch) {
    query.product_batch = product_batch;
  }

  const salesList = await sales.find(query).sort({ date: -1 }).toArray();
  res.json(serializeDocs(salesList));
}));

// Create sale - POST /sales
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { product_id, quantity_sold, price_per_unit, farm_id, sale_date } = req.body;

  if (!product_id || !quantity_sold || !price_per_unit || !farm_id) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { sales, products, expenses } = await getCollections(db);

  // Get product details to fetch product name and calculate profit
  const product = await products.findOne({ _id: toObjectId(product_id) });
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Check if enough quantity is available
  if (product.quantity < parseInt(quantity_sold)) {
    return res.status(400).json({ error: 'Not enough product in stock' });
  }

  // Calculate profit including expenses
  const quantity = parseInt(quantity_sold);
  const sellingPrice = parseFloat(price_per_unit);
  const productCost = parseFloat(product.unit_price || 0);
  
  // Get expenses for this product batch to calculate total cost
  let totalExpenses = 0;
  let totalQuantityInBatch = 0;
  
  if (product.product_batch) {
    // Get all expenses for this product batch
    const batchExpenses = await expenses.find({ 
      product_batch: product.product_batch,
      farm_id: toObjectId(farm_id)
    }).toArray();
    
    totalExpenses = batchExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
    
    // Get all products in this batch to calculate average expense per unit
    const batchProducts = await products.find({ 
      product_batch: product.product_batch,
      farm_id: toObjectId(farm_id)
    }).toArray();
    
    totalQuantityInBatch = batchProducts.reduce((sum, p) => sum + parseInt(p.quantity || 0), 0);
  }
  
  // Calculate average expense per unit
  const avgExpensePerUnit = totalQuantityInBatch > 0 ? totalExpenses / totalQuantityInBatch : 0;
  const totalCostPerUnit = productCost + avgExpensePerUnit;
  const profit = (sellingPrice - totalCostPerUnit) * quantity;

  // Calculate total amount
  const total_amount = quantity * sellingPrice;

  const saleDoc = {
    product_id: toObjectId(product_id),
    product_name: product.name,
    product_batch: product.product_batch,
    quantity_sold: quantity,
    price_per_unit: sellingPrice,
    total_amount: total_amount,
    profit: profit,
    farm_id: toObjectId(farm_id),
    sale_date: sale_date ? new Date(sale_date) : new Date(),
    status: 'completed',
    created_at: new Date(),
  };

  // Update product quantity and status
  const newQuantity = product.quantity - quantity;
  await products.updateOne(
    { _id: toObjectId(product_id) },
    { 
      $set: { 
        quantity: newQuantity,
        total_value: newQuantity * productCost,
        status: newQuantity === 0 ? 'sold' : product.status,
        updated_at: new Date()
      }
    }
  );

  const result = await sales.insertOne(saleDoc);
  const created = await sales.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(created));
}));

// Reverse a sale - POST /sales/:sale_id/reverse
router.post('/:sale_id/reverse', authenticate, asyncHandler(async (req, res) => {
  const { sale_id } = req.params;

  if (!sale_id) {
    return res.status(400).json({ error: 'sale_id is required' });
  }

  const { db } = await connectToDatabase();
  const { sales, products } = await getCollections(db);

  // Find the sale
  const sale = await sales.findOne({ _id: toObjectId(sale_id) });
  if (!sale) {
    return res.status(404).json({ error: 'Sale not found' });
  }

  // Verify farm access
  await verifyFarmAccess(sale.farm_id.toString(), req.user.userId, db);

  // Find the product to restore quantity
  if (sale.product_id) {
    const product = await products.findOne({ _id: toObjectId(sale.product_id) });
    if (product) {
      // Restore the sold quantity back to the product
      const restoredQuantity = product.quantity + (sale.quantity_sold || sale.quantity || 0);
      await products.updateOne(
        { _id: toObjectId(sale.product_id) },
        { 
          $set: { 
            quantity: restoredQuantity,
            total_value: restoredQuantity * parseFloat(product.unit_price || 0),
            status: 'unsold', // Ensure product is marked as unsold again
            updated_at: new Date()
          }
        }
      );
    }
  }

  // Delete the sale completely instead of marking as reversed
  const deleteResult = await sales.deleteOne({ _id: toObjectId(sale_id) });

  if (deleteResult.deletedCount === 0) {
    return res.status(500).json({ error: 'Failed to reverse sale' });
  }

  res.json({ 
    message: 'Sale reversed successfully', 
    sale_id: sale_id,
    deleted: true 
  });
}));

// Get sale by ID - GET /sales/:sale_id
router.get('/:sale_id', authenticate, asyncHandler(async (req, res) => {
  const { sale_id } = req.params;

  if (!sale_id) {
    return res.status(400).json({ error: 'sale_id is required' });
  }

  const { db } = await connectToDatabase();
  const { sales } = await getCollections(db);

  const sale = await sales.findOne({ _id: toObjectId(sale_id) });
  if (!sale) {
    return res.status(404).json({ error: 'Sale not found' });
  }

  // Verify farm access
  await verifyFarmAccess(sale.farm_id.toString(), req.user.userId, db);

  res.json(serializeDoc(sale));
}));

module.exports = router;