/**
 * @api {post} /api/cart Add to Cart
 * @apiName AddToCart
 * @apiGroup Cart
 * @apiVersion 1.0.0
 * @apiPermission authenticated
 * 
 * @apiHeader {String} Authorization Bearer token
 * 
 * @apiBody {String} store_product_id Store product ID
 * @apiBody {Number} quantity Quantity to add
 * 
 * @apiSuccess {Object} cartItem Created or updated cart item
 */

const express = require('express');
const cors = require('cors');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, toObjectId } = require('../src/utils/helpers');

const app = express();
app.use(cors());
app.use(express.json());

// Add to cart
app.post('/', authenticate, asyncHandler(async (req, res) => {
  const { store_product_id, quantity } = req.body;

  if (!store_product_id || !quantity) {
    return res.status(400).json({ error: 'Store product ID and quantity are required' });
  }

  if (quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be greater than 0' });
  }

  const { db } = await connectToDatabase();
  const { cartItems, storeProducts } = getCollections(db);

  // Check if store product exists
  const storeProduct = await storeProducts.findOne({ _id: toObjectId(store_product_id) });
  if (!storeProduct) {
    return res.status(404).json({ error: 'Store product not found' });
  }

  if (!storeProduct.is_published) {
    return res.status(400).json({ error: 'Product is not available' });
  }

  if (storeProduct.available_stock <= 0) {
    return res.status(400).json({ error: 'Product is out of stock' });
  }

  // Check if item already in cart
  const existingItem = await cartItems.findOne({
    user_id: toObjectId(req.user.userId),
    store_product_id: toObjectId(store_product_id)
  });

  if (existingItem) {
    // Update quantity
    const newQuantity = existingItem.quantity + quantity;
    await cartItems.updateOne(
      { _id: existingItem._id },
      { $set: { quantity: newQuantity } }
    );
    const updated = await cartItems.findOne({ _id: existingItem._id });
    return res.json(serializeDoc(updated));
  }

  // Create new cart item
  const cartItemDoc = {
    user_id: toObjectId(req.user.userId),
    store_product_id: toObjectId(store_product_id),
    quantity,
    created_at: new Date(),
  };

  const result = await cartItems.insertOne(cartItemDoc);
  const created = await cartItems.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(created));
}));

// Get cart items
app.get('/', authenticate, asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { cartItems } = getCollections(db);

  const pipeline = [
    { $match: { user_id: toObjectId(req.user.userId) } },
    {
      $lookup: {
        from: 'store_products',
        localField: 'store_product_id',
        foreignField: '_id',
        as: 'store_product'
      }
    },
    { $unwind: '$store_product' },
    {
      $lookup: {
        from: 'products',
        localField: 'store_product.product_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $lookup: {
        from: 'farms',
        localField: 'store_product.farm_id',
        foreignField: '_id',
        as: 'farm'
      }
    },
    { $unwind: '$farm' },
    {
      $project: {
        _id: { $toString: '$_id' },
        user_id: { $toString: '$user_id' },
        store_product_id: { $toString: '$store_product_id' },
        quantity: 1,
        created_at: 1,
        // Product details for frontend compatibility
        product: {
          _id: { $toString: '$store_product_id' },
          product_id: { $toString: '$store_product.product_id' },
          farm_id: { $toString: '$store_product.farm_id' },
          price: '$store_product.selling_price',
          is_available: { $gt: ['$store_product.available_stock', 0] },
          created_at: '$store_product.created_at',
          updated_at: '$store_product.updated_at',
          product_name: '$store_product.name',
          product_type: '$store_product.category',
          product_quantity: '$store_product.available_stock',
          farm_name: '$farm.name',
          farm_location: '$farm.location',
          description: '$store_product.description',
          product_image_url: '$store_product.product_image_url',
          category: '$store_product.category',
          unit: '$store_product.unit'
        }
      }
    }
  ];

  const items = await cartItems.aggregate(pipeline).toArray();
  res.json(items);
}));

// Update cart item
app.put('/:cartItemId', authenticate, asyncHandler(async (req, res) => {
  const { cartItemId } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Valid quantity is required' });
  }

  const { db } = await connectToDatabase();
  const { cartItems } = getCollections(db);

  const item = await cartItems.findOne({ 
    _id: toObjectId(cartItemId),
    user_id: toObjectId(req.user.userId)
  });

  if (!item) {
    return res.status(404).json({ error: 'Cart item not found' });
  }

  await cartItems.updateOne(
    { _id: toObjectId(cartItemId) },
    { $set: { quantity } }
  );

  const updated = await cartItems.findOne({ _id: toObjectId(cartItemId) });
  res.json(serializeDoc(updated));
}));

// Delete cart item
app.delete('/:cartItemId', authenticate, asyncHandler(async (req, res) => {
  const { cartItemId } = req.params;

  const { db } = await connectToDatabase();
  const { cartItems } = getCollections(db);

  const result = await cartItems.deleteOne({ 
    _id: toObjectId(cartItemId),
    user_id: toObjectId(req.user.userId)
  });

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: 'Cart item not found' });
  }

  res.json({ message: 'Cart item removed successfully' });
}));

// Clear cart
app.delete('/', authenticate, asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { cartItems } = getCollections(db);

  await cartItems.deleteMany({ user_id: toObjectId(req.user.userId) });
  res.json({ message: 'Cart cleared successfully' });
}));


// Synchronize cart
app.post('/sync', authenticate, asyncHandler(async (req, res) => {
  const { items } = req.body; // Expect an array of { store_product_id, quantity }

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Items must be an array' });
  }

  const { db } = await connectToDatabase();
  const { cartItems, storeProducts } = getCollections(db);
  const userId = toObjectId(req.user.userId);

  // 1. Validate all items and stock before making any changes
  for (const item of items) {
    if (!item.store_product_id || !item.quantity || item.quantity <= 0) {
      return res.status(400).json({ error: `Invalid cart item provided: ${JSON.stringify(item)}` });
    }

    const storeProduct = await storeProducts.findOne({ _id: toObjectId(item.store_product_id) });

    if (!storeProduct) {
      return res.status(404).json({ error: `Product with ID ${item.store_product_id} not found` });
    }
    if (!storeProduct.is_published) {
      return res.status(400).json({ error: `Product '${storeProduct.name}' is not available` });
    }
    if (storeProduct.available_stock < item.quantity) {
      return res.status(400).json({ error: `Not enough stock for '${storeProduct.name}'. Requested: ${item.quantity}, Available: ${storeProduct.available_stock}` });
    }
  }

  // 2. If all validations pass, proceed with transaction
  const session = db.client.startSession();
  try {
    await session.withTransaction(async () => {
      // Clear the user's existing cart
      await cartItems.deleteMany({ user_id: userId }, { session });

      // If there are items to add, insert them
      if (items.length > 0) {
        const newCartItems = items.map(item => ({
          user_id: userId,
          store_product_id: toObjectId(item.store_product_id),
          quantity: item.quantity,
          created_at: new Date(),
        }));
        await cartItems.insertMany(newCartItems, { session });
      }
    });
    res.status(200).json({ message: 'Cart synchronized successfully' });
  } finally {
    await session.endSession();
  }
}));

module.exports = app;

