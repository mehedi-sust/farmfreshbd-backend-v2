const { query, transaction } = require('../config/database');

/**
 * Database Service Layer for PostgreSQL operations
 * Provides abstraction for common database operations
 */
class DatabaseService {
  // =========================
  // Orders - Service Methods
  // =========================
  static normalizeIncomingStatus(statusRaw) {
    if (!statusRaw) return null;
    const s = String(statusRaw).toLowerCase();
    // Accept aliases used by frontend
    if (s === 'on-transit') return 'in_transit';
    return s;
  }

  static mapToDbStatus(frontendStatus) {
    // Map frontend statuses to DB-allowed statuses
    const s = DatabaseService.normalizeIncomingStatus(frontendStatus);
    switch (s) {
      case 'waiting_for_payment':
        return 'pending';
      case 'in_transit':
        return 'shipped';
      default:
        // pass-through for valid ones
        return s;
    }
  }

  static presentStatus(orderRow) {
    if (!orderRow) return null;
    const base = String(orderRow.status || '').toLowerCase();
    if (base === 'shipped') return 'in_transit';
    if (base === 'pending') {
      const payStatus = String(orderRow.payment_status || '').toLowerCase();
      // Show waiting_for_payment only when metadata includes payment_info
      if (payStatus === 'pending') {
        const meta = DatabaseService.extractMetaFromNotes(orderRow.notes);
        const hasPaymentInfo = meta && typeof meta.payment_info === 'string' && meta.payment_info.trim().length > 0;
        if (hasPaymentInfo) return 'waiting_for_payment';
        return 'pending';
      }
    }
    return base;
  }

  static extractMetaFromNotes(notes) {
    if (!notes) return {};
    try {
      const obj = typeof notes === 'string' ? JSON.parse(notes) : notes;
      if (obj && typeof obj === 'object') return obj;
      return {};
    } catch {
      // Fallback: simple key=value; lines (legacy)
      return {};
    }
  }

  static mergeMetaToNotes(existingNotes, meta) {
    const current = DatabaseService.extractMetaFromNotes(existingNotes);
    const merged = { ...current, ...meta };
    return JSON.stringify(merged);
  }

  static async getOrderItemsDetailed(orderId) {
    const result = await query(
      `SELECT 
         oi.id AS _id,
         oi.order_id,
         oi.store_product_id,
         oi.quantity,
         oi.unit_price AS price,
         oi.total_price AS total,
         sp.id AS store_product_id_alias,
         p.id AS product_id,
         COALESCE(p.name, 'Unknown Product') AS product_name,
         p.product_type AS product_type,
         pc.name AS category,
         p.unit,
         f.id AS farm_id,
         f.name AS farm_name
       FROM order_items oi
       JOIN store_products sp ON oi.store_product_id = sp.id
       JOIN products p ON sp.product_id = p.id
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       LEFT JOIN farms f ON p.farm_id = f.id
       WHERE oi.order_id = $1
       ORDER BY oi.created_at ASC`,
      [orderId]
    );
    return result.rows;
  }

  static async placeOrder(userId, payload) {
    const {
      items,
      customer_phone,
      delivery_address,
      notes,
      delivery_fee,
      temp_cart_id
    } = payload || {};

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required');
    }

    // Validate and prepare items
    const preparedItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const { store_product_id, quantity } = item || {};
      if (!store_product_id || !quantity || Number(quantity) <= 0) {
        throw new Error('Each item must have store_product_id and positive quantity');
      }

      const sp = await DatabaseService.getStoreProductById(store_product_id);
      if (!sp) {
        throw new Error('Store product not found');
      }
      if (!sp.is_available) {
        throw new Error(`Product '${sp.product_name}' is not available`);
      }
      const available = Number(sp.store_stock_quantity ?? sp.available_stock ?? 0);
      if (!Number.isFinite(available) || available < Number(quantity)) {
        throw new Error(`Insufficient stock for '${sp.product_name}'. Available: ${available}, Requested: ${quantity}`);
      }

