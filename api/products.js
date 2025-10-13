/**
 * @api {post} /api/products Create Product
 * @apiName CreateProduct
 * @apiGroup Products
 * @apiVersion 1.0.0
 * @apiPermission authenticated
 * 
 * @apiHeader {String} Authorization Bearer token
 * 
 * @apiBody {String} name Product name
 * @apiBody {String="animal","produce"} type Product type
 * @apiBody {Number} quantity Quantity
 * @apiBody {Number} total_price Total price
 * @apiBody {String} farm_id Farm ID
 * @apiBody {String} product_batch Batch ID or name
 * 
 * @apiSuccess {Object} product Created product
 */

const express = require('express');

const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate, optionalAuth } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const router = express.Router();



// Create product
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { name, type, quantity, total_price, farm_id, product_batch } = req.body;

  if (!name || !type || !quantity || total_price === undefined || !farm_id || !product_batch) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be greater than 0' });
  }

  if (total_price < 0) {
    return res.status(400).json({ error: 'Total price cannot be negative' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { products, product_batches: productBatches } = await getCollections(db);

  // Resolve batch ID
  let batchId = product_batch;
  if (product_batch.length !== 24) {
    const batch = await productBatches.findOne({ 
      name: product_batch, 
      farm_id: toObjectId(farm_id) 
    });
    if (!batch) {
      return res.status(400).json({ error: 'Product batch not found' });
    }
    batchId = batch._id.toString();
  }

  const productDoc = {
    name,
    type,
    quantity: parseInt(quantity),
    unit_price: parseFloat(total_price) / parseInt(quantity),
    total_value: parseFloat(total_price),
    farm_id: toObjectId(farm_id),
    product_batch: batchId,
    status: 'unsold',
    show_in_profile: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const result = await products.insertOne(productDoc);
  const createdProduct = await products.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(createdProduct));
}));

// Get products
router.get('/', asyncHandler(async (req, res) => {
  const { farm_id, status, skip = 0, limit = 100 } = req.query;

  const { db } = await connectToDatabase();
  const { products, product_batches: productBatches } = await getCollections(db);

  const query = {};

  if (farm_id) {
    query.farm_id = toObjectId(farm_id);
  }

  if (status) {
    query.status = status;
  }

  const productsList = await products
    .find(query)
    .skip(parseInt(skip))
    .limit(parseInt(limit))
    .toArray();

  // Populate batch names
  const productsWithBatchNames = await Promise.all(
    productsList.map(async (product) => {
      try {
        // Check if product_batch exists
        if (product.product_batch) {
          let batchId = product.product_batch;
          
          // Convert to string if it's an ObjectId
          if (typeof batchId === 'object' && batchId._id) {
            batchId = batchId._id.toString();
          } else if (typeof batchId === 'object') {
            batchId = batchId.toString();
          }
          
          // Try to find the batch by ID
          const batch = await productBatches.findOne({ _id: toObjectId(batchId) });
          
          return {
            ...serializeDoc(product),
            product_batch_name: batch ? batch.name : `Batch ${batchId.slice(-6)}`,
          };
        } else {
          // If no batch ID, use default
          return {
            ...serializeDoc(product),
            product_batch_name: 'No Batch',
          };
        }
      } catch (error) {
        // If batch ID is invalid, return a fallback name
        const batchId = product.product_batch ? product.product_batch.toString() : '';
        return {
          ...serializeDoc(product),
          product_batch_name: batchId ? `Batch ${batchId.slice(-6)}` : 'No Batch',
        };
      }
    })
  );

  res.json(productsWithBatchNames);
}));

// Get product by ID
router.get('/:productId', asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const { db } = await connectToDatabase();
  const { products, product_batches: productBatches } = await getCollections(db);

  const product = await products.findOne({ _id: toObjectId(productId) });
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Populate batch name
  let productWithBatchName = serializeDoc(product);
  try {
    const batch = await productBatches.findOne({ _id: toObjectId(product.product_batch) });
    productWithBatchName.product_batch_name = batch ? batch.name : product.product_batch;
  } catch (error) {
    productWithBatchName.product_batch_name = product.product_batch;
  }

  res.json(productWithBatchName);
}));

// Update product
router.put('/:productId', authenticate, asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const updates = req.body;

  const { db } = await connectToDatabase();
  const { products } = await getCollections(db);

  const product = await products.findOne({ _id: toObjectId(productId) });
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  await verifyFarmAccess(product.farm_id.toString(), req.user.userId, db);

  delete updates._id;
  delete updates.farm_id;
  delete updates.created_at;
  updates.updated_at = new Date();

  // Recalculate if quantity or price changed
  if (updates.quantity || updates.unit_price) {
    const newQuantity = updates.quantity || product.quantity;
    const newUnitPrice = updates.unit_price || product.unit_price;
    updates.total_value = newQuantity * newUnitPrice;
  }

  await products.updateOne(
    { _id: toObjectId(productId) },
    { $set: updates }
  );

  const updatedProduct = await products.findOne({ _id: toObjectId(productId) });
  res.json(serializeDoc(updatedProduct));
}));

// Delete product
router.delete('/:productId', authenticate, asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const { db } = await connectToDatabase();
  const { products } = await getCollections(db);

  const product = await products.findOne({ _id: toObjectId(productId) });
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  await verifyFarmAccess(product.farm_id.toString(), req.user.userId, db);

  await products.deleteOne({ _id: toObjectId(productId) });
  res.json({ message: 'Product deleted successfully' });
}));

module.exports = router;
