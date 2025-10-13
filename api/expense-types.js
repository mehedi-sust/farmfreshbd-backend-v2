const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const router = express.Router();

// Create expense type - POST /expense_types
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { name, farm_id } = req.body;

  if (!name || !farm_id) {
    return res.status(400).json({ error: 'Name and farm_id are required' });
  }

  const { db } = await connectToDatabase();
  console.log('🔍 db object:', db ? 'defined' : 'undefined');
  console.log('🔍 db type:', typeof db);
  
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

// Get expense types by farm - GET /expense_types/farm/:farm_id
router.get('/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
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

// Get expense types (query parameter version) - GET /expense_types?farm_id=xxx
router.get('/', authenticate, asyncHandler(async (req, res) => {
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

// Update expense type - PUT /expense_types/:id
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
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

// Delete expense type - DELETE /expense_types/:id
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
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

// Initialize default expense types - POST /expense_types/init-defaults
router.post('/init-defaults', authenticate, asyncHandler(async (req, res) => {
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

module.exports = router;
