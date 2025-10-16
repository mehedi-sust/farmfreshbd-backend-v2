/**
 * Core API - Consolidated endpoint for auth, products, store_products, and farms
 * This consolidation reduces serverless function count for Vercel Hobby plan
 * 
 * @swagger
 * tags:
 *   - name: Store Products
 *     description: Store product management
 *   - name: Product Batches
 *     description: Product batch management
 *   - name: Products
 *     description: Product management
 *   - name: Expenses
 *     description: Expense management
 *   - name: Expense Types
 *     description: Expense type management
 */

const express = require('express');
const DatabaseService = require('../services/database.service');
const { authenticate } = require('../config/auth');
const { asyncHandler, validateUUID } = require('../utils/helpers');

const router = express.Router();

// Store Products Routes (embedded to avoid creating separate file)

// Create a new store product - POST /store_products
router.post('/store_products', authenticate, asyncHandler(async (req, res) => {
    const {
        product_id, farm_id, store_price, store_stock_quantity, is_featured, discount_percentage,
        product_image_url, name, description, category, unit, discount_description
    } = req.body;

    if (!product_id || !farm_id || !store_price || !store_stock_quantity) {
        return res.status(400).json({ error: 'product_id, farm_id, store_price, and store_stock_quantity are required' });
    }

    // Verify farm ownership
    const farmOwnership = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
    if (!farmOwnership) {
        return res.status(403).json({ error: 'Access denied. You do not own this farm.' });
    }

    // Note: Allow multiple store products from the same base product
    // This enables different pricing, stock levels, or configurations for the same product
    // The restriction is removed to support flexible store product management

    const storeQty = parseFloat(store_stock_quantity);
    const storePrice = parseFloat(store_price);
    const storeProductData = {
        // product_id is a UUID in v2 schema; keep as trimmed string
        product_id: String(product_id).trim(),
        farm_id,
        store_price: Number.isFinite(storePrice) ? storePrice : 0,
        // Align with DB schema column name
        stock_quantity: Number.isFinite(storeQty) ? storeQty : 0,
        is_featured: !!is_featured,
        discount_percentage: Number(discount_percentage) || 0,
        // Keep availability consistent with stock
        is_available: (Number.isFinite(storeQty) ? storeQty : 0) > 0,
        // Additional fields for store product customization
        product_image_url: product_image_url || null,
        description: description || null,
        discount_description: discount_description || null
    };

    const created = await DatabaseService.createStoreProduct(storeProductData);

    res.status(201).json(created);
}));

