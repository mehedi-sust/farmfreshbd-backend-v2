const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const router = express.Router();

// Create investment - POST /investments
router.post('/', authenticate, asyncHandler(async (req, res) => {
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

// Get investments - GET /investments?farm_id=xxx
router.get('/', authenticate, asyncHandler(async (req, res) => {
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

// Update investment - PUT /investments/:id
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, description, amount, date } = req.body;

  const { db } = await connectToDatabase();
  const { investments } = getCollections(db);

  const investment = await investments.findOne({ _id: toObjectId(id) });
  
  if (!investment) {
    return res.status(404).json({ error: 'Investment not found' });
  }

  // Verify farm access
  await verifyFarmAccess(investment.farm_id.toString(), req.user.userId, db);

  const updateDoc = {};
  if (type) updateDoc.type = type;
  if (description) updateDoc.description = description;
  if (amount) updateDoc.amount = parseFloat(amount);
  if (date) updateDoc.date = new Date(date);
  updateDoc.updated_at = new Date();

  await investments.updateOne(
    { _id: toObjectId(id) },
    { $set: updateDoc }
  );

  const updated = await investments.findOne({ _id: toObjectId(id) });
  res.json(serializeDoc(updated));
}));

// Delete investment - DELETE /investments/:id
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { db } = await connectToDatabase();
  const { investments } = getCollections(db);

  const investment = await investments.findOne({ _id: toObjectId(id) });
  
  if (!investment) {
    return res.status(404).json({ error: 'Investment not found' });
  }

  // Verify farm access
  await verifyFarmAccess(investment.farm_id.toString(), req.user.userId, db);

  await investments.deleteOne({ _id: toObjectId(id) });
  res.json({ message: 'Investment deleted successfully' });
}));

module.exports = router;
