/**
 * @api {post} /api/orders Create Order
 * @apiName CreateOrder
 * @apiGroup Orders
 * @apiVersion 1.0.0
 * @apiPermission authenticated
 * 
 * @apiHeader {String} Authorization Bearer token
 * 
 * @apiBody {Object[]} items Order items [{store_product_id, quantity, price}]
 * @apiBody {String} farm_id Farm ID
 * @apiBody {String} [customer_phone] Customer phone
 * @apiBody {String} [delivery_address] Delivery address
 * 
 * @apiSuccess {Object} order Created order
 */

const express = require('express');
const cors = require('cors');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId } = require('../src/utils/helpers');

const app = express();
app.use(cors());
app.use(express.json());

// Create order (supports multiple farms)
app.post('/', authenticate, asyncHandler(async (req, res) => {
  const { items, customer_phone, delivery_address } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items are required' });
  }

  if (!customer_phone || !delivery_address) {
    return res.status(400).json({ error: 'Customer phone and delivery address are required' });
  }

  const { db } = await connectToDatabase();
  const { orders, storeProducts, cartItems, farms } = getCollections(db);

  // Group items by farm
  const itemsByFarm = {};
  
  for (const item of items) {
    const product = await storeProducts.findOne({ _id: toObjectId(item.store_product_id) });
    if (!product) {
      return res.status(404).json({ error: `Product ${item.store_product_id} not found` });
    }

    if (!product.is_published) {
      return res.status(400).json({ error: `Product '${product.name}' is not available` });
    }

    if (product.available_stock < item.quantity) {
      return res.status(400).json({ error: `Insufficient stock for '${product.name}'. Available: ${product.available_stock}, Requested: ${item.quantity}` });
    }

    const farmId = product.farm_id.toString();
    if (!itemsByFarm[farmId]) {
      itemsByFarm[farmId] = {
        farm_id: farmId,
        items: [],
        total_amount: 0
      };
    }

    const itemTotal = product.selling_price * item.quantity;
    itemsByFarm[farmId].total_amount += itemTotal;
    itemsByFarm[farmId].items.push({
      store_product_id: item.store_product_id,
      quantity: item.quantity,
      price: product.selling_price,
      product_name: product.name,
      category: product.category,
      unit: product.unit
    });
  }

  // Create separate orders for each farm
  const createdOrders = [];
  
  for (const farmId in itemsByFarm) {
    const farmData = itemsByFarm[farmId];
    
    const orderDoc = {
      customer_id: toObjectId(req.user.userId),
      farm_id: toObjectId(farmId),
      items: farmData.items,
      total_amount: farmData.total_amount,
      delivery_fee: null, // To be set by farm manager
      final_amount: farmData.total_amount, // Will be updated when delivery fee is set
      status: 'pending', // pending -> confirmed -> processing -> in_transit -> delivered
      customer_phone,
      delivery_address,
      cancellation_reason: null,
      courier_contact: null,
      courier_ref_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await orders.insertOne(orderDoc);
    const created = await orders.findOne({ _id: result.insertedId });
    createdOrders.push(serializeDoc(created));

    // Update stock for this farm's products
    for (const item of farmData.items) {
      await storeProducts.updateOne(
        { _id: toObjectId(item.store_product_id) },
        { $inc: { available_stock: -item.quantity } }
      );
    }
  }
  
  // Clear all cart items for the user
  await cartItems.deleteMany({
    user_id: toObjectId(req.user.userId)
  });

  res.status(201).json({
    message: `${createdOrders.length} order(s) created successfully`,
    orders: createdOrders
  });
}));