// Get store product by ID - GET /store_products/:productId
router.get('/store_products/:productId', asyncHandler(async (req, res) => {
  const { productId } = req.params;

  try {
    const id = validateUUID(productId);
    const storeProduct = await DatabaseService.getStoreProductById(id);
    
    if (!storeProduct) {
      return res.status(404).json({ error: 'Store product not found' });
    }

    // Compute price after discount if not provided by DB
    const discountPct = Number(storeProduct.discount_percentage) || 0;
    const computedPriceAfterDiscount = Math.round((Number(storeProduct.store_price) || 0) * (1 - discountPct / 100) * 100) / 100;

    // Transform the response to match the expected format
    const response = {
      id: storeProduct.id,
      product_id: storeProduct.product_id?.toString?.() || storeProduct.product_id,
      farm_id: storeProduct.farm_id?.toString?.() || storeProduct.farm_id,
      store_price: storeProduct.store_price,
      store_stock_quantity: storeProduct.stock_quantity ?? storeProduct.store_stock_quantity,
      is_featured: storeProduct.is_featured,
      is_available: storeProduct.is_available ?? ((storeProduct.stock_quantity ?? storeProduct.store_stock_quantity) > 0),
      discount_percentage: storeProduct.discount_percentage ?? 0,
      discount_description: storeProduct.discount_description ?? null,
      price_after_discount: storeProduct.price_after_discount ?? computedPriceAfterDiscount,
      created_at: storeProduct.created_at,
      updated_at: storeProduct.updated_at,
      product_name: storeProduct.name,
      product_quantity: storeProduct.stock_quantity ?? storeProduct.store_stock_quantity,
      description: storeProduct.description,
      category: storeProduct.category ?? null,
      product_type: storeProduct.product_type ?? null,
      unit: storeProduct.unit,
      price: storeProduct.store_price,
      // Flattened farm and image fields for frontend
      farm_name: storeProduct.farm_name ?? null,
      farm_location: storeProduct.farm_location ?? null,
      farm_address: storeProduct.farm_address ?? null,
      product_image_url: storeProduct.product_image_url ?? null
    };

    res.json(response);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Get all store products (public) - GET /store_products
router.get('/store_products', asyncHandler(async (req, res) => {
  const { category, farm_id, skip = 0, limit = 100 } = req.query;

  const storeProducts = await DatabaseService.getStoreProducts({
    category,
    farm_id: farm_id ? farm_id : null,
    skip: parseInt(skip),
    limit: parseInt(limit)
  });

  // Transform the response to match the expected format
  const serialized = storeProducts.map(product => {
    const discountPct = Number(product.discount_percentage) || 0;
    const priceAfterDiscount = Math.round((Number(product.store_price) || 0) * (1 - discountPct / 100) * 100) / 100;
    return {
      id: product._id,
      product_id: product.product_id?.toString?.() || product.product_id,
      farm_id: product.farm_id?.toString?.() || product.farm_id,
      store_price: product.store_price,
      store_stock_quantity: product.store_stock_quantity ?? product.available_stock ?? product.stock ?? product.stock_quantity,
      is_featured: product.is_featured,
      is_available: product.is_available ?? product.stock_quantity > 0,
      discount_percentage: product.discount_percentage ?? 0,
      discount_description: product.discount_description ?? null,
      price_after_discount: product.price_after_discount ?? priceAfterDiscount,
      created_at: product.created_at,
      updated_at: product.updated_at,
      product_name: product.product_name,
      product_quantity: product.stock_quantity,
      description: product.description,
      category: product.category ?? null,
      product_type: product.product_type ?? null,
      unit: product.unit,
      price: product.store_price,
      // Flattened farm and image fields for frontend
      farm_name: product.farm_name ?? null,
      farm_location: product.farm_location ?? null,
      farm_address: product.farm_address ?? null,
      product_image_url: product.product_image_url ?? null
    };
  });

  res.json(serialized);
}));

// Product Batches Routes
/**
 * @swagger
 * /product_batches:
 *   post:
 *     summary: Create a new product batch
 *     tags: [Product Batches]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - farm_id
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the product batch
 *               farm_id:
 *                 type: string
 *                 description: ID of the farm
 *     responses:
 *       201:
 *         description: Product batch created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductBatch'
 *       400:
 *         description: Bad request - missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - no access to farm
 */
router.post('/product_batches', authenticate, asyncHandler(async (req, res) => {
  const { name, farm_id } = req.body;

  if (!name || !farm_id) {
    return res.status(400).json({ error: 'Name and farm_id are required' });
  }

  // Verify farm ownership
  const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to this farm' });
  }

  const created = await DatabaseService.createBatchName({
    name,
    farm_id
  });

  res.status(201).json(created);
}));

// Get batches by farm - GET /product_batches/farm/:farm_id
router.get('/product_batches/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  // Verify farm ownership
  const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to this farm' });
  }

  const batches = await DatabaseService.getBatchNamesByFarm(farm_id);
  res.json(batches);
}));

// Get batches (query parameter version) - GET /product_batches?farm_id=xxx
router.get('/product_batches', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  // Verify farm ownership
  const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to this farm' });
  }

  const batches = await DatabaseService.getBatchNamesByFarm(farm_id);
  res.json(batches);
}));

