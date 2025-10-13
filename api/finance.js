const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const router = express.Router();

// ===== EXPENSES ROUTES =====

// Create expense - POST /finance/expenses
router.post('/expenses', authenticate, asyncHandler(async (req, res) => {
  const { type, description, amount, farm_id, product_batch } = req.body;

  if (!type || !description || !amount || !farm_id || !product_batch) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { expenses } = await getCollections(db);

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

// Get expenses - GET /finance/expenses?farm_id=xxx&product_batch=xxx
router.get('/expenses', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, product_batch } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { expenses } = await getCollections(db);

  const query = { farm_id: toObjectId(farm_id) };
  if (product_batch) {
    query.product_batch = product_batch;
  }

  const expensesList = await expenses.find(query).toArray();
  res.json(serializeDocs(expensesList));
}));

// ===== EXPENSE TYPES ROUTES =====

// Create expense type - POST /finance/expense-types
router.post('/expense-types', authenticate, asyncHandler(async (req, res) => {
  const { name, farm_id } = req.body;

  if (!name || !farm_id) {
    return res.status(400).json({ error: 'Name and farm_id are required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { expense_types } = await getCollections(db);

  const typeDoc = {
    name,
    farm_id: toObjectId(farm_id),
    is_default: false,
    created_at: new Date(),
  };
  
  const result = await expense_types.insertOne(typeDoc);
  const created = await expense_types.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(created));
}));

// Get expense types by farm - GET /finance/expense-types/farm/:farm_id
router.get('/expense-types/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { expense_types } = await getCollections(db);

  const query = {
    $or: [
      { is_default: true },
      { farm_id: toObjectId(farm_id) }
    ]
  };

  const types = await expense_types.find(query).toArray();
  res.json(serializeDocs(types));
}));

// Get expense types (query parameter version) - GET /finance/expense-types?farm_id=xxx
router.get('/expense-types', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.query;

  const { db } = await connectToDatabase();
  const { expense_types } = await getCollections(db);

  const query = {
    $or: [
      { is_default: true },
      { farm_id: farm_id ? toObjectId(farm_id) : null }
    ]
  };

  const types = await expense_types.find(query).toArray();
  res.json(serializeDocs(types));
}));

// Update expense type - PUT /finance/expense-types/:id
router.put('/expense-types/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const { db } = await connectToDatabase();
  const { expense_types } = await getCollections(db);

  const expenseType = await expense_types.findOne({ _id: toObjectId(id) });
  
  if (!expenseType) {
    return res.status(404).json({ error: 'Expense type not found' });
  }

  // Don't allow updating default types
  if (expenseType.is_default) {
    return res.status(400).json({ error: 'Cannot update default expense types' });
  }

  // Verify farm access
  await verifyFarmAccess(expenseType.farm_id.toString(), req.user.userId, db);

  await expense_types.updateOne(
    { _id: toObjectId(id) },
    { $set: { name, updated_at: new Date() } }
  );

  const updated = await expense_types.findOne({ _id: toObjectId(id) });
  res.json(serializeDoc(updated));
}));

// Delete expense type - DELETE /finance/expense-types/:id
router.delete('/expense-types/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { db } = await connectToDatabase();
  const { expense_types } = await getCollections(db);

  const expenseType = await expense_types.findOne({ _id: toObjectId(id) });
  
  if (!expenseType) {
    return res.status(404).json({ error: 'Expense type not found' });
  }

  // Don't allow deleting default types
  if (expenseType.is_default) {
    return res.status(400).json({ error: 'Cannot delete default expense types' });
  }

  // Verify farm access
  await verifyFarmAccess(expenseType.farm_id.toString(), req.user.userId, db);

  await expense_types.deleteOne({ _id: toObjectId(id) });
  res.json({ message: 'Expense type deleted successfully' });
}));

// Initialize default expense types - POST /finance/expense-types/init-defaults
router.post('/expense-types/init-defaults', authenticate, asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { expense_types } = await getCollections(db);

  // Define default expense types
  const defaultTypes = ['Food', 'Medicine', 'Vaccine', 'Others'];

  // Check if default types already exist
  const existingDefaults = await expense_types.find({ is_default: true }).toArray();
  const existingNames = existingDefaults.map(type => type.name);

  const results = [];

  // Insert only new default types
  for (const typeName of defaultTypes) {
    if (!existingNames.includes(typeName)) {
      const typeDoc = {
        name: typeName,
        is_default: true,
        created_at: new Date(),
      };
      
      await expense_types.insertOne(typeDoc);
      results.push({ name: typeName, status: 'created' });
    } else {
      results.push({ name: typeName, status: 'already_exists' });
    }
  }

  // Get all default types after initialization
  const allDefaults = await expense_types.find({ is_default: true }).toArray();

  res.json({
    message: 'Default expense types initialization completed',
    results,
    all_defaults: serializeDocs(allDefaults)
  });
}));

// ===== INVESTMENTS ROUTES =====

// Create investment - POST /finance/investments
router.post('/investments', authenticate, asyncHandler(async (req, res) => {
  const { type, description, amount, farm_id, date } = req.body;

  if (!type || !description || !amount || !farm_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { investments } = await getCollections(db);

  const investmentDoc = {
    type,
    description,
    amount: parseFloat(amount),
    farm_id: toObjectId(farm_id),
    date: date ? new Date(date) : new Date(),
    created_at: new Date(),
  };

  const result = await investments.insertOne(investmentDoc);
  const created = await investments.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(created));
}));

// Get investments - GET /finance/investments?farm_id=xxx
router.get('/investments', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { investments } = await getCollections(db);

  const query = { farm_id: toObjectId(farm_id) };
  const investmentsList = await investments.find(query).sort({ date: -1 }).toArray();
  
  res.json(serializeDocs(investmentsList));
}));

module.exports = router;