// Get orders (customer or farm manager)
app.get('/', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, status, page = '1', limit = '10' } = req.query;

  const { db } = await connectToDatabase();
  const { orders, users, farms } = getCollections(db);

  const user = await users.findOne({ _id: toObjectId(req.user.userId) });
  
  const query = {};

  if (farm_id) {
    // Farm manager viewing orders
    if (user.farm_id?.toString() !== farm_id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    query.farm_id = toObjectId(farm_id);
  } else {
    // Customer viewing their orders
    query.customer_id = toObjectId(req.user.userId);
  }

  if (status) {
    query.status = status;
  }

  // Pagination
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  // Get total count for pagination
  const totalOrders = await orders.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / limitNum);

  const ordersList = await orders.find(query)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limitNum)
    .toArray();
  
  // Transform orders to include items_details and farm_name
  const transformedOrders = await Promise.all(ordersList.map(async (order) => {
    const farm = await farms.findOne({ _id: order.farm_id });
    const { storeProducts } = getCollections(db);
    
    // Get product_id for each item by looking up store product
    const itemsDetailsPromises = order.items.map(async (item) => {
      const storeProduct = await storeProducts.findOne({ _id: toObjectId(item.store_product_id) });
      return {
        product_id: storeProduct?.product_id?.toString() || null,
        product_name: item.product_name,
        product_type: item.category,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      };
    });
    
    const items_details = await Promise.all(itemsDetailsPromises);
    
    return {
      ...order,
      farm_name: farm?.name || 'Unknown Farm',
      items_details
    };
  }));
  
  // Return paginated response
  res.json({
    orders: serializeDocs(transformedOrders),
    pagination: {
      currentPage: pageNum,
      totalPages: totalPages,
      totalOrders: totalOrders,
      ordersPerPage: limitNum
    }
  });
}));

// Get user's orders (frontend compatibility endpoint)
app.get('/my-orders', authenticate, asyncHandler(async (req, res) => {
  const { status, page = '1', limit = '10' } = req.query;

  const { db } = await connectToDatabase();
  const { orders, farms } = getCollections(db);

  console.log('User ID from token:', req.user.userId, 'Type:', typeof req.user.userId);
  
  const query = {
    customer_id: toObjectId(req.user.userId)
  };

  if (status) {
    query.status = status;
  }

  // Pagination
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  // Get total count for pagination
  const totalOrders = await orders.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / limitNum);

  const ordersList = await orders.find(query)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limitNum)
    .toArray();
  
  // Transform orders to include items_details and farm_name
  const transformedOrders = await Promise.all(ordersList.map(async (order) => {
    const farm = await farms.findOne({ _id: order.farm_id });
    
    return {
      ...order,
      farm_name: farm?.name || 'Unknown Farm',
      items_details: order.items.map(item => ({
        product_name: item.product_name,
        product_type: item.category,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      }))
    };
  }));
  
  // Return paginated response
  res.json({
    orders: serializeDocs(transformedOrders),
    pagination: {
      currentPage: pageNum,
      totalPages: totalPages,
      totalOrders: totalOrders,
      ordersPerPage: limitNum
    }
  });
}));

// Get order by ID
app.get('/:orderId', authenticate, asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const { db } = await connectToDatabase();
  const { orders, users, farms } = getCollections(db);

  const order = await orders.findOne({ _id: toObjectId(orderId) });
  
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const user = await users.findOne({ _id: toObjectId(req.user.userId) });

  // Check access
  const isCustomer = order.customer_id.toString() === req.user.userId;
  const isFarmManager = user.farm_id?.toString() === order.farm_id.toString();
  const isAdmin = user.role === 'admin';

  if (!isCustomer && !isFarmManager && !isAdmin) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Transform order to include items_details and farm_name
  const farm = await farms.findOne({ _id: order.farm_id });
  const { storeProducts } = getCollections(db);
  
  // Get product_id for each item by looking up store product
  const itemsDetailsPromises = order.items.map(async (item) => {
    const storeProduct = await storeProducts.findOne({ _id: toObjectId(item.store_product_id) });
    return {
      product_id: storeProduct?.product_id?.toString() || null,
      product_name: item.product_name,
      product_type: item.category,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity
    };
  });
  
  const items_details = await Promise.all(itemsDetailsPromises);
  
  const transformedOrder = {
    ...order,
    farm_name: farm?.name || 'Unknown Farm',
    items_details
  };

  res.json(serializeDoc(transformedOrder));
}));