// Update batch - PUT /product_batches/:id
router.put('/product_batches/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, is_available } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Batch ID is required' });
  }

  // Get the batch to verify farm ownership
  const batch = await DatabaseService.getBatchNameById(id);
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  // Verify farm ownership
  const hasAccess = await DatabaseService.verifyFarmOwnership(batch.farm_id, req.user.userId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to this farm' });
  }

  const updated = await DatabaseService.updateBatchName(id, {
    name,
    is_available
  });

  if (!updated) {
    return res.status(404).json({ error: 'Batch not found or could not be updated' });
  }

  res.json(updated);
}));

// Delete product batch - DELETE /product_batches/:id
router.delete('/product_batches/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Batch ID is required' });
  }

  try {
    // Get the batch to verify it exists and get farm ownership info
    const batch = await DatabaseService.getProductBatchById(id);
    if (!batch) {
      return res.status(404).json({ error: 'Product batch not found' });
    }

    // Get the product to verify farm ownership
    const product = await DatabaseService.getProductById(batch.product_id);
    if (!product) {
      return res.status(404).json({ error: 'Associated product not found' });
    }

    // Verify farm ownership
    const hasAccess = await DatabaseService.verifyFarmOwnership(product.farm_id, req.user.userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this farm' });
    }

    // Delete the batch
    const deletedBatch = await DatabaseService.deleteProductBatch(id);
    if (!deletedBatch) {
      return res.status(404).json({ error: 'Product batch not found or could not be deleted' });
    }

    res.json({ 
      message: 'Product batch deleted successfully',
      deleted_batch: deletedBatch
    });
  } catch (error) {
    console.error('Error deleting product batch:', error);
    res.status(500).json({ error: 'Failed to delete product batch' });
  }
}));


// Helper function to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied', 
      message: 'Only administrators can manage expense types' 
    });
  }
  next();
};

// Expense Types Routes
// Create expense type - POST /expense_types (Admin only)
router.post('/expense_types', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { name, description, is_global = false } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Check for duplicate names (case-insensitive)
  const existingType = await DatabaseService.getExpenseTypeByName(name);

  if (existingType) {
    return res.status(409).json({ 
      error: 'Duplicate expense type', 
      message: `Expense type '${name}' already exists` 
    });
  }

  const created = await DatabaseService.createExpenseType({
    name,
    description: description || '',
    is_global,
    created_by: req.user.userId
  });

  res.status(201).json(created);
}));

// Get all expense types - GET /expense_types (returns default and global types)
router.get('/expense_types', authenticate, asyncHandler(async (req, res) => {
  try {
    try {
      await DatabaseService.ensureDefaultExpenseTypes();
    } catch (initErr) {
      console.warn('⚠️  Failed to ensure default expense types:', initErr?.message || initErr);
    }
    const types = await DatabaseService.getExpenseTypes();
    res.json(types);
  } catch (error) {
    console.error('Error fetching expense types:', error);
    res.status(500).json({ error: 'Failed to fetch expense types' });
  }
}));

// Get expense types by farm - GET /expense_types/farm/:farm_id (legacy endpoint)
router.get('/expense_types/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  try {
    // Ensure default types exist first
    try {
      await DatabaseService.ensureDefaultExpenseTypes();
    } catch (initErr) {
      console.warn('⚠️  Failed to ensure default expense types:', initErr?.message || initErr);
    }

    // Verify farm ownership; if not, gracefully return default/global types
    const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
    if (!hasAccess) {
      const fallbackTypes = await DatabaseService.getExpenseTypes();
      return res.json(fallbackTypes);
    }

    // Try fetching farm-specific + default/global types; fallback on error
    try {
      const types = await DatabaseService.getExpenseTypesByFarmId(farm_id);
      return res.json(types);
    } catch (dbErr) {
      console.error('Error fetching expense types:', dbErr);
      const fallbackTypes = await DatabaseService.getExpenseTypes();
      return res.json(fallbackTypes);
    }
  } catch (error) {
    console.error('Error fetching expense types:', error);
    res.status(500).json({ error: 'Failed to fetch expense types' });
  }
}));