      const unitPrice = Number(sp.price_after_discount ?? sp.store_price ?? 0);
      const qty = Number(quantity);
      const lineTotal = Number((unitPrice * qty).toFixed(2));
      totalAmount += lineTotal;
      preparedItems.push({ store_product_id, quantity: qty, unit_price: unitPrice, total_price: lineTotal });
    }

    const shippingAmount = Number(delivery_fee ?? 0);
    const discountAmount = 0;
    const taxAmount = 0;
    const finalAmount = Number((totalAmount - discountAmount + taxAmount + shippingAmount).toFixed(2));

    const method = 'cash_on_delivery';
    const metaNotes = DatabaseService.mergeMetaToNotes(notes, {
      customer_phone: customer_phone || null,
      temp_cart_id: temp_cart_id || null
    });

    // Transaction: create order, items, and adjust stock
    const createdOrder = await transaction(async (client) => {
      const insertOrderRes = await client.query(
        `INSERT INTO orders (
           customer_id, status, total_amount, discount_amount, tax_amount, shipping_amount,
           final_amount, payment_status, payment_method, shipping_address, notes
         ) VALUES (
           $1, 'pending', $2, $3, $4, $5,
           $6, 'pending', $7, $8, $9
         ) RETURNING *`,
        [userId, totalAmount, discountAmount, taxAmount, shippingAmount, finalAmount, method, delivery_address, metaNotes]
      );
      const orderRow = insertOrderRes.rows[0];

      for (const pi of preparedItems) {
        // Insert order item
        await client.query(
          `INSERT INTO order_items (order_id, store_product_id, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [orderRow.id, pi.store_product_id, pi.quantity, pi.unit_price, pi.total_price]
        );
        // Deduct stock
        await client.query(
          `UPDATE store_products SET stock_quantity = stock_quantity - $2 WHERE id = $1`,
          [pi.store_product_id, pi.quantity]
        );
      }

      return orderRow;
    });

    // Build response with items_details
    const itemsDetails = await DatabaseService.getOrderItemsDetailed(createdOrder.id);
    const meta = DatabaseService.extractMetaFromNotes(createdOrder.notes);
    const statusForUi = DatabaseService.presentStatus(createdOrder);

    return {
      _id: createdOrder.id,
      order_number: createdOrder.order_number,
      status: statusForUi,
      total_amount: Number(createdOrder.total_amount),
      discount_amount: Number(createdOrder.discount_amount),
      tax_amount: Number(createdOrder.tax_amount),
      delivery_fee: Number(createdOrder.shipping_amount),
      final_amount: Number(createdOrder.final_amount),
      payment_status: createdOrder.payment_status,
      payment_method: createdOrder.payment_method,
      customer_phone: meta.customer_phone || null,
      delivery_address: createdOrder.shipping_address,
      created_at: createdOrder.created_at,
      updated_at: createdOrder.updated_at,
      items_details: itemsDetails
    };
  }

  static async getUserOrders(userId, { status, page = 1, limit = 10 } = {}) {
    const offset = (Number(page) - 1) * Number(limit);
    const where = ['o.customer_id = $1'];
    const params = [userId];

    if (status && String(status).toLowerCase() !== 'all') {
      const normalized = DatabaseService.normalizeIncomingStatus(status);
      if (normalized === 'waiting_for_payment') {
        where.push("o.status = 'pending' AND o.payment_status = 'pending' AND o.notes LIKE '%\"payment_info\":%'");
      } else if (normalized === 'in_transit') {
        where.push("o.status = 'shipped'");
      } else {
        where.push('o.status = $' + (params.length + 1));
        params.push(DatabaseService.mapToDbStatus(normalized));
      }
    }

    params.push(limit);
    params.push(offset);

    const countRes = await query(
      `SELECT COUNT(*) AS count FROM orders o WHERE ${where.join(' AND ')}`,
      params.slice(0, params.length - 2)
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const listRes = await query(
      `SELECT 
         o.id AS _id,
         o.order_number,
         o.status,
         o.total_amount,
         o.discount_amount,
         o.tax_amount,
         o.shipping_amount AS delivery_fee,
         o.final_amount,
         o.payment_status,
         o.payment_method,
         o.shipping_address AS delivery_address,
         o.created_at,
         o.updated_at,
         o.notes,
         u.email AS customer_email,
         COALESCE(NULLIF(CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,'')), ' '), u.email) AS customer_name,
         u.phone AS customer_phone
       FROM orders o
       JOIN users u ON o.customer_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY o.order_date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const orders = [];
    for (const row of listRes.rows) {
      const items = await DatabaseService.getOrderItemsDetailed(row._id);
      const statusUi = DatabaseService.presentStatus(row);
      const meta = DatabaseService.extractMetaFromNotes(row.notes);
      orders.push({
        ...row,
        status: statusUi,
        payment_info: meta?.payment_info || null,
        payment_message: meta?.payment_message || null,
        customer_phone: row.customer_phone || meta?.customer_phone || null,
        items_details: items
      });
    }

    return {
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)) || 0,
        totalOrders: total,
        ordersPerPage: Number(limit)
      }
    };
  }

  static async findOrderByTempCartId(tempCartId) {
    if (!tempCartId) return null;
    
    const orderRes = await query(
      `SELECT 
         o.id AS _id,
         o.order_number,
         o.status,
         o.notes,
         o.created_at
       FROM orders o
       WHERE o.notes LIKE $1`,
      [`%"temp_cart_id":"${tempCartId}"%`]
    );
    
    const row = orderRes.rows[0];
    if (!row) return null;
    
    // Verify the temp_cart_id is actually in the metadata
    try {
      const meta = DatabaseService.extractMetaFromNotes(row.notes);
      if (meta && meta.temp_cart_id === tempCartId) {
        return row;
      }
    } catch (error) {
      console.error('Error parsing order notes for temp_cart_id:', error);
    }
    
    return null;
  }

  static async getOrderById(orderId) {
    const orderRes = await query(
      `SELECT 
         o.id AS _id,
         o.order_number,
         o.status,
         o.total_amount,
         o.discount_amount,
         o.tax_amount,
         o.shipping_amount AS delivery_fee,
         o.final_amount,
         o.payment_status,
         o.payment_method,
         o.shipping_address AS delivery_address,
         o.created_at,
         o.updated_at,
         o.notes,
       u.email AS customer_email,
        COALESCE(NULLIF(CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,'')), ' '), u.email) AS customer_name,
        u.phone AS customer_phone
       FROM orders o
       JOIN users u ON o.customer_id = u.id
       WHERE o.id = $1`,
      [orderId]
    );
    const row = orderRes.rows[0];
    if (!row) return null;
    const items = await DatabaseService.getOrderItemsDetailed(row._id);
    const statusUi = DatabaseService.presentStatus(row);
    const meta = DatabaseService.extractMetaFromNotes(row.notes);
    return {
      ...row,
      status: statusUi,
      payment_info: meta?.payment_info || null,
      payment_message: meta?.payment_message || null,
      customer_phone: row.customer_phone || meta?.customer_phone || null,
      items_details: items
    };
  }

  static async getFarmOrders(farmId, { status, page = 1, limit = 10 } = {}) {
    const offset = (Number(page) - 1) * Number(limit);
    // Orders that include items from a given farm
    const where = [
      `EXISTS (
         SELECT 1 FROM order_items oi
         JOIN store_products sp ON oi.store_product_id = sp.id
         JOIN products p ON sp.product_id = p.id
         WHERE oi.order_id = o.id AND p.farm_id = $1
       )`
    ];
    const params = [farmId];

    if (status && String(status).toLowerCase() !== 'all') {
      const normalized = DatabaseService.normalizeIncomingStatus(status);
      if (normalized === 'waiting_for_payment') {
        where.push("o.status = 'pending' AND o.payment_status = 'pending' AND o.notes LIKE '%\"payment_info\":%'");
      } else if (normalized === 'in_transit') {
        where.push("o.status = 'shipped'");
      } else {
        where.push('o.status = $' + (params.length + 1));
        params.push(DatabaseService.mapToDbStatus(normalized));
      }
    }

    params.push(limit);
    params.push(offset);

    const countRes = await query(
      `SELECT COUNT(*) AS count FROM orders o WHERE ${where.join(' AND ')}`,
      params.slice(0, params.length - 2)
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const listRes = await query(
      `SELECT 
         o.id AS _id,
         o.order_number,
         o.status,
         o.total_amount,
         o.discount_amount,
         o.tax_amount,
         o.shipping_amount AS delivery_fee,
         o.final_amount,
         o.payment_status,
         o.payment_method,
         o.shipping_address AS delivery_address,
         o.created_at,
         o.updated_at,
         o.notes,
         u.email AS customer_email,
         u.phone AS customer_phone
       FROM orders o
       JOIN users u ON o.customer_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY o.order_date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const orders = [];
    for (const row of listRes.rows) {
      const items = await DatabaseService.getOrderItemsDetailed(row._id);
      const statusUi = DatabaseService.presentStatus(row);
      const meta = DatabaseService.extractMetaFromNotes(row.notes);
      orders.push({
        ...row,
        status: statusUi,
        payment_info: meta?.payment_info || null,
        payment_message: meta?.payment_message || null,
        customer_phone: row.customer_phone || meta?.customer_phone || null,
        items_details: items
      });
    }

    return {
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)) || 0,
        totalOrders: total,
        ordersPerPage: Number(limit)
      }
    };
  }

  static async updateOrderStatus(orderId, userId, status, extras = {}) {
    const normalized = DatabaseService.normalizeIncomingStatus(status);
    if (!normalized) throw new Error('Status is required');
    const validStatuses = ['pending', 'confirmed', 'waiting_for_payment', 'processing', 'in_transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(normalized)) {
      throw new Error('Invalid status');
    }

    // Get order and derive farm for permission
    const existing = await DatabaseService.getOrderById(orderId);
    if (!existing) throw new Error('Order not found');
    // Use first item to derive farm (assumption: single-farm orders)
    const farmId = existing.items_details[0]?.farm_id || null;
    if (farmId) {
      const hasAccess = await DatabaseService.verifyFarmOwnership(farmId, userId);
      if (!hasAccess) throw new Error('Access denied to this farm');
    }

    const dbStatus = DatabaseService.mapToDbStatus(normalized);

    // Update notes metadata if provided
    const meta = {};
    if (extras.courier_contact) meta.courier_contact = String(extras.courier_contact);
    if (extras.courier_ref_id) meta.courier_ref_id = String(extras.courier_ref_id);
    // Store payment details in notes for per-order disputes/history
    if (extras.payment_info) meta.payment_info = String(extras.payment_info);
    if (extras.payment_message) meta.payment_message = String(extras.payment_message);
    if (extras.payment_reference) meta.payment_reference = String(extras.payment_reference);

    // Optionally update delivery fee
    let shippingAmountDelta = null;
    if (extras.delivery_fee !== undefined && extras.delivery_fee !== null) {
      shippingAmountDelta = Number(extras.delivery_fee);
      if (!Number.isFinite(shippingAmountDelta) || shippingAmountDelta < 0) {
        throw new Error('Invalid delivery_fee');
      }
    }

    const updated = await transaction(async (client) => {
      // Load raw row to compute new final amount if delivery fee provided
      const currRes = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
      const curr = currRes.rows[0];
      if (!curr) throw new Error('Order not found');

      const newShipping = shippingAmountDelta !== null ? shippingAmountDelta : Number(curr.shipping_amount || 0);
      const newFinal = Number((Number(curr.total_amount) - Number(curr.discount_amount) + Number(curr.tax_amount) + newShipping).toFixed(2));

      const newNotes = Object.keys(meta).length > 0 ? DatabaseService.mergeMetaToNotes(curr.notes, meta) : curr.notes;

      // Build parameterized update deterministically to avoid index mismatches
      const setPieces = [];
      const params = [];
      let idx = 1;

      // Always update top-level status
      setPieces.push(`status = $${idx}`);
      params.push(dbStatus); idx++;

      // When waiting_for_payment, mark payment_status and optionally payment_method
      if (normalized === 'waiting_for_payment') {
        setPieces.push(`payment_status = $${idx}`);
        params.push('pending'); idx++;
        if (extras.payment_method) {
          setPieces.push(`payment_method = $${idx}`);
          params.push(String(extras.payment_method)); idx++;
        }
      }

      // Optional shipping amount and final total
      if (shippingAmountDelta !== null) {
        setPieces.push(`shipping_amount = $${idx}`);
        params.push(newShipping); idx++;
      }
      setPieces.push(`final_amount = $${idx}`);
      params.push(newFinal); idx++;

      // Notes metadata (JSON string)
      setPieces.push(`notes = $${idx}`);
      params.push(newNotes); idx++;

      // Timestamp
      setPieces.push('updated_at = CURRENT_TIMESTAMP');

      const updateSql = `UPDATE orders SET ${setPieces.join(', ')} WHERE id = $${idx} RETURNING *`;
      params.push(orderId);
      const updRes = await client.query(updateSql, params);
      return updRes.rows[0];
    });

    const presented = DatabaseService.presentStatus(updated);
    const items = await DatabaseService.getOrderItemsDetailed(updated.id);
    return {
      _id: updated.id,
      order_number: updated.order_number,
      status: presented,
      total_amount: Number(updated.total_amount),
      discount_amount: Number(updated.discount_amount),
      tax_amount: Number(updated.tax_amount),
      delivery_fee: Number(updated.shipping_amount),
      final_amount: Number(updated.final_amount),
      payment_status: updated.payment_status,
      payment_method: updated.payment_method,
      delivery_address: updated.shipping_address,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      items_details: items
    };
  }

  static async setOrderDeliveryFee(orderId, userId, fee) {
    const deliveryFee = Number(fee);
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
      throw new Error('Invalid delivery_fee');
    }
    const existing = await DatabaseService.getOrderById(orderId);
    if (!existing) throw new Error('Order not found');
    const farmId = existing.items_details[0]?.farm_id || null;
    if (farmId) {
      const hasAccess = await DatabaseService.verifyFarmOwnership(farmId, userId);
      if (!hasAccess) throw new Error('Access denied to this farm');
    }

    const updated = await transaction(async (client) => {
      const currRes = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
      const curr = currRes.rows[0];
      if (!curr) throw new Error('Order not found');
      const newFinal = Number((Number(curr.total_amount) - Number(curr.discount_amount) + Number(curr.tax_amount) + deliveryFee).toFixed(2));
      const updRes = await client.query(
        `UPDATE orders SET shipping_amount = $1, final_amount = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
        [deliveryFee, newFinal, orderId]
      );
      return updRes.rows[0];
    });

    const items = await DatabaseService.getOrderItemsDetailed(updated.id);
    const statusUi = DatabaseService.presentStatus(updated);
    return {
      _id: updated.id,
      order_number: updated.order_number,
      status: statusUi,
      total_amount: Number(updated.total_amount),
      discount_amount: Number(updated.discount_amount),
      tax_amount: Number(updated.tax_amount),
      delivery_fee: Number(updated.shipping_amount),
      final_amount: Number(updated.final_amount),
      payment_status: updated.payment_status,
      payment_method: updated.payment_method,
      delivery_address: updated.shipping_address,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      items_details: items
    };
  }

  static async cancelOrder(orderId, userId, reason) {
    const existing = await DatabaseService.getOrderById(orderId);
    if (!existing) throw new Error('Order not found');

    // Access: customer or farm manager or admin
    const rawRes = await query('SELECT customer_id, status, notes FROM orders WHERE id = $1', [orderId]);
    const raw = rawRes.rows[0];
    if (!raw) throw new Error('Order not found');

    // Only allow cancellation in pending/confirmed
    const currStatus = String(raw.status || '').toLowerCase();
    if (!(currStatus === 'pending' || currStatus === 'confirmed')) {
      throw new Error('Only pending or confirmed orders can be cancelled');
    }

    // Verify farm access for managers
    const farmId = existing.items_details[0]?.farm_id || null;
    let hasFarmAccess = false;
    if (farmId) {
      hasFarmAccess = await DatabaseService.verifyFarmOwnership(farmId, userId);
    }

    // Either customer (same user) or farm manager can cancel
    if (String(raw.customer_id) !== String(userId) && !hasFarmAccess) {
      throw new Error('Access denied');
    }

    const metaReason = reason || 'Cancelled by user';

    const updated = await transaction(async (client) => {
      // Set status and reason
      const currRes = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
      const curr = currRes.rows[0];
      const newNotes = DatabaseService.mergeMetaToNotes(curr.notes, { cancellation_reason: metaReason });
      const updRes = await client.query(
        `UPDATE orders SET status = 'cancelled', notes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [newNotes, orderId]
      );

      // Restore stock quantities
      const items = await client.query(
        `SELECT store_product_id, quantity FROM order_items WHERE order_id = $1`,
        [orderId]
      );
      for (const it of items.rows) {
        await client.query(
          `UPDATE store_products SET stock_quantity = stock_quantity + $2 WHERE id = $1`,
          [it.store_product_id, it.quantity]
        );
      }

      return updRes.rows[0];
    });

    const items = await DatabaseService.getOrderItemsDetailed(orderId);
    const statusUi = DatabaseService.presentStatus(updated);
    const meta = DatabaseService.extractMetaFromNotes(updated.notes);
    return {
      _id: updated.id,
      order_number: updated.order_number,
      status: statusUi,
      total_amount: Number(updated.total_amount),
      discount_amount: Number(updated.discount_amount),
      tax_amount: Number(updated.tax_amount),
      delivery_fee: Number(updated.shipping_amount),
      final_amount: Number(updated.final_amount),
      payment_status: updated.payment_status,
      payment_method: updated.payment_method,
      delivery_address: updated.shipping_address,
      cancellation_reason: meta.cancellation_reason || null,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      items_details: items
    };
  }
  // Ensure default expense types exist
  static async ensureDefaultExpenseTypes() {
    // Determine which defaults are missing by name
    const defaults = [
      { name: 'Feed', description: 'Animal feed and nutrition costs', category: 'materials' },
      { name: 'Medicine', description: 'Veterinary medicines and treatments', category: 'operational' },
      { name: 'Vaccine', description: 'Vaccination and immunization costs', category: 'operational' },
      { name: 'Other', description: 'Other miscellaneous expenses', category: 'other' }
    ];

    const names = defaults.map(d => d.name.toLowerCase());
    const existing = await query(
      `SELECT LOWER(name) AS name FROM expense_types WHERE LOWER(name) = ANY($1::text[])`,
      [names]
    );
    const existingNames = new Set(existing.rows.map(r => r.name));

    const missing = defaults.filter(d => !existingNames.has(d.name.toLowerCase()));

    if (missing.length === 0) {
      return false; // Defaults already present
    }

    for (const d of missing) {
      await query(
        `INSERT INTO expense_types (name, description, category, is_active, created_at)
         VALUES ($1, $2, $3, true, NOW())`,
        [d.name, d.description, d.category]
      );
    }
    return true; // Defaults inserted
  }
  
  // User operations
  static async createUser(userData) {
    const { name, email, password_hash, phone, role = 'farmer' } = userData;
    
    // Split name into first_name and last_name
    let first_name = '';
    let last_name = '';
    if (name) {
      const nameParts = name.trim().split(' ');
      first_name = nameParts[0] || '';
      last_name = nameParts.slice(1).join(' ') || '';
    }
    
    const result = await query(
      `INSERT INTO users (first_name, last_name, email, password_hash, phone, role) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [first_name, last_name, email, password_hash, phone, role]
    );
    return result.rows[0];
  }

  static async getUserByEmail(email) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  static async getUserById(id) {
    const result = await query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async updateUser(id, userData) {
    const fields = Object.keys(userData);
    const values = Object.values(userData);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    
    // Only add updated_at if it's not already in userData
    const hasUpdatedAt = fields.includes('updated_at');
    const finalSetClause = hasUpdatedAt ? setClause : `${setClause}, updated_at = CURRENT_TIMESTAMP`;
    
    const result = await query(
      `UPDATE users SET ${finalSetClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0];
  }

  // Farm operations
  static async createFarm(farmData) {
    const { 
      name, 
      type, 
      description, 
      location, 
      address, 
      contact_number, 
      phone,
      bio, 
      build_year, 
      banner_image, 
      email,
      website,
      owner_id,
      manager_id
    } = farmData;
    
    const result = await query(
      `INSERT INTO farms (name, type, description, location, address, phone, email, website, banner_image, build_year, owner_id, manager_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *`,
      [name, type || 'mixed', description || bio, location, address, contact_number || phone, email, website, banner_image, build_year, owner_id, manager_id]
    );
    return result.rows[0];
  }

  static async getFarmById(id) {
    const result = await query(
      'SELECT * FROM farms WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async getFarmsByOwnerId(ownerId) {
    const result = await query(
      'SELECT * FROM farms WHERE owner_id = $1 ORDER BY created_at DESC',
      [ownerId]
    );
    return result.rows;
  }

  static async getFarmByOwnerId(ownerId) {
    const result = await query(
      'SELECT * FROM farms WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1',
      [ownerId]
    );
    return result.rows[0];
  }

  static async getAllFarms() {
    const result = await query(
      'SELECT * FROM farms ORDER BY created_at DESC',
      []
    );
    return result.rows;
  }

  static async updateFarm(id, farmData) {
    const fields = Object.keys(farmData);
    const values = Object.values(farmData);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    
    const result = await query(
      `UPDATE farms SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0];
  }

  // Product operations
  static async createProduct(productData) {
    const { name, description, category_id, unit, farm_id } = productData;
    const result = await query(
      `INSERT INTO products (name, description, category_id, unit, farm_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [name, description, category_id, unit, farm_id]
    );
    return result.rows[0];
  }

  static async getProductsByFarmId(farmId) {
    const result = await query(
      `SELECT p.* 
       FROM products p 
       WHERE p.farm_id = $1 
       ORDER BY p.created_at DESC`,
      [farmId]
    );
    return result.rows;
  }

  static async getProductById(id) {
    const result = await query(
      `SELECT p.* 
       FROM products p 
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async deleteProduct(id) {
    const result = await query(
      'DELETE FROM products WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  static async updateProductStatus(id, status) {
    const validStatuses = ['sold', 'unsold'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    const result = await query(
      'UPDATE products SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0];
  }

  // Get products grouped by batch name
  static async getProductsGroupedByBatch(farmId) {
    const result = await query(
      `SELECT 
        COALESCE(p.batch_name, 'No Batch') as batch_name,
        COUNT(p.id) as product_count,
        SUM(p.quantity) as total_quantity,
        SUM(p.total_price) as total_value,
        AVG(p.unit_price) as avg_unit_price,
        MIN(p.unit_price) as min_unit_price,
        MAX(p.unit_price) as max_unit_price,
        array_agg(
          json_build_object(
            'id', p.id,
            'name', p.name,
            'description', p.description,
            'quantity', p.quantity,
            'total_price', p.total_price,
            'unit_price', p.unit_price,
            'unit', p.unit,
            'product_type', p.product_type,
            'status', p.status,
            'batch_name', p.batch_name,
            'created_at', p.created_at
          ) ORDER BY p.created_at DESC
        ) as products
      FROM products p
      WHERE p.farm_id = $1
      GROUP BY COALESCE(p.batch_name, 'No Batch')
      ORDER BY batch_name`,
      [farmId]
    );
    return result.rows;
  }

  // Get product batches by farm with filters
  static async getProductBatchesByFarmWithFilters(farmId, filters = {}) {
    let queryStr = `
      SELECT pb.*, p.name as product_name
      FROM product_batches pb
      LEFT JOIN products p ON pb.product_id = p.id
      WHERE pb.farm_id = $1
    `;
    const params = [farmId];
    let paramIndex = 2;

    if (filters.product_id) {
      queryStr += ` AND pb.product_id = $${paramIndex}`;
      params.push(filters.product_id);
      paramIndex++;
    }

    if (filters.status) {
      queryStr += ` AND pb.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    queryStr += ' ORDER BY pb.created_at DESC';

    if (filters.limit) {
      queryStr += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    if (filters.skip) {
      queryStr += ` OFFSET $${paramIndex}`;
      params.push(filters.skip);
    }

    const result = await query(queryStr, params);
    return result.rows;
  }

  // Get store products by farm with filters
  static async getStoreProductsByFarm(farmId, filters = {}) {
    let queryStr = `
      SELECT 
        sp.id AS _id,
        sp.product_id,
        p.farm_id AS farm_id,
        sp.store_price,
        sp.store_price AS price,
        sp.stock_quantity AS store_stock_quantity,
        sp.stock_quantity AS available_stock,
        sp.stock_quantity AS stock,
        sp.is_featured,
        sp.discount_percentage,
        sp.is_available,
        sp.discount_description,
        sp.product_image_url,
        sp.created_at,
        sp.updated_at,
        COALESCE(p.name, 'Unknown Product') AS product_name,
        sp.description AS store_description,
        p.description AS product_description,
        COALESCE(sp.description, p.description) AS description,
        p.unit,
        p.product_type,
        p.quantity AS product_quantity,
        NULL AS base_product_image_url,
        pc.name AS category,
        f.name AS farm_name,
        f.location AS farm_location,
        f.address AS farm_address,
        CASE 
          WHEN COALESCE(sp.discount_percentage, 0) > 0 
          THEN sp.store_price * (1 - sp.discount_percentage / 100.0)
          ELSE sp.store_price
        END AS price_after_discount
      FROM store_products sp
      JOIN products p ON sp.product_id = p.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN farms f ON p.farm_id = f.id
      WHERE p.farm_id = $1
    `;
    const params = [farmId];
    let paramIndex = 2;

    // Note: products table does not have a 'category' column in v2 schema.
    // If category filtering is needed, map client categories to product_type here.
    // For now, ignore category filter to avoid invalid column references.

    if (filters.available_only) {
      // Align with v2 schema: use stock_quantity and is_available
      queryStr += ` AND sp.stock_quantity > 0 AND sp.is_available = true`;
    }

    queryStr += ' ORDER BY sp.created_at DESC';

    if (filters.limit) {
      queryStr += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    if (filters.skip) {
      queryStr += ` OFFSET $${paramIndex}`;
      params.push(filters.skip);
    }

    const result = await query(queryStr, params);
    return result.rows;
  }

  // Update store product
  static async updateStoreProduct(storeProductId, updates) {
    const setClause = [];
    const params = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        setClause.push(`${key} = $${paramIndex}`);
        params.push(updates[key]);
        paramIndex++;
      }
    });

    if (setClause.length === 0) {
      throw new Error('No fields to update');
    }

    setClause.push(`updated_at = $${paramIndex}`);
    params.push(new Date());
    params.push(storeProductId);

    const queryStr = `
      UPDATE store_products 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await query(queryStr, params);
    return result.rows[0];
  }

  // Update product
  static async updateProduct(productId, updates) {
    const setClause = [];
    const params = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        setClause.push(`${key} = $${paramIndex}`);
        params.push(updates[key]);
        paramIndex++;
      }
    });

    if (setClause.length === 0) {
      throw new Error('No fields to update');
    }

    setClause.push(`updated_at = $${paramIndex}`);
    params.push(new Date());
    params.push(productId);

    const queryStr = `
      UPDATE products 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await query(queryStr, params);
    return result.rows[0];
  }

  // Delete store product
  static async deleteStoreProduct(storeProductId) {
    const result = await query(
      'DELETE FROM store_products WHERE id = $1 RETURNING id',
      [storeProductId]
    );
    return result.rows.length > 0;
  }

  // Product Batch operations
  static async getProductBatchesByFarmId(farmId) {
    const result = await query(
      `SELECT pb.*, p.name as product_name, p.unit 
       FROM product_batches pb 
       JOIN products p ON pb.product_id = p.id 
       WHERE p.farm_id = $1 
       ORDER BY pb.created_at DESC`,
      [farmId]
    );
    return result.rows;
  }

  static async getProductBatchesByProductId(productId) {
    const result = await query(
      `SELECT pb.*, p.name as product_name, p.unit 
       FROM product_batches pb 
       JOIN products p ON pb.product_id = p.id 
       WHERE pb.product_id = $1 
       ORDER BY pb.created_at DESC`,
      [productId]
    );
    return result.rows;
  }

  // Store Product operations
  static async createStoreProduct(storeProductData) {
    const { product_id, store_price, stock_quantity, is_featured, discount_percentage, is_available, discount_description, product_image_url, description } = storeProductData;
    const result = await query(
      `INSERT INTO store_products (
          product_id, store_price, stock_quantity, is_featured, discount_percentage, is_available,
          discount_description, product_image_url, description
       ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [
        product_id,
        store_price,
        stock_quantity,
        is_featured || false,
        discount_percentage || 0,
        is_available !== undefined ? is_available : true,
        discount_description || null,
        product_image_url || null,
        description || null
      ]
    );
    return result.rows[0];
  }

  static async getStoreProductsByFarmId(farmId) {
    const result = await query(
      `SELECT 
          sp.id AS _id,
          sp.product_id,
          p.farm_id AS farm_id,
          sp.store_price,
          sp.store_price AS price,
          sp.stock_quantity AS store_stock_quantity,
          sp.stock_quantity AS available_stock,
          sp.stock_quantity AS stock,
          sp.is_featured,
          sp.discount_percentage,
          sp.is_available,
          sp.discount_description,
          sp.product_image_url,
          sp.created_at,
          sp.updated_at,
          COALESCE(p.name, 'Unknown Product') AS product_name,
          sp.description AS store_description,
          p.description AS product_description,
          COALESCE(sp.description, p.description) AS description,
          p.unit,
          p.product_type,
          p.quantity AS product_quantity,
          NULL AS base_product_image_url,
          pc.name AS category,
          f.name AS farm_name,
          f.location AS farm_location,
          f.address AS farm_address,
          CASE 
            WHEN COALESCE(sp.discount_percentage, 0) > 0 
            THEN sp.store_price * (1 - sp.discount_percentage / 100.0)
            ELSE sp.store_price
          END AS price_after_discount
       FROM store_products sp 
       JOIN products p ON sp.product_id = p.id 
       LEFT JOIN product_categories pc ON p.category_id = pc.id 
       LEFT JOIN farms f ON p.farm_id = f.id
       WHERE p.farm_id = $1 AND sp.is_available = true 
       ORDER BY sp.created_at DESC`,
      [farmId]
    );
    return result.rows;
  }

  static async getStoreProductById(id) {
    const result = await query(
      `SELECT 
          sp.id AS _id,
          sp.product_id,
          p.farm_id AS farm_id,
          sp.store_price,
          sp.store_price AS price,
          sp.stock_quantity AS store_stock_quantity,
          sp.stock_quantity AS available_stock,
          sp.stock_quantity AS stock,
          sp.is_featured,
          sp.discount_percentage,
          sp.is_available,
          sp.discount_description,
          sp.product_image_url,
          sp.created_at,
          sp.updated_at,
          COALESCE(p.name, 'Unknown Product') AS product_name,
          sp.description AS store_description,
          p.description AS product_description,
          COALESCE(sp.description, p.description) AS description,
          p.unit,
          p.product_type,
          p.quantity AS product_quantity,
          NULL AS base_product_image_url,
          pc.name AS category,
          f.name AS farm_name, 
          f.location AS farm_location, 
          f.address AS farm_address,
          CASE 
            WHEN COALESCE(sp.discount_percentage, 0) > 0 
            THEN sp.store_price * (1 - sp.discount_percentage / 100.0)
            ELSE sp.store_price
          END AS price_after_discount
       FROM store_products sp 
       JOIN products p ON sp.product_id = p.id 
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       LEFT JOIN farms f ON p.farm_id = f.id
       WHERE sp.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  // Get products available for store (allow multiple store products from same base product)
  static async getAvailableProductsForStore(farmId) {
    const result = await query(
      `SELECT p.*,
         COALESCE(
           (SELECT SUM(sp.stock_quantity) 
            FROM store_products sp 
            WHERE sp.product_id = p.id), 0
         ) as total_store_stock,
         (COALESCE(p.quantity, 0) - COALESCE(
           (SELECT SUM(sp.stock_quantity) 
            FROM store_products sp 
            WHERE sp.product_id = p.id), 0
         )) as available_for_store
       FROM products p
       WHERE p.farm_id = $1
         AND COALESCE(p.quantity, 0) > 0
         AND (p.status IS NULL OR p.status <> 'sold')
       ORDER BY p.created_at DESC`,
      [farmId]
    );
    return result.rows;
  }

  // Get store products with filtering and pagination
  static async getStoreProducts({ category, farm_id, skip = 0, limit = 100 }) {
    let queryStr = `
      SELECT 
        sp.id AS _id,
        sp.product_id,
        p.farm_id AS farm_id,
        sp.store_price,
        sp.store_price AS price,
        sp.stock_quantity AS available_stock,
        sp.stock_quantity AS store_stock_quantity,
        sp.stock_quantity AS stock,
        sp.is_featured,
        sp.discount_percentage,
        sp.is_available,
        sp.discount_description,
        sp.product_image_url,
        sp.created_at,
        sp.updated_at,
        COALESCE(p.name, 'Unknown Product') AS product_name,
        sp.description AS store_description,
        p.description AS product_description,
        COALESCE(sp.description, p.description) AS description,
        p.unit,
        p.product_type,
        p.quantity AS product_quantity,
        NULL AS base_product_image_url,
        pc.name AS category,
        f.name AS farm_name,
        f.location AS farm_location,
        f.address AS farm_address,
        CASE 
          WHEN COALESCE(sp.discount_percentage, 0) > 0 
          THEN sp.store_price * (1 - sp.discount_percentage / 100.0)
          ELSE sp.store_price
        END AS price_after_discount
      FROM store_products sp
      LEFT JOIN products p ON sp.product_id = p.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN farms f ON p.farm_id = f.id
      WHERE sp.is_available = true
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (category) {
      queryStr += ` AND pc.name = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    if (farm_id) {
      queryStr += ` AND p.farm_id = $${paramIndex}`;
      params.push(farm_id);
      paramIndex++;
    }
    
    queryStr += ` ORDER BY sp.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, skip);

    const result = await query(queryStr, params);
    return result.rows;
  }

  static async updateStoreProduct(id, storeProductData) {
    const fields = Object.keys(storeProductData);
    const values = Object.values(storeProductData);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    
    const result = await query(
      `UPDATE store_products SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0];
  }

  static async deleteStoreProduct(id) {
    const result = await query(
      'DELETE FROM store_products WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  // Expense Type operations
  static async createExpenseType(expenseTypeData) {
    const { name, description, is_global } = expenseTypeData;
    const result = await query(
      `INSERT INTO expense_types (name, description, is_global) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [name, description, is_global || false]
    );
    return result.rows[0];
  }

  static async getExpenseTypes() {
    const result = await query(
      "SELECT * FROM expense_types WHERE is_active = true ORDER BY name"
    );
    return result.rows;
  }

  static async getExpenseTypesByFarmId(farmId) {
    const result = await query(
      `SELECT * FROM expense_types 
       WHERE is_active = true 
         AND LOWER(name) IN ('feed','medicine','vaccine','other')
       ORDER BY name`
    );
    return result.rows;
  }

  static async updateExpenseType(id, expenseTypeData) {
    const fields = Object.keys(expenseTypeData);
    const values = Object.values(expenseTypeData);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    
    const result = await query(
      `UPDATE expense_types SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0];
  }

  static async deleteExpenseType(id) {
    const result = await query(
      'DELETE FROM expense_types WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  // Product Categories operations
  static async getProductCategories() {
    const result = await query(
      'SELECT * FROM product_categories ORDER BY name'
    );
    return result.rows;
  }

  static async getProductCategoryById(id) {
    const result = await query(
      'SELECT * FROM product_categories WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async getProductCategoryByName(name) {
    const result = await query(
      'SELECT * FROM product_categories WHERE LOWER(name) = LOWER($1)',
      [name]
    );
    return result.rows[0] || null;
  }

  // Batch Names methods (for dropdown)
  static async createBatchName(batchData) {
    const { name, farm_id } = batchData;
    const result = await query(
      `INSERT INTO batch_names (name, farm_id, created_at, updated_at) 
       VALUES ($1, $2, NOW(), NOW()) 
       RETURNING *`,
      [name, farm_id]
    );
    return result.rows[0];
  }

  static async getBatchNamesByFarm(farmId) {
    const result = await query(
      'SELECT * FROM batch_names WHERE farm_id = $1 AND is_active = true ORDER BY created_at DESC',
      [farmId]
    );
    return result.rows;
  }

  // Additional Product Batch methods (for actual inventory)
  static async createProductBatch(batchData) {
    const { 
      product_id, 
      batch_number, 
      quantity, 
      unit_price, 
      production_date, 
      expiry_date, 
      harvest_date,
      quality_grade,
      storage_location,
      notes 
    } = batchData;
    
    const result = await query(
      `INSERT INTO product_batches (
        product_id, 
        batch_number, 
        quantity, 
        unit_price, 
        production_date, 
        expiry_date, 
        harvest_date,
        quality_grade,
        storage_location,
        notes
      ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [product_id, batch_number, quantity, unit_price, production_date, expiry_date, harvest_date, quality_grade, storage_location, notes]
    );
    return result.rows[0];
  }

  static async getProductBatchesByFarm(farmId) {
    const result = await query(
      `SELECT pb.*, p.name as product_name, p.unit 
       FROM product_batches pb 
       JOIN products p ON pb.product_id = p.id 
       WHERE p.farm_id = $1 
       ORDER BY pb.created_at DESC`,
      [farmId]
    );
    return result.rows;
  }

  static async getProductBatchById(id) {
    const result = await query(
      'SELECT * FROM product_batches WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async updateProductBatch(id, updateData) {
    const { quantity, unit_price, production_date, expiry_date, notes } = updateData;
    const result = await query(
      `UPDATE product_batches 
       SET quantity = COALESCE($2, quantity), 
           unit_price = COALESCE($3, unit_price),
           production_date = COALESCE($4, production_date),
           expiry_date = COALESCE($5, expiry_date),
           notes = COALESCE($6, notes),
           updated_at = NOW()
       WHERE id = $1 
       RETURNING *`,
      [id, quantity, unit_price, production_date, expiry_date, notes]
    );
    return result.rows[0] || null;
  }

  static async deleteProductBatch(id) {
    const result = await query(
      'DELETE FROM product_batches WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  static async updateBatchName(id, updateData) {
    const { name, is_active } = updateData;
    const result = await query(
      `UPDATE batch_names 
       SET name = COALESCE($2, name), 
           is_active = COALESCE($3, is_active),
           updated_at = NOW()
       WHERE id = $1 
       RETURNING *`,
      [id, name, is_active]
    );
    return result.rows[0] || null;
  }

  // Product methods
  static async getProducts({ farm_id, product_type, skip = 0, limit = 100, status, batch_name }) {
    let queryStr = `
      SELECT 
        p.*,
        COALESCE(p.batch_name, 'No Batch') as batch_name
      FROM products p
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (farm_id) {
      queryStr += ` AND p.farm_id = $${paramIndex}`;
      params.push(farm_id);
      paramIndex++;
    }
    
    if (product_type) {
      queryStr += ` AND p.product_type = $${paramIndex}`;
      params.push(product_type);
      paramIndex++;
    }
    
    if (status) {
      queryStr += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (batch_name) {
      queryStr += ` AND p.batch_name = $${paramIndex}`;
      params.push(batch_name);
      paramIndex++;
    }
    
    queryStr += ` ORDER BY p.batch_name, p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, skip);
    
    const result = await query(queryStr, params);
    return result.rows;
  }

  static async createProduct(productData) {
    const {
      name,
      description,
      unit = 'piece',
      quantity,
      total_price,
      base_price, // fallback support for legacy payloads
      batch_name,
      product_type = 'others',
      farm_id,
      status = 'unsold'
    } = productData;

    // Normalize and validate numeric fields
    const parsedQuantity = typeof quantity === 'number' ? quantity : parseInt(quantity, 10);
    const rawTotalPrice = total_price ?? base_price;
    const parsedTotalPrice = typeof rawTotalPrice === 'number' ? rawTotalPrice : parseFloat(rawTotalPrice);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      throw new Error('quantity must be a valid positive number');
    }

    if (!Number.isFinite(parsedTotalPrice) || parsedTotalPrice < 0) {
      throw new Error('total_price must be a valid non-negative number');
    }

    const normalizedBatchName = batch_name !== undefined && batch_name !== null
      ? String(batch_name).trim()
      : null;

    if (!normalizedBatchName) {
      throw new Error('batch_name is required');
    }

    // Calculate unit_price from total_price and quantity
    const unit_price = parsedQuantity > 0 ? (parsedTotalPrice / parsedQuantity) : 0;
    // Ensure base_price populated (use provided or fallback to unit_price)
    const normalizedBasePrice = (base_price !== undefined && base_price !== null)
      ? (typeof base_price === 'number' ? base_price : parseFloat(base_price))
      : unit_price;

    // Validate product_type enum
    const validTypes = ['animal', 'fish', 'crop', 'others', 'produce'];
    if (!validTypes.includes(product_type)) {
      throw new Error(`Invalid product_type. Must be one of: ${validTypes.join(', ')}`);
    }

    const result = await query(
      `INSERT INTO products (
        name, description, unit, quantity, total_price, unit_price, base_price,
        batch_name, product_type, farm_id, status,
        created_at, updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING *`,
      [
        name,
        description || '',
        unit,
        parsedQuantity,
        parsedTotalPrice,
        unit_price,
        normalizedBasePrice,
        normalizedBatchName,
        product_type,
        farm_id,
        status
      ]
    );
    return result.rows[0];
  }

  static async getProductById(id) {
    const result = await query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async deleteProduct(id) {
    const result = await query(
      'DELETE FROM products WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  // Additional Expense Type methods
  static async createExpenseType(typeData) {
    const { name, description = '' } = typeData;
    const result = await query(
      `INSERT INTO expense_types (name, description, category, is_active, created_at) 
       VALUES ($1, $2, $3, true, NOW()) 
       RETURNING *`,
      [name.trim(), description, 'other']
    );
    return result.rows[0];
  }

  static async getExpenseTypeByName(name) {
    const result = await query(
      'SELECT * FROM expense_types WHERE LOWER(name) = LOWER($1)',
      [name.trim()]
    );
    return result.rows[0] || null;
  }

  static async getExpenseTypes() {
    const result = await query(
      `SELECT * FROM expense_types 
       WHERE is_active = true 
         AND LOWER(name) IN ('feed','medicine','vaccine','other')
       ORDER BY name`
    );
    return result.rows;
  }

  static async getExpenseTypeById(id) {
    const result = await query(
      'SELECT * FROM expense_types WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async updateExpenseType(id, typeData) {
    const { name, description } = typeData;
    const result = await query(
      `UPDATE expense_types 
       SET name = $1, description = $2, updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [name.trim(), description, id]
    );
    return result.rows[0];
  }

  static async deleteExpenseType(id) {
    const result = await query(
      'DELETE FROM expense_types WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  static async getExpenseCountByType(expenseTypeId) {
    const result = await query(
      'SELECT COUNT(*) as count FROM expenses WHERE expense_type_id = $1',
      [expenseTypeId]
    );
    return parseInt(result.rows[0].count);
  }

  // Utility functions
  static async verifyFarmOwnership(farmId, userId) {
    const result = await query(
      'SELECT id FROM farms WHERE id = $1 AND owner_id = $2',
      [farmId, userId]
    );
    return result.rows.length > 0;
  }

  static async checkStoreProductExists(productId, farmId) {
    const result = await query(
      'SELECT id FROM store_products WHERE product_id = $1',
      [productId]
    );
    return result.rows[0];
  }

  static async productExists(productId) {
    const result = await query(
      'SELECT id FROM products WHERE id = $1',
      [productId]
    );
    return result.rows.length > 0;
  }

  // Admin methods
  static async getUsersCount() {
    const result = await query('SELECT COUNT(*) as count FROM users');
    return parseInt(result.rows[0].count);
  }

  static async getFarmsCount() {
    const result = await query('SELECT COUNT(*) as count FROM farms');
    return parseInt(result.rows[0].count);
  }

  static async getProductsCount() {
    const result = await query('SELECT COUNT(*) as count FROM products');
    return parseInt(result.rows[0].count);
  }

  static async getOrdersCount() {
    const result = await query('SELECT COUNT(*) as count FROM orders');
    return parseInt(result.rows[0].count);
  }

  static async getStoreProductsCount() {
    const result = await query('SELECT COUNT(*) as count FROM store_products');
    return parseInt(result.rows[0].count);
  }

  static async getUsersByRole() {
    const result = await query(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role
    `);
    
    const roleMap = {
      admin: 0,
      farmer: 0,
      farm_manager: 0,
      customer: 0,
      service_provider: 0
    };

    result.rows.forEach(row => {
      if (roleMap.hasOwnProperty(row.role)) {
        roleMap[row.role] = parseInt(row.count);
      }
    });

    return roleMap;
  }

  static async getRecentUsers(limit = 5) {
    const result = await query(`
      SELECT id, name, email, role, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT $1
    `, [limit]);
    return result.rows;
  }

  static async getRecentOrders(limit = 5) {
    const result = await query(`
      SELECT id, user_id, total_amount, status, created_at 
      FROM orders 
      ORDER BY created_at DESC 
      LIMIT $1
    `, [limit]);
    return result.rows;
  }

  static async getUsers({ page = 1, limit = 10, search = '' }) {
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let params = [limit, offset];
    
    if (search) {
      whereClause = 'WHERE email ILIKE $3 OR role ILIKE $3';
      params.push(`%${search}%`);
    }

    const countResult = await query(`
      SELECT COUNT(*) as count FROM users ${whereClause}
    `, search ? [`%${search}%`] : []);
    
    const totalUsers = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalUsers / limit);

    const result = await query(`
      SELECT id, name, email, role, created_at 
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `, params);

    return {
      users: result.rows,
      totalUsers,
      totalPages
    };
  }

  static async deleteUser(userId) {
    await query('DELETE FROM users WHERE id = $1', [userId]);
  }

  static async getFarms({ page = 1, limit = 10, search = '' }) {
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let params = [limit, offset];
    
    if (search) {
      whereClause = 'WHERE name ILIKE $3 OR description ILIKE $3';
      params.push(`%${search}%`);
    }

    const countResult = await query(`
      SELECT COUNT(*) as count FROM farms ${whereClause}
    `, search ? [`%${search}%`] : []);
    
    const totalFarms = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalFarms / limit);

    const result = await query(`
      SELECT f.*, u.name as owner_name 
      FROM farms f 
      LEFT JOIN users u ON f.owner_id = u.id 
      ${whereClause}
      ORDER BY f.created_at DESC 
      LIMIT $1 OFFSET $2
    `, params);

    return {
      farms: result.rows,
      totalFarms,
      totalPages
    };
  }

  static async deleteFarm(farmId) {
    await query('DELETE FROM farms WHERE id = $1', [farmId]);
  }

  static async getFarmStats(farmId) {
    try {
      // Get products stats (only unsold products for current inventory)
      const productsResult = await query(`
        SELECT 
          COALESCE(SUM(total_price), 0) as total_product_value,
          COALESCE(SUM(quantity), 0) as product_count
        FROM products 
        WHERE farm_id = $1 AND status = 'unsold'
      `, [farmId]);

      // Get expenses stats
      const expensesResult = await query(`
        SELECT COALESCE(SUM(amount), 0) as total_expenses
        FROM expenses 
        WHERE farm_id = $1
      `, [farmId]);

      // Get investments stats
      const investmentsResult = await query(`
        SELECT COALESCE(SUM(amount), 0) as total_investments
        FROM investments 
        WHERE farm_id = $1
      `, [farmId]);

      // Get sales stats
      const salesResult = await query(`
        SELECT 
          COALESCE(SUM(total_amount), 0) as total_sales_revenue,
          COALESCE(SUM(quantity), 0) as sold_product_count,
          COALESCE(SUM(profit), 0) as sales_profit
        FROM sales 
        WHERE farm_id = $1
      `, [farmId]);

      const totalProductValue = parseFloat(productsResult.rows[0].total_product_value) || 0;
      const productCount = parseInt(productsResult.rows[0].product_count) || 0;
      const totalExpenses = parseFloat(expensesResult.rows[0].total_expenses) || 0;
      const totalInvestments = parseFloat(investmentsResult.rows[0].total_investments) || 0;
      const totalSalesRevenue = parseFloat(salesResult.rows[0].total_sales_revenue) || 0;
      const soldProductCount = parseInt(salesResult.rows[0].sold_product_count) || 0;
      const salesProfit = parseFloat(salesResult.rows[0].sales_profit) || 0;

      // Calculate Farm's Gross Profit: Sales Profit - Total Investments
      const grossProfit = salesProfit - totalInvestments;

      // Calculate total investment (investments + product costs for ROI calculation)
      const totalInvestment = totalInvestments + totalProductValue;

      // Calculate ROI: (Farm's Gross Profit / Total Investment) × 100
      const roi = totalInvestment > 0 ? (grossProfit / totalInvestment) * 100 : 0;

      return {
        total_products: totalProductValue,
        total_expenses: totalExpenses,
        product_count: productCount,
        total_profit: salesProfit, // Profit from sales (before investment deduction)
        gross_profit: grossProfit, // Farm's overall profit (after investment deduction)
        total_investments: totalInvestments,
        total_sales: totalSalesRevenue,
        sold_product_count: soldProductCount,
        roi: roi,
        total_investment: totalInvestment,
      };
    } catch (error) {
      console.error('Error calculating farm stats:', error);
      throw error;
    }
  }

  // Export complete farm data in a single JSON payload
  static async exportFarmData(farmId, exportedByUserId) {
    try {
      // Fetch core entities
      const farmResult = await query('SELECT * FROM farms WHERE id = $1', [farmId]);
      const farm = farmResult.rows[0];

      if (!farm) {
        throw new Error('Farm not found');
      }

      const products = (await query('SELECT * FROM products WHERE farm_id = $1 ORDER BY created_at DESC', [farmId])).rows;
      const batches = (await query(
        `SELECT pb.* FROM product_batches pb
         WHERE pb.product_id IN (SELECT id FROM products WHERE farm_id = $1)
         ORDER BY pb.created_at DESC`,
        [farmId]
      )).rows;
      const batchNames = (await query('SELECT * FROM batch_names WHERE farm_id = $1 ORDER BY created_at DESC', [farmId])).rows;
      const expenses = await this.getExpensesByFarmWithFilters(farmId, {});
      const investments = (await query('SELECT * FROM investments WHERE farm_id = $1 ORDER BY created_at DESC', [farmId])).rows;
      const sales = await this.getSalesByFarmWithFilters(farmId, {});
      const storeProducts = (await query(
        `SELECT sp.* FROM store_products sp
         JOIN products p ON sp.product_id = p.id
         WHERE p.farm_id = $1 ORDER BY sp.created_at DESC`,
        [farmId]
      )).rows;
      const orders = (await query(
        `SELECT DISTINCT o.* FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         JOIN store_products sp ON oi.store_product_id = sp.id
         JOIN products p ON sp.product_id = p.id
         WHERE p.farm_id = $1 ORDER BY o.created_at DESC`,
        [farmId]
      )).rows;
      const orderItems = (await query(
        `SELECT oi.* FROM order_items oi
         JOIN store_products sp ON oi.store_product_id = sp.id
         JOIN products p ON sp.product_id = p.id
         WHERE p.farm_id = $1
         ORDER BY oi.created_at DESC`,
        [farmId]
      )).rows;
      const cartItems = (await query(
        `SELECT sc.* FROM shopping_cart sc
         JOIN store_products sp ON sc.store_product_id = sp.id
         JOIN products p ON sp.product_id = p.id
         WHERE p.farm_id = $1 ORDER BY sc.created_at DESC`,
        [farmId]
      )).rows;

      const stats = await this.getFarmStats(farmId);

      const { serializeDoc, serializeDocs } = require('../utils/helpers');

      return {
        metadata: {
          export_date: new Date().toISOString(),
          farm_id: farmId,
          exported_by: exportedByUserId,
          format_version: '2.0.0'
        },
        farm: serializeDoc(farm),
        stats: serializeDoc(stats),
        products: serializeDocs(products),
        productBatches: serializeDocs(batches),
        batchNames: serializeDocs(batchNames),
        expenses: serializeDocs(expenses),
        investments: serializeDocs(investments),
        sales: serializeDocs(sales),
        storeProducts: serializeDocs(storeProducts),
        orders: serializeDocs(orders),
        orderItems: serializeDocs(orderItems),
        cartItems: serializeDocs(cartItems)
      };
    } catch (error) {
      console.error('Error exporting farm data:', error);
      throw error;
    }
  }

  // Remove all farm data safely with cascading deletes inside a transaction
  static async removeAllFarmData(farmId) {
    return transaction(async (client) => {
      // Ensure farm exists
      const farmRes = await client.query('SELECT id FROM farms WHERE id = $1', [farmId]);
      if (farmRes.rowCount === 0) {
        throw new Error('Farm not found');
      }

      const summary = {};

      // Orders and order items (orders are related to farms through order_items -> store_products -> products)
      const delOrderItems = await client.query(
        `DELETE FROM order_items WHERE order_id IN (
          SELECT DISTINCT o.id FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          JOIN store_products sp ON oi.store_product_id = sp.id
          JOIN products p ON sp.product_id = p.id
          WHERE p.farm_id = $1
        )`,
        [farmId]
      );
      summary.order_items_deleted = delOrderItems.rowCount || 0;

      const delOrders = await client.query(
        `DELETE FROM orders WHERE id IN (
          SELECT DISTINCT o.id FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          JOIN store_products sp ON oi.store_product_id = sp.id
          JOIN products p ON sp.product_id = p.id
          WHERE p.farm_id = $1
        )`,
        [farmId]
      );
      summary.orders_deleted = delOrders.rowCount || 0;

      // Cart items and store products (store_products are related to farms through products)
      const delCartItems = await client.query(
        `DELETE FROM shopping_cart WHERE store_product_id IN (
          SELECT sp.id FROM store_products sp
          JOIN products p ON sp.product_id = p.id
          WHERE p.farm_id = $1
        )`,
        [farmId]
      );
      summary.cart_items_deleted = delCartItems.rowCount || 0;

      const delStoreProducts = await client.query(
        `DELETE FROM store_products WHERE product_id IN (
          SELECT id FROM products WHERE farm_id = $1
        )`,
        [farmId]
      );
      summary.store_products_deleted = delStoreProducts.rowCount || 0;

      // Sales
      const delSales = await client.query('DELETE FROM sales WHERE farm_id = $1', [farmId]);
      summary.sales_deleted = delSales.rowCount || 0;

      // Expenses
      const delExpenses = await client.query('DELETE FROM expenses WHERE farm_id = $1', [farmId]);
      summary.expenses_deleted = delExpenses.rowCount || 0;

      // Investments
      const delInvestments = await client.query('DELETE FROM investments WHERE farm_id = $1', [farmId]);
      summary.investments_deleted = delInvestments.rowCount || 0;

      // Product batches and batch names
      const delProductBatches = await client.query(
        `DELETE FROM product_batches WHERE product_id IN (SELECT id FROM products WHERE farm_id = $1)`,
        [farmId]
      );
      summary.product_batches_deleted = delProductBatches.rowCount || 0;

      const delBatchNames = await client.query('DELETE FROM batch_names WHERE farm_id = $1', [farmId]);
      summary.batch_names_deleted = delBatchNames.rowCount || 0;

      // Products
      const delProducts = await client.query('DELETE FROM products WHERE farm_id = $1', [farmId]);
      summary.products_deleted = delProducts.rowCount || 0;

      return {
        message: 'All farm data removed successfully',
        summary
      };
    });
  }

  // Expense methods
  static async createExpense(expenseData) {
    const result = await query(`
      INSERT INTO expenses (expense_type_id, description, amount, farm_id, expense_date, created_by, batch_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `, [
      expenseData.expense_type_id,
      expenseData.description,
      expenseData.amount,
      expenseData.farm_id,
      expenseData.expense_date,
      expenseData.created_by,
      expenseData.batch_id || null
    ]);
    return result.rows[0];
  }

  static async getExpensesByFarm(farmId, batchId) {
    let queryStr = `
      SELECT e.*, et.name as expense_type_name, bn.name as product_batch_name
      FROM expenses e
      LEFT JOIN expense_types et ON e.expense_type_id = et.id
      LEFT JOIN batch_names bn ON e.batch_id = bn.id
      WHERE e.farm_id = $1
    `;
    const params = [farmId];
    if (batchId) {
      queryStr += ' AND e.batch_id = $2';
      params.push(batchId);
    }
    queryStr += ' ORDER BY e.created_at DESC';
    const result = await query(queryStr, params);
    return result.rows;
  }

  static async getExpenseById(expenseId) {
    const result = await query('SELECT * FROM expenses WHERE id = $1', [expenseId]);
    return result.rows[0];
  }

  static async updateExpense(expenseId, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      fields.push(`${key} = $${paramCount}`);
      values.push(updateData[key]);
      paramCount++;
    });

    values.push(expenseId);
    const result = await query(`
      UPDATE expenses 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `, values);
    return result.rows[0];
  }

  static async deleteExpense(expenseId) {
    await query('DELETE FROM expenses WHERE id = $1', [expenseId]);
  }

  // Investment methods
  static async createInvestment(investmentData) {
    const {
      investment_type,
      description,
      amount,
      farm_id,
      investment_date,
      title,
      created_by,
    } = investmentData;

    const result = await query(
      `INSERT INTO investments (
        farm_id,
        title,
        description,
        amount,
        investment_date,
        investment_type,
        created_by,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [
        farm_id,
        title,
        description,
        amount,
        investment_date || new Date(),
        investment_type,
        created_by,
      ]
    );
    return result.rows[0];
  }

  static async getInvestmentsByFarm(farmId) {
    const result = await query(
      'SELECT * FROM investments WHERE farm_id = $1 ORDER BY created_at DESC',
      [farmId]
    );
    return result.rows;
  }

  static async getInvestmentById(investmentId) {
    const result = await query(
      'SELECT * FROM investments WHERE id = $1',
      [investmentId]
    );
    return result.rows[0];
  }

  static async updateInvestment(investmentId, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      fields.push(`${key} = $${paramCount}`);
      values.push(updateData[key]);
      paramCount++;
    });

    fields.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    const queryStr = `UPDATE investments SET ${fields.join(', ')} WHERE id = $${paramCount + 1} RETURNING *`;
    values.push(investmentId);

    const result = await query(queryStr, values);
    return result.rows[0];
  }

  static async deleteInvestment(investmentId) {
    const result = await query(
      'DELETE FROM investments WHERE id = $1',
      [investmentId]
    );
    return result.rowCount > 0;
  }

  // Expense type methods
    static async getExpenseTypesByFarm(farmId) {
        const result = await query(
            `SELECT * FROM expense_types 
             WHERE is_active = true 
               AND LOWER(name) IN ('feed','medicine','vaccine','other')
             ORDER BY name`
        );
        return result.rows;
    }

    // Sales methods
    static async createSale(saleData) {
        const result = await query(
            `INSERT INTO sales (farm_id, product_id, quantity, unit_price, total_amount, profit,
             sale_date, customer_name, customer_contact, payment_method, payment_status,
             notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
            [
              saleData.farm_id,
              saleData.product_id,
              saleData.quantity_sold || saleData.quantity,
              saleData.price_per_unit || saleData.unit_price,
              (saleData.quantity_sold || saleData.quantity) * (saleData.price_per_unit || saleData.unit_price),
              saleData.profit || 0,
              saleData.sale_date,
              saleData.customer_name || null,
              saleData.customer_contact || null,
              saleData.payment_method || 'cash',
              saleData.payment_status || 'paid',
              saleData.notes || null,
              saleData.created_by
            ]
        );
        return result.rows[0];
    }

    static async getSaleById(saleId) {
        const result = await query('SELECT * FROM sales WHERE id = $1', [saleId]);
        return result.rows[0];
    }

    static async getSalesByFarmWithFilters(farmId, filters = {}) {
        let queryStr = `
          SELECT 
            s.id AS _id,
            s.farm_id,
            s.product_id,
            s.sale_date,
            s.quantity AS quantity_sold,
            s.unit_price AS price_per_unit,
            s.total_amount,
            s.profit,
            p.name AS product_name,
            p.batch_name AS product_batch
          FROM sales s
          LEFT JOIN products p ON s.product_id = p.id
          WHERE s.farm_id = $1`;
        const params = [farmId];
        let paramCount = 1;

        if (filters.product_id) {
            paramCount++;
            queryStr += ` AND s.product_id = $${paramCount}`;
            params.push(filters.product_id);
        }

        if (filters.start_date) {
            paramCount++;
            queryStr += ` AND s.sale_date >= $${paramCount}`;
            params.push(filters.start_date);
        }

        if (filters.end_date) {
            paramCount++;
            queryStr += ` AND s.sale_date <= $${paramCount}`;
            params.push(filters.end_date);
        }

        queryStr += ' ORDER BY s.sale_date DESC';

        const result = await query(queryStr, params);
        return result.rows;
    }

    static async deleteSale(saleId) {
        const result = await query('DELETE FROM sales WHERE id = $1 RETURNING *', [saleId]);
        return result.rows[0];
    }

    // Note: Expenses are not directly linked to product batches in the current schema
    // This method has been removed as the expenses table doesn't have a product_batch_id column

    static async getBatchNameById(batchId) {
        const result = await query('SELECT * FROM batch_names WHERE id = $1', [batchId]);
        return result.rows[0];
    }

    // Enhanced expense methods for management API
    static async getExpensesByFarmWithFilters(farmId, filters = {}) {
    let queryStr = `
      SELECT e.*, et.name as expense_type_name
      FROM expenses e
      LEFT JOIN expense_types et ON e.expense_type_id = et.id
      WHERE e.farm_id = $1
    `;
    const params = [farmId];
    let paramIndex = 2;

    if (filters.expense_type) {
      queryStr += ` AND LOWER(et.name) = LOWER($${paramIndex})`;
      params.push(filters.expense_type);
      paramIndex++;
    }

    if (filters.start_date) {
      queryStr += ` AND e.expense_date >= $${paramIndex}`;
      params.push(filters.start_date);
      paramIndex++;
    }

    if (filters.end_date) {
      queryStr += ` AND e.expense_date <= $${paramIndex}`;
      params.push(filters.end_date);
      paramIndex++;
    }

    queryStr += ' ORDER BY e.expense_date DESC';

    if (filters.limit) {
      queryStr += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    if (filters.skip) {
      queryStr += ` OFFSET $${paramIndex}`;
      params.push(filters.skip);
    }

    const result = await query(queryStr, params);
    return result.rows;
  }

  static async getBatchExpensesTotal(farmId, batchNumber) {
    // Note: Current expenses table schema doesn't have product_batch column
    // For now, return 0 until expenses are properly linked to batches
    // TODO: Add proper batch-expense relationship when needed
    return 0;
  }

  // Cart methods
  static async addToCart(userId, storeProductId, quantity) {
    const result = await query(
      `INSERT INTO shopping_cart (user_id, store_product_id, quantity, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id, store_product_id)
       DO UPDATE SET quantity = shopping_cart.quantity + $3, updated_at = NOW()
       RETURNING *`,
      [userId, storeProductId, quantity]
    );
    return result.rows[0];
  }

  static async getCartItems(userId) {
    
    const result = await query(
      `SELECT 
        sc.id,
        sc.user_id,
        sc.store_product_id,
        sc.quantity,
        sc.created_at,
        sc.updated_at,
        sp.store_price,
        sp.discount_percentage,
        CASE 
          WHEN COALESCE(sp.discount_percentage, 0) > 0 
          THEN sp.store_price * (1 - sp.discount_percentage / 100.0)
          ELSE sp.store_price
        END AS price_after_discount,
        sp.stock_quantity as available_stock,
        sp.is_available,
        sp.product_image_url,
        p.name,
        p.description,
        p.unit,
        pc.name as category,
        f.name as farm_name,
        f.id as farm_id
       FROM shopping_cart sc
       JOIN store_products sp ON sc.store_product_id = sp.id
       JOIN products p ON sp.product_id = p.id
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       JOIN farms f ON p.farm_id = f.id
       WHERE sc.user_id = $1
       ORDER BY sc.created_at DESC`,
      [userId]
    );
    console.log('getCartItems - Final result:', result.rows);
    return result.rows;
  }

  static async updateCartItem(cartItemId, userId, quantity) {
    const result = await query(
      `UPDATE shopping_cart 
       SET quantity = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [quantity, cartItemId, userId]
    );
    return result.rows[0];
  }

  static async removeCartItem(cartItemId, userId) {
    const result = await query(
      `DELETE FROM shopping_cart 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [cartItemId, userId]
    );
    return result.rows.length > 0;
  }

  static async clearCart(userId) {
    const result = await query(
      `DELETE FROM shopping_cart WHERE user_id = $1`,
      [userId]
    );
    return result.rowCount;
  }

  static async getCartItemByUserAndProduct(userId, storeProductId) {
    const result = await query(
      `SELECT * FROM shopping_cart 
       WHERE user_id = $1 AND store_product_id = $2`,
      [userId, storeProductId]
    );
    return result.rows[0];
  }

  // Import farm data from backup
  static async importFarmData(farmId, importData, replaceExisting = false, importedByUserId) {
    return transaction(async (client) => {
      try {
        console.log('🔄 Starting farm data import for farm:', farmId);
        
        // Validate farm exists
        const farmCheck = await client.query('SELECT id FROM farms WHERE id = $1', [farmId]);
        if (farmCheck.rowCount === 0) {
          throw new Error('Farm not found');
        }

        const imported_counts = {
          products: 0,
          productBatches: 0,
          batchNames: 0,
          expenses: 0,
          investments: 0,
          sales: 0,
          storeProducts: 0,
          orders: 0,
          orderItems: 0,
          cartItems: 0
        };
        const warnings = [];

        // If replace_existing is true, remove all existing data first
        if (replaceExisting) {
          console.log('🗑️ Removing existing farm data before import...');
          await this.removeAllFarmData(farmId);
        }

        // Import batch names first (they're referenced by other entities)
        if (importData.batchNames && Array.isArray(importData.batchNames)) {
          console.log('📦 Importing batch names...');
          for (const batchName of importData.batchNames) {
            try {
              // Check if batch name already exists
              const existingBatch = await client.query(
                'SELECT id FROM batch_names WHERE name = $1 AND farm_id = $2',
                [batchName.name, farmId]
              );
              
              if (existingBatch.rowCount === 0) {
                await client.query(
                  `INSERT INTO batch_names (id, name, farm_id, description, is_active, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                  [
                    batchName.id,
                    batchName.name,
                    farmId,
                    batchName.description,
                    batchName.is_active !== false,
                    batchName.created_at || new Date(),
                    batchName.updated_at || new Date()
                  ]
                );
                imported_counts.batchNames++;
              } else {
                warnings.push(`Batch name '${batchName.name}' already exists, skipped`);
              }
            } catch (error) {
              warnings.push(`Failed to import batch name '${batchName.name}': ${error.message}`);
            }
          }
        }

        // Import products
        if (importData.products && Array.isArray(importData.products)) {
          console.log('🌱 Importing products...');
          for (const product of importData.products) {
            try {
              // Check if product already exists
              const existingProduct = await client.query(
                'SELECT id FROM products WHERE id = $1',
                [product.id]
              );
              
              if (existingProduct.rowCount === 0) {
                await client.query(
                  `INSERT INTO products (id, name, description, category_id, farm_id, unit, quantity, total_price, unit_price, batch_name, product_type, base_price, is_active, created_at, updated_at, status)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
                  [
                    product.id,
                    product.name,
                    product.description,
                    product.category_id,
                    farmId,
                    product.unit,
                    product.quantity,
                    product.total_price,
                    product.unit_price,
                    product.batch_name,
                    product.product_type,
                    product.base_price,
                    product.is_active !== false,
                    product.created_at || new Date(),
                    product.updated_at || new Date(),
                    product.status || 'unsold'
                  ]
                );
                imported_counts.products++;
              } else {
                warnings.push(`Product '${product.name}' already exists, skipped`);
              }
            } catch (error) {
              warnings.push(`Failed to import product '${product.name}': ${error.message}`);
            }
          }
        }

        // Import product batches
        if (importData.productBatches && Array.isArray(importData.productBatches)) {
          console.log('📦 Importing product batches...');
          for (const batch of importData.productBatches) {
            try {
              const existingBatch = await client.query(
                'SELECT id FROM product_batches WHERE id = $1',
                [batch.id]
              );
              
              if (existingBatch.rowCount === 0) {
                await client.query(
                  `INSERT INTO product_batches (id, product_id, batch_number, quantity, unit_cost, total_cost, production_date, expiry_date, notes, is_active, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                  [
                    batch.id,
                    batch.product_id,
                    batch.batch_number,
                    batch.quantity,
                    batch.unit_cost,
                    batch.total_cost,
                    batch.production_date,
                    batch.expiry_date,
                    batch.notes,
                    batch.is_active !== false,
                    batch.created_at || new Date(),
                    batch.updated_at || new Date()
                  ]
                );
                imported_counts.productBatches++;
              } else {
                warnings.push(`Product batch '${batch.batch_number}' already exists, skipped`);
              }
            } catch (error) {
              warnings.push(`Failed to import product batch '${batch.batch_number}': ${error.message}`);
            }
          }
        }

        // Import expenses
        if (importData.expenses && Array.isArray(importData.expenses)) {
          console.log('💰 Importing expenses...');
          for (const expense of importData.expenses) {
            try {
              const existingExpense = await client.query(
                'SELECT id FROM expenses WHERE id = $1',
                [expense.id]
              );
              
              if (existingExpense.rowCount === 0) {
                await client.query(
                  `INSERT INTO expenses (id, farm_id, expense_type_id, amount, description, expense_date, receipt_number, vendor, payment_method, is_recurring, recurring_frequency, created_by, created_at, updated_at, batch_id)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                  [
                    expense.id,
                    farmId,
                    expense.expense_type_id,
                    expense.amount,
                    expense.description,
                    expense.expense_date,
                    expense.receipt_number,
                    expense.vendor,
                    expense.payment_method,
                    expense.is_recurring || false,
                    expense.recurring_frequency,
                    expense.created_by || importedByUserId,
                    expense.created_at || new Date(),
                    expense.updated_at || new Date(),
                    expense.batch_id
                  ]
                );
                imported_counts.expenses++;
              } else {
                warnings.push(`Expense '${expense.description}' already exists, skipped`);
              }
            } catch (error) {
              warnings.push(`Failed to import expense '${expense.description}': ${error.message}`);
            }
          }
        }

        // Import investments
        if (importData.investments && Array.isArray(importData.investments)) {
          console.log('🏗️ Importing investments...');
          for (const investment of importData.investments) {
            try {
              const existingInvestment = await client.query(
                'SELECT id FROM investments WHERE id = $1',
                [investment.id]
              );
              
              if (existingInvestment.rowCount === 0) {
                await client.query(
                  `INSERT INTO investments (id, farm_id, title, description, amount, investment_date, investment_type, expected_roi_percentage, actual_roi_percentage, status, created_by, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                  [
                    investment.id,
                    farmId,
                    investment.title,
                    investment.description,
                    investment.amount,
                    investment.investment_date,
                    investment.investment_type,
                    investment.expected_roi_percentage,
                    investment.actual_roi_percentage,
                    investment.status || 'active',
                    investment.created_by || importedByUserId,
                    investment.created_at || new Date(),
                    investment.updated_at || new Date()
                  ]
                );
                imported_counts.investments++;
              } else {
                warnings.push(`Investment '${investment.title}' already exists, skipped`);
              }
            } catch (error) {
              warnings.push(`Failed to import investment '${investment.title}': ${error.message}`);
            }
          }
        }

        // Import sales
        if (importData.sales && Array.isArray(importData.sales)) {
          console.log('💵 Importing sales...');
          for (const sale of importData.sales) {
            try {
              const existingSale = await client.query(
                'SELECT id FROM sales WHERE id = $1',
                [sale.id]
              );
              
              if (existingSale.rowCount === 0) {
                await client.query(
                  `INSERT INTO sales (id, farm_id, product_id, quantity_sold, unit_price, total_amount, sale_date, customer_name, customer_contact, payment_method, notes, created_by, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                  [
                    sale.id,
                    farmId,
                    sale.product_id,
                    sale.quantity_sold,
                    sale.unit_price,
                    sale.total_amount,
                    sale.sale_date,
                    sale.customer_name,
                    sale.customer_contact,
                    sale.payment_method,
                    sale.notes,
                    sale.created_by || importedByUserId,
                    sale.created_at || new Date(),
                    sale.updated_at || new Date()
                  ]
                );
                imported_counts.sales++;
              } else {
                warnings.push(`Sale record already exists, skipped`);
              }
            } catch (error) {
              warnings.push(`Failed to import sale: ${error.message}`);
            }
          }
        }

        // Import store products
        if (importData.storeProducts && Array.isArray(importData.storeProducts)) {
          console.log('🏪 Importing store products...');
          for (const storeProduct of importData.storeProducts) {
            try {
              const existingStoreProduct = await client.query(
                'SELECT id FROM store_products WHERE id = $1',
                [storeProduct.id]
              );
              
              if (existingStoreProduct.rowCount === 0) {
                await client.query(
                  `INSERT INTO store_products (id, product_id, batch_id, store_price, stock_quantity, min_stock_level, max_stock_level, is_featured, is_available, discount_percentage, created_at, updated_at, discount_description, product_image_url, description)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                  [
                    storeProduct.id,
                    storeProduct.product_id,
                    storeProduct.batch_id,
                    storeProduct.store_price,
                    storeProduct.stock_quantity,
                    storeProduct.min_stock_level,
                    storeProduct.max_stock_level,
                    storeProduct.is_featured || false,
                    storeProduct.is_available !== false,
                    storeProduct.discount_percentage || 0,
                    storeProduct.created_at || new Date(),
                    storeProduct.updated_at || new Date(),
                    storeProduct.discount_description,
                    storeProduct.product_image_url,
                    storeProduct.description
                  ]
                );
                imported_counts.storeProducts++;
              } else {
                warnings.push(`Store product already exists, skipped`);
              }
            } catch (error) {
              warnings.push(`Failed to import store product: ${error.message}`);
            }
          }
        }

        // Import orders
        if (importData.orders && Array.isArray(importData.orders)) {
          console.log('📋 Importing orders...');
          for (const order of importData.orders) {
            try {
              const existingOrder = await client.query(
                'SELECT id FROM orders WHERE id = $1',
                [order.id]
              );
              
              if (existingOrder.rowCount === 0) {
                await client.query(
                  `INSERT INTO orders (id, customer_id, order_number, status, total_amount, discount_amount, tax_amount, shipping_amount, final_amount, payment_status, payment_method, shipping_address, billing_address, notes, order_date, confirmed_at, shipped_at, delivered_at, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
                  [
                    order.id,
                    order.customer_id,
                    order.order_number,
                    order.status,
                    order.total_amount,
                    order.discount_amount,
                    order.tax_amount,
                    order.shipping_amount,
                    order.final_amount,
                    order.payment_status,
                    order.payment_method,
                    order.shipping_address,
                    order.billing_address,
                    order.notes,
                    order.order_date,
                    order.confirmed_at,
                    order.shipped_at,
                    order.delivered_at,
                    order.created_at || new Date(),
                    order.updated_at || new Date()
                  ]
                );
                imported_counts.orders++;
              } else {
                warnings.push(`Order '${order.order_number}' already exists, skipped`);
              }
            } catch (error) {
              warnings.push(`Failed to import order '${order.order_number}': ${error.message}`);
            }
          }
        }

        // Import order items
        if (importData.orderItems && Array.isArray(importData.orderItems)) {
          console.log('📦 Importing order items...');
          for (const orderItem of importData.orderItems) {
            try {
              const existingOrderItem = await client.query(
                'SELECT id FROM order_items WHERE id = $1',
                [orderItem.id]
              );
              
              if (existingOrderItem.rowCount === 0) {
                await client.query(
                  `INSERT INTO order_items (id, order_id, store_product_id, quantity, unit_price, total_price, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                  [
                    orderItem.id,
                    orderItem.order_id,
                    orderItem.store_product_id,
                    orderItem.quantity,
                    orderItem.unit_price,
                    orderItem.total_price,
                    orderItem.created_at || new Date()
                  ]
                );
                imported_counts.orderItems++;
              } else {
                warnings.push(`Order item already exists, skipped`);
              }
            } catch (error) {
              warnings.push(`Failed to import order item: ${error.message}`);
            }
          }
        }

        // Import cart items (optional, usually not needed for backups)
        if (importData.cartItems && Array.isArray(importData.cartItems)) {
          console.log('🛒 Importing cart items...');
          for (const cartItem of importData.cartItems) {
            try {
              const existingCartItem = await client.query(
                'SELECT id FROM shopping_cart WHERE id = $1',
                [cartItem.id]
              );
              
              if (existingCartItem.rowCount === 0) {
                await client.query(
                  `INSERT INTO shopping_cart (id, user_id, store_product_id, quantity, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6)`,
                  [
                    cartItem.id,
                    cartItem.user_id,
                    cartItem.store_product_id,
                    cartItem.quantity,
                    cartItem.created_at || new Date(),
                    cartItem.updated_at || new Date()
                  ]
                );
                imported_counts.cartItems++;
              } else {
                warnings.push(`Cart item already exists, skipped`);
              }
            } catch (error) {
              warnings.push(`Failed to import cart item: ${error.message}`);
            }
          }
        }

        console.log('✅ Farm data import completed successfully');
        console.log('📊 Import summary:', imported_counts);
        
        return {
          success: true,
          imported_counts,
          warnings
        };
      } catch (error) {
        console.error('❌ Error during farm data import:', error);
        throw error;
      }
    });
  }
}

module.exports = DatabaseService;