// Update order status
app.put('/:orderId/status', authenticate, asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status, delivery_fee, cancellation_reason, courier_contact, courier_ref_id, payment_info } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const validStatuses = ['pending', 'confirmed', 'waiting_for_payment', 'processing', 'in_transit', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Valid statuses: ' + validStatuses.join(', ') });
  }

  const { db } = await connectToDatabase();
  const { orders, users } = getCollections(db);

  const order = await orders.findOne({ _id: toObjectId(orderId) });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const user = await users.findOne({ _id: toObjectId(req.user.userId) });

  // Only farm manager or admin can update status
  const isFarmManager = user.farm_id?.toString() === order.farm_id.toString();
  const isAdmin = user.role === 'admin';

  if (!isFarmManager && !isAdmin) {
    return res.status(403).json({ error: 'Access denied. Only farm managers can update order status.' });
  }

  // Validate status transitions
  const currentStatus = order.status;
  const validTransitions = {
    'pending': ['confirmed', 'waiting_for_payment', 'cancelled'],
    'confirmed': ['waiting_for_payment', 'processing', 'cancelled'],
    'waiting_for_payment': ['confirmed', 'processing', 'cancelled'],
    'processing': ['in_transit', 'cancelled'],
    'in_transit': ['delivered'],
    'delivered': [], // Final state
    'cancelled': [] // Final state
  };

  if (!validTransitions[currentStatus].includes(status)) {
    return res.status(400).json({ 
      error: `Invalid status transition from '${currentStatus}' to '${status}'. Valid transitions: ${validTransitions[currentStatus].join(', ') || 'none'}` 
    });
  }

  const updates = {
    status,
    updated_at: new Date()
  };

  // Handle delivery fee (only when confirming)
  if (status === 'confirmed' && delivery_fee !== undefined) {
    if (delivery_fee < 0) {
      return res.status(400).json({ error: 'Delivery fee cannot be negative' });
    }
    updates.delivery_fee = delivery_fee;
    updates.final_amount = order.total_amount + delivery_fee;
  }

  // Handle courier information (when setting to in_transit)
  if (status === 'in_transit') {
    if (!courier_contact) {
      return res.status(400).json({ error: 'Courier contact is required when setting status to in_transit' });
    }
    updates.courier_contact = courier_contact;
    if (courier_ref_id) {
      updates.courier_ref_id = courier_ref_id;
    }
  }

  // Handle payment info (when setting to waiting_for_payment)
  if (status === 'waiting_for_payment') {
    if (payment_info) {
      updates.payment_info = payment_info;
    }
  }

  // Handle cancellation
  if (status === 'cancelled') {
    if (!cancellation_reason) {
      return res.status(400).json({ error: 'Cancellation reason is required' });
    }
    updates.cancellation_reason = cancellation_reason;
    
    // Restore stock for cancelled orders
    const { storeProducts } = getCollections(db);
    for (const item of order.items) {
      await storeProducts.updateOne(
        { _id: toObjectId(item.store_product_id) },
        { $inc: { available_stock: item.quantity } }
      );
    }
  }

  await orders.updateOne(
    { _id: toObjectId(orderId) },
    { $set: updates }
  );

  const updated = await orders.findOne({ _id: toObjectId(orderId) });
  res.json(serializeDoc(updated));
}));

// Set delivery fee (farm manager convenience endpoint)
app.put('/:orderId/delivery-fee', authenticate, asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { delivery_fee } = req.body;

  if (delivery_fee === undefined || delivery_fee < 0) {
    return res.status(400).json({ error: 'Valid delivery fee is required' });
  }

  const { db } = await connectToDatabase();
  const { orders, users } = getCollections(db);

  const order = await orders.findOne({ _id: toObjectId(orderId) });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const user = await users.findOne({ _id: toObjectId(req.user.userId) });

  // Only farm manager or admin can set delivery fee
  const isFarmManager = user.farm_id?.toString() === order.farm_id.toString();
  const isAdmin = user.role === 'admin';

  if (!isFarmManager && !isAdmin) {
    return res.status(403).json({ error: 'Access denied. Only farm managers can set delivery fee.' });
  }

  // Update delivery fee and final amount
  const updates = {
    delivery_fee: parseFloat(delivery_fee),
    final_amount: order.total_amount + parseFloat(delivery_fee),
    updated_at: new Date()
  };

  await orders.updateOne(
    { _id: toObjectId(orderId) },
    { $set: updates }
  );

  const updatedOrder = await orders.findOne({ _id: toObjectId(orderId) });
  res.json(serializeDoc(updatedOrder));
}));

