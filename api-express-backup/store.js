/**
 * @api {get} /api/store Get Store Products
 * @apiName GetStoreProducts
 * @apiGroup Store
 * @apiVersion 1.0.0
 * 
 * @apiQuery {String} [category] Filter by category
 * @apiQuery {String} [farm_id] Filter by farm
 * @apiQuery {Number} [skip=0] Pagination skip
 * @apiQuery {Number} [limit=100] Pagination limit
 * 
 * @apiSuccess {Object[]} products Array of store products with details
 */

const express = require('express');
const cors = require('cors');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const app = express();
app.use(cors());
app.use(express.json());

// Get all store products (public)
app.get('/', asyncHandler(async (req, res) => {
  const { category, farm_id, skip = 0, limit = 100 } = req.query;

  const { db } = await connectToDatabase();
  const { storeProducts } = getCollections(db);

  const pipeline = [
    { $match: { is_published: true } },
  ];

  if (category) {
    pipeline[0].$match.category = category;
  }

  if (farm_id) {
    pipeline[0].$match.farm_id = toObjectId(farm_id);
  }

  pipeline.push(
    {
      $lookup: {
        from: 'products',
        localField: 'product_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'farms',
        localField: 'farm_id',
        foreignField: '_id',
        as: 'farm'
      }
    },
    { $unwind: { path: '$farm', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        product_id: { $toString: '$product_id' },
        farm_id: { $toString: '$farm_id' },
        price: '$selling_price',
        is_available: { $gt: ['$available_stock', 0] },
        created_at: 1,
        updated_at: 1,
        product_name: '$name',
        product_type: '$product.type',
        product_quantity: '$available_stock',
        farm_name: '$farm.name',
        farm_location: '$farm.location',
        description: 1,
        product_image_url: 1,
        category: 1,
        unit: 1
      }
    },
    { $skip: parseInt(skip) },
    { $limit: parseInt(limit) }
  );

  const products = await storeProducts.aggregate(pipeline).toArray();
  
  // Serialize _id fields
  const serialized = products.map(p => ({
    ...p,
    _id: p._id.toString()
  }));

  res.json(serialized);
}));

// Get store products for a farm
app.get('/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { storeProducts } = getCollections(db);

  const products = await storeProducts.find({ farm_id: toObjectId(farm_id) }).toArray();
  res.json(serializeDocs(products));
}));

// Get available products for a farm (products not yet in store)
app.get('/farm/:farm_id/available_products', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { products, storeProducts, productBatches } = getCollections(db);

  // Get all products for this farm
  const farmProducts = await products.find({ 
    farm_id: toObjectId(farm_id),
    status: 'unsold',
    quantity: { $gt: 0 }
  }).toArray();

  // Get product IDs already in store
  const storeProductIds = await storeProducts.find({ 
    farm_id: toObjectId(farm_id) 
  }).toArray();
  
  const storeProductIdSet = new Set(storeProductIds.map(sp => sp.product_id.toString()));

  // Filter out products already in store
  const availableProducts = farmProducts.filter(p => !storeProductIdSet.has(p._id.toString()));

  // Populate batch names
  for (let product of availableProducts) {
    if (product.product_batch) {
      try {
        const batch = await productBatches.findOne({ _id: toObjectId(product.product_batch) });
        if (batch) {
          product.product_batch_name = batch.name;
        }
      } catch (err) {
        // Batch ID might be invalid
      }
    }
  }

  res.json(serializeDocs(availableProducts));
}));

// Get store product by ID
app.get('/:productId', asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const { db } = await connectToDatabase();
  const { storeProducts } = getCollections(db);

  const pipeline = [
    { $match: { _id: toObjectId(productId) } },
    {
      $lookup: {
        from: 'products',
        localField: 'product_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'farms',
        localField: 'farm_id',
        foreignField: '_id',
        as: 'farm'
      }
    },
    { $unwind: { path: '$farm', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        product_id: { $toString: '$product_id' },
        farm_id: { $toString: '$farm_id' },
        price: '$selling_price',
        is_available: { $gt: ['$available_stock', 0] },
        created_at: 1,
        updated_at: 1,
        product_name: '$name',
        product_type: '$product.type',
        product_quantity: '$available_stock',
        farm_name: '$farm.name',
        farm_location: '$farm.location',
        description: 1,
        product_image_url: 1,
        category: 1,
        unit: 1
      }
    }
  ];

  const products = await storeProducts.aggregate(pipeline).toArray();
  
  if (products.length === 0) {
    return res.status(404).json({ error: 'Store product not found' });
  }

  const product = products[0];
  product._id = product._id.toString();

  res.json(product);
}));

// Create store product
app.post('/', authenticate, asyncHandler(async (req, res) => {
  const { product_id, farm_id, name, description, selling_price, available_stock, category, unit, product_image_url } = req.body;

  if (!product_id || !farm_id || !name || !selling_price || !available_stock) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { storeProducts } = getCollections(db);

  const storeProductDoc = {
    product_id: toObjectId(product_id),
    farm_id: toObjectId(farm_id),
    name,
    description: description || '',
    selling_price: parseFloat(selling_price),
    available_stock: parseInt(available_stock),
    product_image_url: product_image_url || null,
    is_published: true,
    category: category || 'produce',
    unit: unit || 'piece',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const result = await storeProducts.insertOne(storeProductDoc);
  const created = await storeProducts.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(created));
}));

// Update store product
app.put('/:productId', authenticate, asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const updates = req.body;

  const { db } = await connectToDatabase();
  const { storeProducts } = getCollections(db);

  const product = await storeProducts.findOne({ _id: toObjectId(productId) });
  if (!product) {
    return res.status(404).json({ error: 'Store product not found' });
  }

  await verifyFarmAccess(product.farm_id.toString(), req.user.userId, db);

  delete updates._id;
  delete updates.product_id;
  delete updates.farm_id;
  delete updates.created_at;
  updates.updated_at = new Date();

  await storeProducts.updateOne(
    { _id: toObjectId(productId) },
    { $set: updates }
  );

  const updated = await storeProducts.findOne({ _id: toObjectId(productId) });
  res.json(serializeDoc(updated));
}));

// Toggle publish status
app.post('/:productId/toggle_publish', authenticate, asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const { db } = await connectToDatabase();
  const { storeProducts } = getCollections(db);

  const product = await storeProducts.findOne({ _id: toObjectId(productId) });
  if (!product) {
    return res.status(404).json({ error: 'Store product not found' });
  }

  await verifyFarmAccess(product.farm_id.toString(), req.user.userId, db);

  const newPublishStatus = !product.is_published;
  
  await storeProducts.updateOne(
    { _id: toObjectId(productId) },
    { $set: { is_published: newPublishStatus, updated_at: new Date() } }
  );

  const updated = await storeProducts.findOne({ _id: toObjectId(productId) });
  res.json(serializeDoc(updated));
}));

// Delete store product
app.delete('/:productId', authenticate, asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const { db } = await connectToDatabase();
  const { storeProducts } = getCollections(db);

  const product = await storeProducts.findOne({ _id: toObjectId(productId) });
  if (!product) {
    return res.status(404).json({ error: 'Store product not found' });
  }

  await verifyFarmAccess(product.farm_id.toString(), req.user.userId, db);

  await storeProducts.deleteOne({ _id: toObjectId(productId) });
  res.json({ message: 'Store product deleted successfully' });
}));

module.exports = app;