// Update expense type - PUT /expense_types/:id (Admin only)
router.put('/expense_types/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, is_global } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const expenseType = await DatabaseService.getExpenseTypeById(parseInt(id));
  if (!expenseType) {
    return res.status(404).json({ error: 'Expense type not found' });
  }

  // Prevent updating default expense types
  if (expenseType.is_default) {
    return res.status(403).json({ 
      error: 'Cannot update default expense types',
      message: 'Default expense types (Food, Medicine, Vaccine, Other) cannot be modified'
    });
  }

  // Check for duplicate names (excluding current record)
  const existingType = await DatabaseService.getExpenseTypeByName(name);
  if (existingType && existingType.id !== parseInt(id)) {
    return res.status(409).json({ 
      error: 'Duplicate expense type', 
      message: `Expense type '${name}' already exists` 
    });
  }

  const updated = await DatabaseService.updateExpenseType(parseInt(id), {
    name,
    description: description || expenseType.description || '',
    is_global: is_global !== undefined ? is_global : expenseType.is_global,
    updated_by: req.user.userId
  });

  res.json(updated);
}));

// Delete expense type - DELETE /expense_types/:id (Admin only)
router.delete('/expense_types/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const expenseType = await DatabaseService.getExpenseTypeById(parseInt(id));
  if (!expenseType) {
    return res.status(404).json({ error: 'Expense type not found' });
  }

  // Prevent deleting default expense types
  if (expenseType.is_default) {
    return res.status(403).json({ 
      error: 'Cannot delete default expense types',
      message: 'Default expense types (Food, Medicine, Vaccine, Other) cannot be deleted'
    });
  }

  // Check if expense type is being used in any expenses
  const expenseCount = await DatabaseService.getExpenseCountByType(parseInt(id));
  if (expenseCount > 0) {
    return res.status(409).json({ 
      error: 'Cannot delete expense type',
      message: `This expense type is used in ${expenseCount} expense(s). Please reassign or delete those expenses first.`
    });
  }

  await DatabaseService.deleteExpenseType(parseInt(id));
  res.json({ message: 'Expense type deleted successfully' });
}));

// Products Routes (to fix the 404 error)
// Get all products - GET /products
router.get('/products', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, category, skip = 0, limit = 100, status } = req.query;

  const productsList = await DatabaseService.getProducts({
    farm_id: farm_id || null,
    category,
    skip: parseInt(skip),
    limit: parseInt(limit),
    status
  });

  res.json(productsList);
}));

// Create a new product - POST /products
router.post('/products', authenticate, asyncHandler(async (req, res) => {
  const {
    name,
    description = '',
    unit = 'piece',
    quantity,
    total_price,
    batch_name,
    product_type = 'others',
    farm_id,
    status = 'unsold'
  } = req.body;

  // Basic required fields validation
  if (!name || !farm_id) {
    return res.status(400).json({ error: 'name and farm_id are required' });
  }

  // Verify farm ownership
  const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to this farm' });
  }

  // Parse and validate numeric fields
  const parsedQuantity = typeof quantity === 'number' ? quantity : parseInt(quantity, 10);
  const parsedTotalPrice = typeof total_price === 'number' ? total_price : parseFloat(total_price);

  if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({ error: 'quantity must be a positive number' });
  }

  if (isNaN(parsedTotalPrice) || parsedTotalPrice < 0) {
    return res.status(400).json({ error: 'total_price must be a valid non-negative number' });
  }

  if (!batch_name || !String(batch_name).trim()) {
    return res.status(400).json({ error: 'batch_name is required' });
  }

  const validTypes = ['animal', 'fish', 'crop', 'others', 'produce'];
  if (!validTypes.includes(product_type)) {
    return res.status(400).json({ error: `Invalid product_type. Must be one of: ${validTypes.join(', ')}` });
  }

  const created = await DatabaseService.createProduct({
    name,
    description,
    unit,
    quantity: parsedQuantity,
    total_price: parsedTotalPrice,
    batch_name: String(batch_name).trim(),
    product_type,
    farm_id,
    status
  });

  res.status(201).json(created);
}));

