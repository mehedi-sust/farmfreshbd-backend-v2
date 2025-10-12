/**
 * @api {post} /api/management/batches Create Product Batch
 * @apiName CreateBatch
 * @apiGroup Management
 * @apiVersion 1.0.0
 * @apiPermission authenticated
 * 
 * @apiHeader {String} Authorization Bearer token
 * 
 * @apiBody {String} name Batch name
 * @apiBody {String} farm_id Farm ID
 * 
 * @apiSuccess {Object} batch Created batch
 */

const express = require('express');
const cors = require('cors');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const router = express.Router();
router.use(cors());
router.use(express.json());

// ===== PRODUCT BATCHES =====

// Create batch - /batches route (for /api/management/batches)
router.post('/batches', authenticate, asyncHandler(async (req, res) => {
  const { name, farm_id } = req.body;

  if (!name || !farm_id) {
    return res.status(400).json({ error: 'Name and farm_id are required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { productBatches } = getCollections(db);

  const batchDoc = {
    name,
    farm_id: toObjectId(farm_id),
    created_at: new Date(),
  };

  const result = await productBatches.insertOne(batchDoc);
  const created = await productBatches.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(created));
}));



// Get batches by farm (path parameter - what frontend uses)
router.get('/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { productBatches } = getCollections(db);

  const batches = await productBatches.find({ farm_id: toObjectId(farm_id) }).toArray();
  res.json(serializeDocs(batches));
}));

// Get batches (query parameter version)
router.get('/batches', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { productBatches } = getCollections(db);

  const batches = await productBatches.find({ farm_id: toObjectId(farm_id) }).toArray();
  res.json(serializeDocs(batches));
}));

// ===== EXPENSES =====

// Create expense - ROOT route (POST /expenses)
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { type, description, amount, farm_id, product_batch } = req.body;

  if (!type || !description || !amount || !farm_id || !product_batch) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { expenses } = getCollections(db);

  const expenseDoc = {
    type,
    description,
    amount: parseFloat(amount),
    farm_id: toObjectId(farm_id),
    product_batch,
    date: new Date(),
  };

  const result = await expenses.insertOne(expenseDoc);
  const created = await expenses.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(created));
}));

// Create expense - /expenses route (alternative)
router.post('/expenses', authenticate, asyncHandler(async (req, res) => {
  const { type, description, amount, farm_id, product_batch } = req.body;

  if (!type || !description || !amount || !farm_id || !product_batch) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { expenses } = getCollections(db);

  const expenseDoc = {
    type,
    description,
    amount: parseFloat(amount),
    farm_id: toObjectId(farm_id),
    product_batch,
    date: new Date(),
  };

  const result = await expenses.insertOne(expenseDoc);
  const created = await expenses.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(created));
}));

// Get expenses - ROOT route (GET /expenses?farm_id=xxx)
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, product_batch } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { expenses } = getCollections(db);

  const query = { farm_id: toObjectId(farm_id) };
  if (product_batch) {
    query.product_batch = product_batch;
  }

  const expensesList = await expenses.find(query).toArray();
  res.json(serializeDocs(expensesList));
}));

// Get expenses - /expenses route (alternative)
router.get('/expenses', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, product_batch } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { expenses } = getCollections(db);

  const query = { farm_id: toObjectId(farm_id) };
  if (product_batch) {
    query.product_batch = product_batch;
  }

  const expensesList = await expenses.find(query).toArray();
  res.json(serializeDocs(expensesList));
}));

// ===== INVESTMENTS =====

// Create investment
router.post('/investments', authenticate, asyncHandler(async (req, res) => {
  const { type, description, amount, farm_id } = req.body;

  if (!type || !description || !amount || !farm_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const validTypes = ['infrastructure', 'tools', 'others'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid investment type' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { investments } = getCollections(db);

  const investmentDoc = {
    type,
    description,
    amount: parseFloat(amount),
    farm_id: toObjectId(farm_id),
    date: new Date(),
  };

  const result = await investments.insertOne(investmentDoc);
  const created = await investments.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(created));
}));

// Get investments
router.get('/investments', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { investments } = getCollections(db);

  const investmentsList = await investments.find({ farm_id: toObjectId(farm_id) }).toArray();
  res.json(serializeDocs(investmentsList));
}));

// ===== SALES =====

// Create sale
router.post('/sales', authenticate, asyncHandler(async (req, res) => {
  const { product_id, quantity_sold, price_per_unit, farm_id } = req.body;

  if (!product_id || !quantity_sold || !price_per_unit || !farm_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { sales, products } = getCollections(db);

  // Verify product exists
  const product = await products.findOne({ _id: toObjectId(product_id) });
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const saleDoc = {
    product_id: toObjectId(product_id),
    quantity_sold: parseInt(quantity_sold),
    price_per_unit: parseFloat(price_per_unit),
    farm_id: toObjectId(farm_id),
    profit: null,
    sale_date: new Date(),
  };

  const result = await sales.insertOne(saleDoc);
  const created = await sales.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(created));
}));

