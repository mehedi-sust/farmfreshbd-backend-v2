/**
 * Commerce API - Consolidated endpoint for cart, orders, and sales
 * This consolidation reduces serverless function count for Vercel Hobby plan
 */

const express = require('express');
const { authenticate } = require('../src/config/auth');
const { asyncHandler } = require('../src/utils/helpers');
const DatabaseService = require('../src/services/database.service');
const { transaction } = require('../src/config/database');

const router = express.Router();

// Basic cart endpoints
router.get('/cart/health', (req, res) => {
  res.json({ status: 'ok', message: 'Cart API is running' });
});

// Get cart items
router.get('/cart', authenticate, asyncHandler(async (req, res) => {
  try {
    const cartItems = await DatabaseService.getCartItems(req.user.userId);
    res.json(cartItems);
  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// Add to cart
router.post('/cart', authenticate, asyncHandler(async (req, res) => {
  const { store_product_id, quantity } = req.body;

  if (!store_product_id || !quantity) {
    return res.status(400).json({ error: 'Store product ID and quantity are required' });
  }

  if (quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be greater than 0' });
  }

  try {
    // Check if store product exists and is available
    const storeProduct = await DatabaseService.getStoreProductById(store_product_id);
    if (!storeProduct) {
      return res.status(404).json({ error: 'Store product not found' });
    }

    // Align with v2 schema fields
    if (!storeProduct.is_available) {
      return res.status(400).json({ error: 'Product is not available' });
    }

    const availableStock = parseFloat(storeProduct.available_stock) || parseFloat(storeProduct.store_stock_quantity) || 0;

    if (availableStock <= 0) {
      return res.status(400).json({ error: 'Product is out of stock' });
    }

    if (availableStock < quantity) {
      return res.status(400).json({ 
        error: `Not enough stock. Available: ${availableStock}, Requested: ${quantity}` 
      });
    }

    const cartItem = await DatabaseService.addToCart(req.user.userId, store_product_id, quantity);
    res.status(201).json(cartItem);
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// Update cart item
router.put('/cart/:cartItemId', authenticate, asyncHandler(async (req, res) => {
  const { cartItemId } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Valid quantity is required' });
  }

  try {
    const updatedItem = await DatabaseService.updateCartItem(cartItemId, req.user.userId, quantity);
    if (!updatedItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// Remove cart item
router.delete('/cart/:cartItemId', authenticate, asyncHandler(async (req, res) => {
  const { cartItemId } = req.params;

  try {
    const removed = await DatabaseService.removeCartItem(cartItemId, req.user.userId);
    if (!removed) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    res.json({ message: 'Cart item removed successfully' });
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// Clear cart
router.delete('/cart', authenticate, asyncHandler(async (req, res) => {
  try {
    await DatabaseService.clearCart(req.user.userId);
    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// Sync cart - synchronize local cart with backend
router.post('/cart/sync', authenticate, asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Items must be an array' });
  }

  try {
    // 1) Validate incoming items BEFORE modifying the cart
    const validated = [];
    const userId = req.user.userId;

    for (const item of items) {
      const { store_product_id, quantity } = item || {};
      if (!store_product_id || !quantity || Number(quantity) <= 0) {
        continue; // Skip invalid items
      }

      try {
        const storeProduct = await DatabaseService.getStoreProductById(store_product_id);
        if (!storeProduct || !storeProduct.is_available) {
          continue; // Skip unavailable products
        }

        const availableStock = parseFloat(storeProduct.available_stock) || parseFloat(storeProduct.store_stock_quantity) || 0;

        if (!Number.isFinite(availableStock) || availableStock <= 0) {
          continue; // Skip out of stock products
        }

        const adjustedQuantity = Math.min(Number(quantity), Number(availableStock));
        validated.push({
          store_product_id,
          quantity: adjustedQuantity,
          adjusted: adjustedQuantity < Number(quantity),
          original_quantity: Number(quantity),
          adjusted_quantity: adjustedQuantity
        });
      } catch (err) {
        console.error(`Validation failed for item ${store_product_id}:`, err);
        // Skip this item and continue
      }
    }

    // If client explicitly sent empty items, clear cart
    const payloadItemsCount = Array.isArray(items) ? items.length : 0;
    if (payloadItemsCount === 0) {
      await DatabaseService.clearCart(userId);
      return res.json({
        message: 'Cart cleared',
        synced_items: 0,
        items: []
      });
    }

    // If no items validated from non-empty payload, do not change cart
    if (validated.length === 0) {
      return res.json({
        message: 'No valid items to sync; cart unchanged',
        synced_items: 0,
        items: []
      });
    }

    // 2) Replace cart atomically using a transaction
    await transaction(async (client) => {
      // Clear existing items for the user
      await client.query(`DELETE FROM shopping_cart WHERE user_id = $1`, [userId]);

      // Insert validated items (set absolute quantity)
      for (const v of validated) {
        await client.query(
          `INSERT INTO shopping_cart (user_id, store_product_id, quantity, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (user_id, store_product_id)
           DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
          [userId, v.store_product_id, v.quantity]
        );
      }
    });

    // 3) Return summary; authoritative cart can be fetched by client via GET /cart
    res.json({
      message: 'Cart synced successfully',
      synced_items: validated.length,
      items: validated
    });
  } catch (error) {
    console.error('Error syncing cart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// Basic orders endpoints
router.get('/orders/health', (req, res) => {
  res.json({ status: 'ok', message: 'Orders API is running' });
});

// Place order directly - POST /orders
router.post('/orders', authenticate, asyncHandler(async (req, res) => {
  const { items, customer_phone, delivery_address, notes, delivery_fee, temp_cart_id } = req.body;

  try {
    // Check for duplicate orders using temp_cart_id if provided
    if (temp_cart_id) {
      const existingOrder = await DatabaseService.findOrderByTempCartId(temp_cart_id);
      if (existingOrder) {
        return res.status(400).json({ 
          error: 'Order already placed for this cart session',
          existing_order_id: existingOrder._id 
        });
      }
    }

    const created = await DatabaseService.placeOrder(req.user.userId, {
      items,
      customer_phone,
      delivery_address,
      notes,
      delivery_fee,
      temp_cart_id
    });

    // Clear user's cart after successful order placement
    try {
      await DatabaseService.clearCart(req.user.userId);
    } catch (clearError) {
      console.error('Warning: Failed to clear cart after order placement:', clearError);
      // Don't fail the order if cart clearing fails
    }

    res.status(201).json({
      ...created,
      cart_cleared: true,
      redirect_to: '/orders'
    });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(400).json({ error: error.message || 'Failed to place order' });
  }
}));

// Convenience: place order from cart - POST /orders/place-from-cart
router.post('/orders/place-from-cart', authenticate, asyncHandler(async (req, res) => {
  const { customer_phone, delivery_address, notes, delivery_fee } = req.body;
  try {
    const cart = await DatabaseService.getCartItems(req.user.userId);
    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const items = cart.map(ci => ({
      store_product_id: ci.store_product_id,
      quantity: ci.quantity
    }));

    const created = await DatabaseService.placeOrder(req.user.userId, {
      items,
      customer_phone,
      delivery_address,
      notes,
      delivery_fee
    });

    // Clear cart after successful order
    await DatabaseService.clearCart(req.user.userId);

    res.status(201).json(created);
  } catch (error) {
    console.error('Error placing order from cart:', error);
    res.status(400).json({ error: error.message || 'Failed to place order from cart' });
  }
}));

// Get my orders with pagination and status filters - GET /orders/my-orders
router.get('/orders/my-orders', authenticate, asyncHandler(async (req, res) => {
  const { status = 'all', page = 1, limit = 10 } = req.query;
  try {
    const result = await DatabaseService.getUserOrders(req.user.userId, { status, page, limit });
    res.json(result);
  } catch (error) {
    console.error('Error fetching my orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
}));

// Get single order by id - GET /orders/:id
router.get('/orders/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const order = await DatabaseService.getOrderById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
}));

// Cancel order - PUT /orders/:id/cancel
router.put('/orders/:id/cancel', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const cancelled = await DatabaseService.cancelOrder(id, req.user.userId, reason);
    res.json(cancelled);
  } catch (error) {
    console.error('Error cancelling order:', error);
    const msg = error.message || 'Failed to cancel order';
    const code = /denied|not found|Only/.test(msg) ? 400 : 500;
    res.status(code).json({ error: msg });
  }
}));

// Get farm orders - GET /orders?farm_id=:id
router.get('/orders', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, status = 'all', page = 1, limit = 10 } = req.query;
  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }
  try {
    // Ownership verified inside service for status updates etc.; for listing we can also verify early
    const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this farm' });
    }
    const result = await DatabaseService.getFarmOrders(farm_id, { status, page, limit });
    res.json(result);
  } catch (error) {
    console.error('Error fetching farm orders:', error);
    res.status(500).json({ error: 'Failed to fetch farm orders' });
  }
}));

// Update order status - PUT /orders/:id/status
router.put('/orders/:id/status', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    status, 
    delivery_fee, 
    courier_contact, 
    courier_ref_id, 
    payment_info,
    payment_method,
    payment_reference,
    payment_message
  } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'status is required' });
  }
  try {
    const updated = await DatabaseService.updateOrderStatus(id, req.user.userId, status, {
      delivery_fee,
      courier_contact,
      courier_ref_id,
      payment_info,
      payment_method,
      payment_reference,
      payment_message
    });
    res.json(updated);
  } catch (error) {
    console.error('Error updating order status:', error);
    const msg = error.message || 'Failed to update order status';
    const code = /Access denied|Invalid status|Order not found|Invalid delivery_fee/.test(msg) ? 400 : 500;
    res.status(code).json({ error: msg });
  }
}));

// Set delivery fee - PUT /orders/:id/delivery-fee
router.put('/orders/:id/delivery-fee', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { delivery_fee } = req.body;
  if (delivery_fee === undefined) {
    return res.status(400).json({ error: 'delivery_fee is required' });
  }
  try {
    const updated = await DatabaseService.setOrderDeliveryFee(id, req.user.userId, delivery_fee);
    res.json(updated);
  } catch (error) {
    console.error('Error setting delivery fee:', error);
    const msg = error.message || 'Failed to set delivery fee';
    const code = /Access denied|Invalid delivery_fee|Order not found/.test(msg) ? 400 : 500;
    res.status(code).json({ error: msg });
  }
}));

// Sales routes (embedded to avoid creating separate file)
// Create sale - POST /sales
router.post('/sales', authenticate, asyncHandler(async (req, res) => {
  const { product_id, quantity_sold, price_per_unit, farm_id, sale_date } = req.body;

  if (!product_id || !quantity_sold || !price_per_unit || !farm_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Verify farm access
    const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
    if (!hasAccess) {
      throw new Error('Farm access denied');
    }

    // Verify product exists and get its details
    const product = await DatabaseService.getProductById(product_id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if enough quantity is available
    if (product.quantity < parseInt(quantity_sold)) {
      return res.status(400).json({ 
        error: `Insufficient quantity. Available: ${product.quantity}, Requested: ${quantity_sold}` 
      });
    }

    // Calculate profit per unit: selling price - unit cost
    // Note: batch expense per unit not available in current schema
    const costPerUnit = product.unit_price;
    const profitPerUnit = parseFloat(price_per_unit) - costPerUnit;
    const totalProfit = profitPerUnit * parseInt(quantity_sold);

    const saleData = {
      farm_id,
      product_id,
      quantity_sold: parseInt(quantity_sold),
      price_per_unit: parseFloat(price_per_unit),
      sale_date: sale_date ? new Date(sale_date) : new Date(),
      profit: Number(totalProfit.toFixed(2)),
      created_by: req.user.userId
    };

    // Update product quantity and status
    const newQuantity = product.quantity - parseInt(quantity_sold);
    const updateData = {
      quantity: newQuantity,
      status: newQuantity === 0 ? 'sold' : product.status,
      total_price: Number((newQuantity * product.unit_price).toFixed(2))
    };

    await DatabaseService.updateProduct(product_id, updateData);

    const created = await DatabaseService.createSale(saleData);

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating sale:', error);
    if (error.message === 'Farm access denied') {
      return res.status(403).json({ error: 'Access denied to this farm' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// Get sales by farm - GET /sales/farm/:farm_id
router.get('/sales/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;
  const { start_date, end_date, product_id } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  try {
    // Verify farm access
    const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
    if (!hasAccess) {
      throw new Error('Farm access denied');
    }

    const filters = {};
    
    if (product_id) {
      filters.product_id = product_id;
    }

    // Add date range filter if provided
    if (start_date) {
      filters.start_date = start_date;
    }
    if (end_date) {
      filters.end_date = end_date;
    }

    const salesList = await DatabaseService.getSalesByFarmWithFilters(farm_id, filters);
    
    // Note: Batch name population removed since sales table doesn't use product_batch_id
    
    res.json(salesList);
  } catch (error) {
    console.error('Error fetching sales:', error);
    if (error.message === 'Farm access denied') {
      return res.status(403).json({ error: 'Access denied to this farm' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// Reverse sale - POST /sales/:id/reverse
router.post('/sales/:id/reverse', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Find the sale
    const sale = await DatabaseService.getSaleById(id);
    
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    // Verify farm access
    const hasAccess = await DatabaseService.verifyFarmOwnership(sale.farm_id, req.user.userId);
    if (!hasAccess) {
      throw new Error('Farm access denied');
    }

    // Find the product
    const product = await DatabaseService.getProductById(sale.product_id);
    
    if (!product) {
      return res.status(404).json({ 
        error: 'Product not found. It may have been deleted.' 
      });
    }

    // Restore product quantity (coerce to numbers and ensure integer)
    const productQty = typeof product.quantity === 'string'
      ? parseFloat(product.quantity)
      : Number(product.quantity);

    const saleQtyRaw = (sale.quantity_sold !== undefined && sale.quantity_sold !== null)
      ? sale.quantity_sold
      : sale.quantity; // fallback to raw column name

    const saleQty = typeof saleQtyRaw === 'string'
      ? parseFloat(saleQtyRaw)
      : Number(saleQtyRaw);

    const restoredQuantityNumeric = (Number.isFinite(productQty) ? productQty : 0) + (Number.isFinite(saleQty) ? saleQty : 0);
    const restoredQuantity = Math.round(restoredQuantityNumeric);

    const unitPrice = typeof product.unit_price === 'string'
      ? parseFloat(product.unit_price)
      : Number(product.unit_price);

    const updateData = {
      quantity: restoredQuantity,
      status: 'unsold', // Always set back to unsold when reversing
      total_price: Number((restoredQuantity * unitPrice).toFixed(2))
    };

    await DatabaseService.updateProduct(sale.product_id, updateData);

    // Delete the sale record
    await DatabaseService.deleteSale(id);

    res.json({ 
      message: 'Sale reversed successfully',
      product_id: product.id.toString(),
      restored_quantity: restoredQuantity,
      new_status: 'unsold'
    });
  } catch (error) {
    console.error('Error reversing sale:', error);
    if (error.message === 'Farm access denied') {
      return res.status(403).json({ error: 'Access denied to this farm' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Commerce API is running',
    endpoints: ['cart', 'orders', 'sales']
  });
});

// Export the router
module.exports = router;