// Delete a product - DELETE /products/:id
router.delete('/products/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Product ID is required' });
  }

  // First, find the product to verify farm access
  const product = await DatabaseService.getProductById(id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Verify user has access to this farm
  const hasAccess = await DatabaseService.verifyFarmOwnership(product.farm_id, req.user.userId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to this farm' });
  }

  // Delete the product
  const deleted = await DatabaseService.deleteProduct(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json({ message: 'Product deleted successfully' });
}));

// Product Batches Routes
// Get product batches by farm - GET /products/batches/farm/:farm_id
router.get('/products/batches/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;
  const { product_id, status, skip = 0, limit = 100 } = req.query;

  // Verify farm ownership
  const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to this farm' });
  }

  const filters = {
    skip: parseInt(skip),
    limit: parseInt(limit)
  };

  if (product_id) {
    filters.product_id = parseInt(product_id);
  }
  if (status) {
    filters.status = status;
  }

  const batches = await DatabaseService.getProductBatchesByFarmWithFilters(farm_id, filters);

  res.json(batches);
}));

// Store Products by Farm Routes
// Get store products by farm - GET /store_products/farm/:farm_id
router.get('/store_products/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;
  const { category, skip = 0, limit = 100 } = req.query;

  // Verify farm ownership
  const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to this farm' });
  }

  const filters = {
    skip: parseInt(skip),
    limit: parseInt(limit)
  };

  if (category) {
    filters.category = category;
  }

  const storeProductsList = await DatabaseService.getStoreProductsByFarm(farm_id, filters);
  // Normalize field names for frontend compatibility
  const serialized = storeProductsList.map(item => ({
    _id: item._id,
    id: item._id,
    product_id: item.product_id,
    farm_id: item.farm_id,
    store_price: item.store_price,
    price: item.price,
    price_after_discount: item.price_after_discount,
    store_stock_quantity: item.store_stock_quantity ?? item.stock_quantity ?? item.available_stock ?? item.stock,
    is_featured: item.is_featured,
    discount_percentage: item.discount_percentage,
    is_available: item.is_available,
    created_at: item.created_at,
    updated_at: item.updated_at,
    product_name: item.product_name ?? item.name,
    description: item.description,
    unit: item.unit,
    category: item.category,
    product_type: item.product_type,
    product_quantity: item.product_quantity ?? item.stock_quantity ?? item.store_stock_quantity,
    product_image_url: item.product_image_url ?? null,
    base_product_image_url: item.base_product_image_url ?? null,
    farm_name: item.farm_name ?? null,
    farm_location: item.farm_location ?? null,
    farm_address: item.farm_address ?? null
  }));

  res.json(serialized);
}));

// Get available store products by farm - GET /store_products/farm/:farm_id/available_products
router.get('/store_products/farm/:farm_id/available_products', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;
  const { category, skip = 0, limit = 100 } = req.query;

  // Verify farm ownership
  const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to this farm' });
  }

  // Use inventory products not yet in store, aligned with v2 schema
  const products = await DatabaseService.getAvailableProductsForStore(farm_id);
  // Basic pagination in-memory since query returns ordered list
  const start = parseInt(skip) || 0;
  const end = start + (parseInt(limit) || 100);
  const paginated = products.slice(start, end);
  res.json(paginated);
}));

