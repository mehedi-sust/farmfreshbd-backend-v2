const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const router = express.Router();

// Create expense - POST /expenses
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

// Get expenses - GET /expenses?farm_id=xxx&product_batch=xxx
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

module.exports = router;
