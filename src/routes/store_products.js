const express = require('express');
const { authenticate } = require('../config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toInteger, isValidUUID, validateUUID } = require('../utils/helpers');
const DatabaseService = require('../services/database.service');

const router = express.Router();

// Get all store products - GET /store_products
router.get('/', asyncHandler(async (req, res) => {
    const { farm_id, category, skip = 0, limit = 100 } = req.query;
    
    try {
        const products = await DatabaseService.getStoreProducts({
            farm_id: farm_id || null, // farm_id is UUID
            category,
            skip: parseInt(skip),
            limit: parseInt(limit)
        });

        res.json({
            store_products: serializeDocs(products),
            pagination: {
                totalProducts: products.length,
                currentPage: Math.floor(skip / limit) + 1,
                pageSize: limit
            }
        });
    } catch (error) {
        console.error('Error fetching store products:', error);
        res.status(500).json({ error: 'Failed to fetch store products' });
    }
}));

// Get store products by farm - GET /store_products/farm/:farm_id
router.get('/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
    const { farm_id } = req.params;
    const { category, skip = 0, limit = 100 } = req.query;

    try {
        // farm_id is UUID, no conversion needed
        const products = await DatabaseService.getStoreProductsByFarm(farm_id, {
            category,
            skip: parseInt(skip),
            limit: parseInt(limit)
        });

        res.json({
            store_products: serializeDocs(products),
            pagination: {
                totalProducts: products.length,
                currentPage: Math.floor(skip / limit) + 1,
                pageSize: limit
            }
        });
    } catch (error) {
        console.error('Error fetching store products by farm:', error);
        res.status(500).json({ error: 'Failed to fetch store products' });
    }
}));

// Get products available to add to store - GET /store_products/farm/:farm_id/available_products
router.get('/farm/:farm_id/available_products', authenticate, asyncHandler(async (req, res) => {
    const { farm_id } = req.params;

    try {
        // Verify farm access for authenticated user
        const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Farm access denied' });
        }

        const availableProducts = await DatabaseService.getAvailableProductsForStore(farm_id);
        res.json({ available_products: serializeDocs(availableProducts) });
    } catch (error) {
        console.error('Error fetching available products for store:', error);
        res.status(500).json({ error: 'Failed to fetch available products' });
    }
}));

// Get a single store product by ID - GET /store_products/:productId
// Public endpoint: no authentication required
router.get('/:productId', asyncHandler(async (req, res) => {
    const { productId } = req.params;
    
    try {
        const id = validateUUID(productId);
        const product = await DatabaseService.getStoreProductById(id);
        
        if (!product) {
            return res.status(404).json({ error: 'Store product not found' });
        }

        res.json(serializeDoc(product));
    } catch (error) {
        console.error('Error fetching store product:', error);
        res.status(500).json({ error: 'Failed to fetch store product' });
    }
}));