// Get sales
router.get('/sales', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, product_id } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { sales } = getCollections(db);

  const query = { farm_id: toObjectId(farm_id) };
  if (product_id) {
    query.product_id = toObjectId(product_id);
  }

  const salesList = await sales.find(query).toArray();
  res.json(serializeDocs(salesList));
}));

// ===== EXPENSE TYPES =====

// Create expense type - ROOT route (POST /expense_types)
router.post('/expense-types', authenticate, asyncHandler(async (req, res) => {
  const { name, farm_id } = req.body;

  if (!name || !farm_id) {
    return res.status(400).json({ error: 'Name and farm_id are required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { expenseTypes } = getCollections(db);

  const typeDoc = {
    name,
    farm_id: toObjectId(farm_id),
    is_default: false,
    created_at: new Date(),
  };

  const result = await expenseTypes.insertOne(typeDoc);
  const created = await expenseTypes.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(created));
}));

// Get expense types by farm (path parameter - what frontend uses)
router.get('/expense-types/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { expenseTypes } = getCollections(db);

  const query = {
    $or: [
      { is_default: true },
      { farm_id: toObjectId(farm_id) }
    ]
  };

  const types = await expenseTypes.find(query).toArray();
  res.json(serializeDocs(types));
}));

// Get expense types (query parameter version)
router.get('/expense-types', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.query;

  const { db } = await connectToDatabase();
  const { expenseTypes } = getCollections(db);

  const query = {
    $or: [
      { is_default: true },
      { farm_id: farm_id ? toObjectId(farm_id) : null }
    ]
  };

  const types = await expenseTypes.find(query).toArray();
  res.json(serializeDocs(types));
}));

// Update expense type - ROOT route (PUT /expense_types/:id)
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const { db } = await connectToDatabase();
  const { expenseTypes } = getCollections(db);

  const expenseType = await expenseTypes.findOne({ _id: toObjectId(id) });
  
  if (!expenseType) {
    return res.status(404).json({ error: 'Expense type not found' });
  }

  // Don't allow updating default types
  if (expenseType.is_default) {
    return res.status(400).json({ error: 'Cannot update default expense types' });
  }

  // Verify farm access
  await verifyFarmAccess(expenseType.farm_id.toString(), req.user.userId, db);

  await expenseTypes.updateOne(
    { _id: toObjectId(id) },
    { $set: { name, updated_at: new Date() } }
  );

  const updated = await expenseTypes.findOne({ _id: toObjectId(id) });
  res.json(serializeDoc(updated));
}));

// Update expense type - /expense-types/:id route (alternative)
router.put('/expense-types/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const { db } = await connectToDatabase();
  const { expenseTypes } = getCollections(db);

  const expenseType = await expenseTypes.findOne({ _id: toObjectId(id) });
  
  if (!expenseType) {
    return res.status(404).json({ error: 'Expense type not found' });
  }

  // Don't allow updating default types
  if (expenseType.is_default) {
    return res.status(400).json({ error: 'Cannot update default expense types' });
  }

  // Verify farm access
  await verifyFarmAccess(expenseType.farm_id.toString(), req.user.userId, db);

  await expenseTypes.updateOne(
    { _id: toObjectId(id) },
    { $set: { name, updated_at: new Date() } }
  );

  const updated = await expenseTypes.findOne({ _id: toObjectId(id) });
  res.json(serializeDoc(updated));
}));

// Delete expense type - ROOT route (DELETE /expense_types/:id)
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { db } = await connectToDatabase();
  const { expenseTypes } = getCollections(db);

  const expenseType = await expenseTypes.findOne({ _id: toObjectId(id) });
  
  if (!expenseType) {
    return res.status(404).json({ error: 'Expense type not found' });
  }

  // Don't allow deleting default types
  if (expenseType.is_default) {
    return res.status(400).json({ error: 'Cannot delete default expense types' });
  }

  // Verify farm access
  await verifyFarmAccess(expenseType.farm_id.toString(), req.user.userId, db);

  await expenseTypes.deleteOne({ _id: toObjectId(id) });
  res.json({ message: 'Expense type deleted successfully' });
}));

// Delete expense type - /expense-types/:id route (alternative)
router.delete('/expense-types/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { db } = await connectToDatabase();
  const { expenseTypes } = getCollections(db);

  const expenseType = await expenseTypes.findOne({ _id: toObjectId(id) });
  
  if (!expenseType) {
    return res.status(404).json({ error: 'Expense type not found' });
  }

  // Don't allow deleting default types
  if (expenseType.is_default) {
    return res.status(400).json({ error: 'Cannot delete default expense types' });
  }

  // Verify farm access
  await verifyFarmAccess(expenseType.farm_id.toString(), req.user.userId, db);

  await expenseTypes.deleteOne({ _id: toObjectId(id) });
  res.json({ message: 'Expense type deleted successfully' });
}));

module.exports = router;
