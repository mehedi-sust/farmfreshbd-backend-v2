const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId } = require('../src/utils/helpers');

const router = express.Router();

// Get user's cart items - GET /cart
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { cart_items } = await getCollections(db);

  const cartItems = await cart_items.find({ 
    user_id: toObjectId(req.user.userId) 
  }).sort({ created_at: -1 }).toArray();

  res.json(serializeDocs(cartItems));
}));

// Add item to cart - POST /cart
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { product_id, quantity, farm_id } = req.body;

  if (!product_id || !quantity || !farm_id) {
    return res.status(400).json({ 
      error: 'product_id, quantity, and farm_id are required' 
    });
  }

  if (quantity <= 0) {
    return res.status(400).json({ 
      error: 'Quantity must be greater than 0' 
    });
  }

  const { db } = await connectToDatabase();
  const { cart_items, products } = await getCollections(db);

  // Verify product exists
  const product = await products.findOne({ _id: toObjectId(product_id) });
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Check if item already exists in cart
  const existingItem = await cart_items.findOne({
    user_id: toObjectId(req.user.userId),
    product_id: toObjectId(product_id)
  });

  let result;
  if (existingItem) {
    // Update quantity
    result = await cart_items.updateOne(
      { _id: existingItem._id },
      { 
        $set: { 
          quantity: existingItem.quantity + quantity,
          updated_at: new Date()
        }
      }
    );
    
    const updatedItem = await cart_items.findOne({ _id: existingItem._id });
    res.json(serializeDoc(updatedItem));
  } else {
    // Add new item
    const cartItem = {
      user_id: toObjectId(req.user.userId),
      product_id: toObjectId(product_id),
      farm_id: toObjectId(farm_id),
      quantity: parseInt(quantity),
      created_at: new Date(),
      updated_at: new Date()
    };

    result = await cart_items.insertOne(cartItem);
    const newItem = await cart_items.findOne({ _id: result.insertedId });
    res.status(201).json(serializeDoc(newItem));
  }
}));

// Update cart item quantity - PUT /cart/:item_id
router.put('/:item_id', authenticate, asyncHandler(async (req, res) => {
  const { item_id } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ 
      error: 'Valid quantity is required' 
    });
  }

  const { db } = await connectToDatabase();
  const { cart_items } = await getCollections(db);

  const result = await cart_items.updateOne(
    { 
      _id: toObjectId(item_id),
      user_id: toObjectId(req.user.userId)
    },
    { 
      $set: { 
        quantity: parseInt(quantity),
        updated_at: new Date()
      }
    }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: 'Cart item not found' });
  }

  const updatedItem = await cart_items.findOne({ _id: toObjectId(item_id) });
  res.json(serializeDoc(updatedItem));
}));

// Remove item from cart - DELETE /cart/:item_id
router.delete('/:item_id', authenticate, asyncHandler(async (req, res) => {
  const { item_id } = req.params;

  const { db } = await connectToDatabase();
  const { cart_items } = await getCollections(db);

  const result = await cart_items.deleteOne({
    _id: toObjectId(item_id),
    user_id: toObjectId(req.user.userId)
  });

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: 'Cart item not found' });
  }

  res.json({ message: 'Cart item removed successfully' });
}));

// Clear all cart items - DELETE /cart
router.delete('/', authenticate, asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { cart_items } = await getCollections(db);

  const result = await cart_items.deleteMany({
    user_id: toObjectId(req.user.userId)
  });

  res.json({ 
    message: 'Cart cleared successfully',
    deleted_count: result.deletedCount
  });
}));

// Sync cart items - POST /cart/sync
router.post('/sync', authenticate, asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ 
      error: 'Items must be an array' 
    });
  }

  const { db } = await connectToDatabase();
  const { cart_items } = await getCollections(db);

  // Clear existing cart items
  await cart_items.deleteMany({
    user_id: toObjectId(req.user.userId)
  });

  // Add new items
  if (items.length > 0) {
    const cartItems = items.map(item => ({
      user_id: toObjectId(req.user.userId),
      product_id: toObjectId(item.product_id),
      farm_id: toObjectId(item.farm_id),
      quantity: parseInt(item.quantity),
      created_at: new Date(),
      updated_at: new Date()
    }));

    await cart_items.insertMany(cartItems);
  }

  // Return updated cart
  const updatedCart = await cart_items.find({ 
    user_id: toObjectId(req.user.userId) 
  }).sort({ created_at: -1 }).toArray();

  res.json(serializeDocs(updatedCart));
}));

module.exports = router;