// Cancel order (customer)
app.post('/:orderId/cancel', authenticate, asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  const { db } = await connectToDatabase();
  const { orders } = getCollections(db);

  const order = await orders.findOne({ _id: toObjectId(orderId) });
  
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (order.customer_id.toString() !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (order.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending orders can be cancelled' });
  }

  await orders.updateOne(
    { _id: toObjectId(orderId) },
    { 
      $set: { 
        status: 'cancelled',
        cancellation_reason: reason || 'Cancelled by customer',
        updated_at: new Date()
      } 
    }
  );

  const updated = await orders.findOne({ _id: toObjectId(orderId) });
  res.json(serializeDoc(updated));
}));

// Cancel order (PUT version for frontend compatibility)
app.put('/:orderId/cancel', authenticate, asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  const { db } = await connectToDatabase();
  const { orders, users } = getCollections(db);

  const order = await orders.findOne({ _id: toObjectId(orderId) });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const user = await users.findOne({ _id: toObjectId(req.user.userId) });

  // Check access - customer can cancel their own orders, farm managers can cancel orders for their farm
  const isCustomer = order.customer_id.toString() === req.user.userId;
  const isFarmManager = user.farm_id?.toString() === order.farm_id.toString();
  const isAdmin = user.role === 'admin';

  if (!isCustomer && !isFarmManager && !isAdmin) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (order.status !== 'pending' && order.status !== 'confirmed') {
    return res.status(400).json({ error: 'Only pending or confirmed orders can be cancelled' });
  }

  await orders.updateOne(
    { _id: toObjectId(orderId) },
    { 
      $set: { 
        status: 'cancelled',
        cancellation_reason: reason || 'Cancelled by user',
        updated_at: new Date()
      } 
    }
  );

  const updated = await orders.findOne({ _id: toObjectId(orderId) });
  res.json(serializeDoc(updated));
}));

// Place order from cart (convenience endpoint)
app.post('/place-from-cart', authenticate, asyncHandler(async (req, res) => {
  const { customer_phone, delivery_address, notes } = req.body;

  if (!customer_phone || !delivery_address) {
    return res.status(400).json({ error: 'Customer phone and delivery address are required' });
  }

  const { db } = await connectToDatabase();
  const { cartItems, storeProducts } = getCollections(db);

  // Get user's cart items
  const userCartItems = await cartItems.find({ 
    user_id: toObjectId(req.user.userId) 
  }).toArray();

  if (userCartItems.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  // Convert cart items to order format
  const items = [];
  for (const cartItem of userCartItems) {
    // Verify store product still exists and is available
    const storeProduct = await storeProducts.findOne({ 
      _id: toObjectId(cartItem.store_product_id) 
    });
    
    if (!storeProduct) {
      return res.status(404).json({ 
        error: `Product no longer available: ${cartItem.store_product_id}` 
      });
    }

    if (!storeProduct.is_published) {
      return res.status(400).json({ 
        error: `Product '${storeProduct.name}' is no longer available` 
      });
    }

    if (storeProduct.available_stock < cartItem.quantity) {
      return res.status(400).json({ 
        error: `Insufficient stock for '${storeProduct.name}'. Available: ${storeProduct.available_stock}, Requested: ${cartItem.quantity}` 
      });
    }

    items.push({
      store_product_id: cartItem.store_product_id,
      quantity: cartItem.quantity
    });
  }

  // Use the existing order creation logic
  const orderData = {
    items,
    customer_phone,
    delivery_address,
    notes
  };

  // Call the existing order creation endpoint logic
  req.body = orderData;
  
  // Reuse the existing POST / logic by calling it directly
  const originalUrl = req.url;
  const originalMethod = req.method;
  
  req.url = '/';
  req.method = 'POST';
  
  // Find the POST / handler and call it
  const postHandler = app._router.stack.find(layer => 
    layer.route && 
    layer.route.path === '/' && 
    layer.route.methods.post
  );
  
  if (postHandler) {
    return postHandler.route.stack[0].handle(req, res);
  } else {
    // Fallback: duplicate the logic here
    return res.status(500).json({ error: 'Order creation handler not found' });
  }
}));

module.exports = app;