// Create a new store product - POST /store_products
router.post('/', authenticate, asyncHandler(async (req, res) => {
    const { 
        product_id, store_price, 
        stock_quantity, is_featured, discount_percentage,
        // Aliases from frontend payloads
        selling_price, available_stock, store_stock_quantity,
        // Optional for validation/compatibility
        farm_id,
        // Optional marketing fields
        discount_description,
        product_image_url,
        // Optional base product fields (allow editing from store context)
        name,
        description,
        unit,
        category
    } = req.body;

    // Map alias fields
    const resolved_store_price = store_price !== undefined ? store_price : (selling_price !== undefined ? selling_price : undefined);
    const resolved_stock_quantity = stock_quantity !== undefined ? stock_quantity : (available_stock !== undefined ? available_stock : (store_stock_quantity !== undefined ? store_stock_quantity : undefined));

    if (!product_id || resolved_store_price === undefined || resolved_stock_quantity === undefined) {
        return res.status(400).json({ 
            error: 'product_id, store_price, and stock_quantity are required' 
        });
    }

    try {
        const productIdValidated = validateUUID(product_id);
        
        // Verify product exists
        const product = await DatabaseService.getProductById(productIdValidated);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // If farm_id provided, verify access and prevent duplicates
        if (farm_id) {
            const farmIdValidated = validateUUID(farm_id);
            const hasAccess = await DatabaseService.verifyFarmOwnership(farmIdValidated, req.user.userId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Farm access denied' });
            }

            const existing = await DatabaseService.checkStoreProductExists(productIdValidated, farmIdValidated);
            if (existing) {
                return res.status(400).json({ error: 'Store product already exists for this product and farm' });
            }
        }

        // Optional: basic stock validation if product has quantity
        if (product.quantity !== undefined && resolved_stock_quantity > product.quantity) {
            return res.status(400).json({ error: 'Stock quantity cannot exceed base product quantity' });
        }

        // Optionally update base product fields if provided
        const baseProductUpdates = {};
        if (name !== undefined) baseProductUpdates.name = name;
        // Do NOT update base product description from store context
        // Store-level description is handled via store_products.description
        if (unit !== undefined) baseProductUpdates.unit = unit;
        if (category !== undefined) {
            const categoryRow = await DatabaseService.getProductCategoryByName(category);
            if (!categoryRow) {
                return res.status(400).json({ error: 'Invalid product category provided' });
            }
            baseProductUpdates.category_id = categoryRow.id;
        }

        if (Object.keys(baseProductUpdates).length > 0) {
            await DatabaseService.updateProduct(productIdValidated, baseProductUpdates);
        }

        const storeProductData = {
            product_id: productIdValidated,
            store_price: parseFloat(resolved_store_price),
            stock_quantity: parseInt(resolved_stock_quantity),
            is_featured: is_featured !== undefined ? is_featured : false,
            discount_percentage: discount_percentage ? parseFloat(discount_percentage) : 0,
            farm_id: farm_id ? validateUUID(farm_id) : (product.farm_id || null),
            is_available: true,
            discount_description: discount_description !== undefined ? String(discount_description).trim() : null,
            product_image_url: product_image_url !== undefined ? String(product_image_url).trim() : null,
            description: description !== undefined ? String(description).trim() : null
        };

        const created = await DatabaseService.createStoreProduct(storeProductData);
        // Fetch flattened, joined representation for consistent frontend consumption
        const joined = await DatabaseService.getStoreProductById(created.id);
        res.status(201).json(serializeDoc(joined));
    } catch (error) {
        console.error('Error creating store product:', error);
        res.status(500).json({ error: 'Failed to create store product' });
    }
}));

// Update a store product - PUT /store_products/:productId
router.put('/:productId', authenticate, asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { 
        store_price, stock_quantity, is_available, is_featured, discount_percentage,
        // Aliases
        selling_price, available_stock, store_stock_quantity,
        // Optional marketing fields
        discount_description,
        product_image_url,
        // Optional base product fields
        name,
        description,
        unit,
        category
    } = req.body;

    try {
        const id = validateUUID(productId);
        
        // Check if store product exists
        const existingProduct = await DatabaseService.getStoreProductById(id);
        if (!existingProduct) {
            return res.status(404).json({ error: 'Store product not found' });
        }

        const updateData = {};
        const resolved_update_price = store_price !== undefined ? store_price : (selling_price !== undefined ? selling_price : undefined);
        const resolved_update_stock = stock_quantity !== undefined ? stock_quantity : (available_stock !== undefined ? available_stock : (store_stock_quantity !== undefined ? store_stock_quantity : undefined));
        if (resolved_update_price !== undefined) updateData.store_price = parseFloat(resolved_update_price);
        if (resolved_update_stock !== undefined) updateData.stock_quantity = parseInt(resolved_update_stock);
        if (is_available !== undefined) updateData.is_available = is_available;
        if (is_featured !== undefined) updateData.is_featured = is_featured;
        if (discount_percentage !== undefined) updateData.discount_percentage = parseFloat(discount_percentage);
        if (discount_description !== undefined) updateData.discount_description = String(discount_description).trim();
        if (product_image_url !== undefined) updateData.product_image_url = String(product_image_url).trim();
        if (description !== undefined) updateData.description = String(description).trim();

        // Update store product fields
        const updated = await DatabaseService.updateStoreProduct(id, updateData);

        // Also update base product if product-level fields provided
        const productUpdates = {};
        if (name !== undefined) productUpdates.name = name;
        // Do NOT update base product description from store context; handled at store level
        if (unit !== undefined) productUpdates.unit = unit;
        if (category !== undefined) {
            const categoryRow = await DatabaseService.getProductCategoryByName(category);
            if (!categoryRow) {
                return res.status(400).json({ error: 'Invalid product category provided' });
            }
            productUpdates.category_id = categoryRow.id;
        }

        if (Object.keys(productUpdates).length > 0) {
            await DatabaseService.updateProduct(existingProduct.product_id, productUpdates);
        }
        // Return flattened, joined representation
        const joined = await DatabaseService.getStoreProductById(id);
        res.json(serializeDoc(joined));
    } catch (error) {
        console.error('Error updating store product:', error);
        res.status(500).json({ error: 'Failed to update store product' });
    }
}));

