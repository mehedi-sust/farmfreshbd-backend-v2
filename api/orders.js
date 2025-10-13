const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const router = express.Router();

// Get user's orders - GET /orders/my-orders
router.get('/my-orders', authenticate, asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { orders } = await getCollections(db);

  const userOrders = await orders.find({ 
    customer_id: toObjectId(req.user.userId) 
  }).sort({ created_at: -1 }).toArray();

  res.json(serializeDocs(userOrders));
}));

// Get orders for a specific farm - GET /orders/farm/:farm_id
router.get('/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { orders } = await getCollections(db);

  const farmOrders = await orders.find({ 
    farm_id: toObjectId(farm_id) 
  }).sort({ created_at: -1 }).toArray();

  res.json(serializeDocs(farmOrders));
}));

// Get specific order by ID - GET /orders/:order_id
router.get('/:order_id', authenticate, asyncHandler(async (req, res) => {
  const { order_id } = req.params;

  const { db } = await connectToDatabase();
  const { orders } = await getCollections(db);

  const order = await orders.findOne({ _id: toObjectId(order_id) });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Check if user has access to this order (either customer or farm owner)
  const isCustomer = order.customer_id.toString() === req.user.userId;
  let isFarmOwner = false;

  if (!isCustomer) {
    try {
      await verifyFarmAccess(order.farm_id.toString(), req.user.userId, db);
      isFarmOwner = true;
    } catch (error) {
      // User doesn't have access to this order
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json(serializeDoc(order));
}));

// Create new order - POST /orders
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { 
    farm_id, 
    items, 
    delivery_address, 
    delivery_fee = 0,
    notes 
  } = req.body;

  if (!farm_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ 
      error: 'farm_id and items array are required' 
    });
  }

  if (!delivery_address) {
    return res.status(400).json({ 
      error: 'delivery_address is required' 
    });
  }

  const { db } = await connectToDatabase();
  const { orders, products } = await getCollections(db);

  // Calculate total amount
  let total_amount = 0;
  const orderItems = [];

  for (const item of items) {
    if (!item.product_id || !item.quantity || item.quantity <= 0) {
      return res.status(400).json({ 
        error: 'Each item must have product_id and valid quantity' 
      });
    }

    const product = await products.findOne({ _id: toObjectId(item.product_id) });
    if (!product) {
      return res.status(404).json({ 
        error: `Product not found: ${item.product_id}` 
      });
    }

    const itemTotal = product.price * item.quantity;
    total_amount += itemTotal;

    orderItems.push({
      product_id: toObjectId(item.product_id),
      product_name: product.name,
      quantity: parseInt(item.quantity),
      price_per_unit: product.price,
      total_price: itemTotal
    });
  }

  total_amount += parseFloat(delivery_fee);

  const order = {
    customer_id: toObjectId(req.user.userId),
    farm_id: toObjectId(farm_id),
    items: orderItems,
    total_amount,
    delivery_fee: parseFloat(delivery_fee),
    delivery_address,
    notes: notes || '',
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date()
  };

  const result = await orders.insertOne(order);
  const newOrder = await orders.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(newOrder));
}));

// Update order status - PUT /orders/:order_id/status
router.put('/:order_id/status', authenticate, asyncHandler(async (req, res) => {
  const { order_id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ 
      error: `Status must be one of: ${validStatuses.join(', ')}` 
    });
  }

  const { db } = await connectToDatabase();
  const { orders } = await getCollections(db);

  const order = await orders.findOne({ _id: toObjectId(order_id) });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Only farm owner can update order status
  await verifyFarmAccess(order.farm_id.toString(), req.user.userId, db);

  const result = await orders.updateOne(
    { _id: toObjectId(order_id) },
    { 
      $set: { 
        status,
        updated_at: new Date()
      }
    }
  );

  const updatedOrder = await orders.findOne({ _id: toObjectId(order_id) });
  res.json(serializeDoc(updatedOrder));
}));

// Update delivery fee - PUT /orders/:order_id/delivery-fee
router.put('/:order_id/delivery-fee', authenticate, asyncHandler(async (req, res) => {
  const { order_id } = req.params;
  const { delivery_fee } = req.body;

  if (delivery_fee === undefined || delivery_fee < 0) {
    return res.status(400).json({ 
      error: 'Valid delivery_fee is required' 
    });
  }

  const { db } = await connectToDatabase();
  const { orders } = await getCollections(db);

  const order = await orders.findOne({ _id: toObjectId(order_id) });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Only farm owner can update delivery fee
  await verifyFarmAccess(order.farm_id.toString(), req.user.userId, db);

  // Recalculate total amount
  const itemsTotal = order.items.reduce((sum, item) => sum + item.total_price, 0);
  const newTotalAmount = itemsTotal + parseFloat(delivery_fee);

  const result = await orders.updateOne(
    { _id: toObjectId(order_id) },
    { 
      $set: { 
        delivery_fee: parseFloat(delivery_fee),
        total_amount: newTotalAmount,
        updated_at: new Date()
      }
    }
  );

  const updatedOrder = await orders.findOne({ _id: toObjectId(order_id) });
  res.json(serializeDoc(updatedOrder));
}));

// Cancel order - PUT /orders/:order_id/cancel
router.put('/:order_id/cancel', authenticate, asyncHandler(async (req, res) => {
  const { order_id } = req.params;

  const { db } = await connectToDatabase();
  const { orders } = await getCollections(db);

  const order = await orders.findOne({ _id: toObjectId(order_id) });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Check if user has access to cancel this order (either customer or farm owner)
  const isCustomer = order.customer_id.toString() === req.user.userId;
  let isFarmOwner = false;

  if (!isCustomer) {
    try {
      await verifyFarmAccess(order.farm_id.toString(), req.user.userId, db);
      isFarmOwner = true;
    } catch (error) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  // Check if order can be cancelled
  if (order.status === 'delivered' || order.status === 'cancelled') {
    return res.status(400).json({ 
      error: `Cannot cancel order with status: ${order.status}` 
    });
  }

  const result = await orders.updateOne(
    { _id: toObjectId(order_id) },
    { 
      $set: { 
        status: 'cancelled',
        updated_at: new Date()
      }
    }
  );

  const updatedOrder = await orders.findOne({ _id: toObjectId(order_id) });
  res.json(serializeDoc(updatedOrder));
}));

module.exports = router;