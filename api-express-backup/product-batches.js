const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const router = express.Router();

// Create batch - POST /product_batches
router.post('/', authenticate, asyncHandler(async (req, res) => {
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

// Get batches by farm - GET /product_batches/farm/:farm_id
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

// Get batches (query parameter version) - GET /product_batches?farm_id=xxx
router.get('/', authenticate, asyncHandler(async (req, res) => {
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

module.exports = router;