// Delete a store product - DELETE /store_products/:productId
router.delete('/:productId', authenticate, asyncHandler(async (req, res) => {
    const { productId } = req.params;

    try {
        const id = validateUUID(productId);
        
        // Check if store product exists
        const existingProduct = await DatabaseService.getStoreProductById(id);
        if (!existingProduct) {
            return res.status(404).json({ error: 'Store product not found' });
        }

        await DatabaseService.deleteStoreProduct(id);
        res.json({ message: 'Store product deleted successfully' });
    } catch (error) {
        console.error('Error deleting store product:', error);
        res.status(500).json({ error: 'Failed to delete store product' });
    }
}));

// Toggle store product availability - PATCH /store_products/:productId/toggle
router.patch('/:productId/toggle', authenticate, asyncHandler(async (req, res) => {
    const { productId } = req.params;

    try {
        const id = validateUUID(productId);
        
        // Check if store product exists
        const existingProduct = await DatabaseService.getStoreProductById(id);
        if (!existingProduct) {
            return res.status(404).json({ error: 'Store product not found' });
        }

        const updated = await DatabaseService.updateStoreProduct(id, {
            is_available: !existingProduct.is_available
        });
        // Return flattened, joined representation
        const joined = await DatabaseService.getStoreProductById(id);
        
        res.json(serializeDoc(joined));
    } catch (error) {
        console.error('Error toggling store product availability:', error);
        res.status(500).json({ error: 'Failed to toggle store product availability' });
    }
}));

// Explicit publish endpoint - PATCH /store_products/:productId/publish
router.patch('/:productId/publish', authenticate, asyncHandler(async (req, res) => {
    const { productId } = req.params;

    try {
        const id = validateUUID(productId);
        const existingProduct = await DatabaseService.getStoreProductById(id);
        if (!existingProduct) {
            return res.status(404).json({ error: 'Store product not found' });
        }

        const updated = await DatabaseService.updateStoreProduct(id, { is_available: true });
        const joined = await DatabaseService.getStoreProductById(id);
        res.json(serializeDoc(joined));
    } catch (error) {
        console.error('Error publishing store product:', error);
        res.status(500).json({ error: 'Failed to publish store product' });
    }
}));

// Explicit unpublish endpoint - PATCH /store_products/:productId/unpublish
router.patch('/:productId/unpublish', authenticate, asyncHandler(async (req, res) => {
    const { productId } = req.params;

    try {
        const id = validateUUID(productId);
        const existingProduct = await DatabaseService.getStoreProductById(id);
        if (!existingProduct) {
            return res.status(404).json({ error: 'Store product not found' });
        }

        const updated = await DatabaseService.updateStoreProduct(id, { is_available: false });
        const joined = await DatabaseService.getStoreProductById(id);
        res.json(serializeDoc(joined));
    } catch (error) {
        console.error('Error unpublishing store product:', error);
        res.status(500).json({ error: 'Failed to unpublish store product' });
    }
}));

module.exports = router;