// Update a store product - PUT /store_products/:productId
router.put('/store_products/:productId', authenticate, asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const {
        name, description, product_image_url, category, unit,
        store_price, store_stock_quantity, is_featured, discount_percentage
    } = req.body;

    const id = validateUUID(productId);
    const existingStoreProduct = await DatabaseService.getStoreProductById(id);
    if (!existingStoreProduct) {
        return res.status(404).json({ error: 'Store product not found' });
    }

    // Verify farm ownership
    const hasAccess = await DatabaseService.verifyFarmOwnership(existingStoreProduct.farm_id, req.user.userId);
    if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this farm' });
    }

    // Update store product fields
    const storeProductUpdates = {};
    // Align with DB schema
    if (store_price !== undefined) storeProductUpdates.store_price = parseFloat(store_price);
    if (store_stock_quantity !== undefined) storeProductUpdates.stock_quantity = parseInt(store_stock_quantity, 10);
    if (is_featured !== undefined) storeProductUpdates.is_featured = is_featured;
    if (discount_percentage !== undefined) storeProductUpdates.discount_percentage = parseFloat(discount_percentage);
    if (req.body.discount_description !== undefined) {
        storeProductUpdates.discount_description = String(req.body.discount_description).trim();
    }

    if (Object.keys(storeProductUpdates).length > 0) {
        await DatabaseService.updateStoreProduct(id, storeProductUpdates);
    }

    // Also update the base product if details are provided
    if (name || description || unit) {
        const productUpdates = {};
        if (name) productUpdates.name = name;
        if (description) productUpdates.description = description;
        // products table in v2 does not have image_url or category columns; skip those to avoid SQL errors
        if (unit) productUpdates.unit = unit;

        await DatabaseService.updateProduct(existingStoreProduct.product_id, productUpdates);
    }

    const updatedProduct = await DatabaseService.getStoreProductById(id);
    res.json(updatedProduct);
}));

// Delete a store product - DELETE /store_products/:productId
router.delete('/store_products/:productId', authenticate, asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const id = validateUUID(productId);
    const existingStoreProduct = await DatabaseService.getStoreProductById(id);
    if (!existingStoreProduct) {
        return res.status(404).json({ error: 'Store product not found' });
    }

    // Verify farm ownership
    const hasAccess = await DatabaseService.verifyFarmOwnership(existingStoreProduct.farm_id, req.user.userId);
    if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this farm' });
    }

    const deleted = await DatabaseService.deleteStoreProduct(id);

    if (!deleted) {
        return res.status(404).json({ error: 'Store product not found' });
    }

    res.status(204).send();
}));

// Publish a store product - PATCH /store_products/:productId/publish
router.patch('/store_products/:productId/publish', authenticate, asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const id = validateUUID(productId);
    const existingStoreProduct = await DatabaseService.getStoreProductById(id);
    if (!existingStoreProduct) {
        return res.status(404).json({ error: 'Store product not found' });
    }

    // Verify farm ownership
    const hasAccess = await DatabaseService.verifyFarmOwnership(existingStoreProduct.farm_id, req.user.userId);
    if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this farm' });
    }

    await DatabaseService.updateStoreProduct(id, { is_available: true });

    const updatedProduct = await DatabaseService.getStoreProductById(id);
    res.json(updatedProduct);
}));

// Unpublish a store product - PATCH /store_products/:productId/unpublish
router.patch('/store_products/:productId/unpublish', authenticate, asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const id = validateUUID(productId);
    const existingStoreProduct = await DatabaseService.getStoreProductById(id);
    if (!existingStoreProduct) {
        return res.status(404).json({ error: 'Store product not found' });
    }

    // Verify farm ownership
    const hasAccess = await DatabaseService.verifyFarmOwnership(existingStoreProduct.farm_id, req.user.userId);
    if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this farm' });
    }

    await DatabaseService.updateStoreProduct(id, { is_available: false });

    const updatedProduct = await DatabaseService.getStoreProductById(id);
    res.json(updatedProduct);
}));

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Core API is running',
    endpoints: ['store_products', 'product_batches', 'expenses', 'expense_types', 'products']
  });
});

// Export the router
module.exports = router;