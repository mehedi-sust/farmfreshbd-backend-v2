/**
 * Core API - Consolidated endpoint for auth, products, store_products, and farms
 * This consolidation reduces serverless function count for Vercel Hobby plan
 */

const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { generateToken, hashPassword, comparePassword, authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const router = express.Router();

// Store Products Routes (embedded to avoid creating separate file)
// Get store product by ID - GET /store_products/:productId
router.get('/store_products/:productId', asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const { db } = await connectToDatabase();
  const { store_products } = await getCollections(db);

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
        store_price: '$selling_price',
        store_stock_quantity: '$available_stock',
        is_featured: '$is_published',
        created_at: 1,
        updated_at: 1,
        product_name: '$name',
        product_type: '$product.type',
        product_quantity: '$available_stock',
        farm_name: '$farm.name',
        farm_location: '$farm.location',
        farm_address: '$farm.address',
        description: 1,
        product_image_url: 1,
        category: 1,
        unit: 1,
        price: '$selling_price',
        is_available: { $gt: ['$available_stock', 0] }
      }
    }
  ];

  const products = await store_products.aggregate(pipeline).toArray();
  
  if (products.length === 0) {
    return res.status(404).json({ error: 'Store product not found' });
  }

  const product = products[0];
  product._id = product._id.toString();

  res.json(product);
}));

// Get all store products (public) - GET /store_products
router.get('/store_products', asyncHandler(async (req, res) => {
  const { category, farm_id, skip = 0, limit = 100 } = req.query;

  const { db } = await connectToDatabase();
  const { store_products } = await getCollections(db);

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
        store_price: '$selling_price',
        store_stock_quantity: '$available_stock',
        is_featured: '$is_published',
        created_at: 1,
        updated_at: 1,
        product_name: '$name',
        product_type: '$product.type',
        product_quantity: '$available_stock',
        farm_name: '$farm.name',
        farm_location: '$farm.location',
        farm_address: '$farm.address',
        description: 1,
        product_image_url: 1,
        category: 1,
        unit: 1,
        price: '$selling_price',
        is_available: { $gt: ['$available_stock', 0] }
      }
    },
    { $skip: parseInt(skip) },
    { $limit: parseInt(limit) }
  );

  const products = await store_products.aggregate(pipeline).toArray();
  
  // Serialize _id fields
  const serialized = products.map(p => ({
    ...p,
    _id: p._id.toString()
  }));

  res.json(serialized);
}));

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Core API is running',
    endpoints: ['store_products']
  });
});

// Export the router
module.exports = router;