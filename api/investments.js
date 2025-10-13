const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const router = express.Router();

// Create investment - POST /investments
router.post('/', authenticate, asyncHandler(async (req, res) => {
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

// Get investments - GET /investments?farm_id=xxx
router.get('/', authenticate, asyncHandler(async (req, res) => {
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