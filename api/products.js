const express = require('express');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDocs, serializeDoc, toInteger, validateUUID } = require('../src/utils/helpers');
const DatabaseService = require('../src/services/database.service');

const router = express.Router();

// Create a new product - POST /products
router.post('/', authenticate, asyncHandler(async (req, res) => {
    const { 
        name, 
        description, 
        unit, 
        farm_id, 
        quantity, 
        total_price, 
        batch_name, 
        product_type 
    } = req.body;

    if (!name || !farm_id || !quantity || total_price === undefined || !batch_name) {
        return res.status(400).json({ 
            error: 'name, farm_id, quantity, total_price, and batch_name are required' 
        });
    }

    if (quantity <= 0) {
        return res.status(400).json({ 
            error: 'quantity must be greater than 0' 
        });
    }

    if (total_price < 0) {
        return res.status(400).json({ 
            error: 'total_price cannot be negative' 
        });
    }

    // Validate that quantity and total_price are valid numbers
    const parsedQuantity = typeof quantity === 'number' ? quantity : parseInt(quantity, 10);
    const parsedTotalPrice = typeof total_price === 'number' ? total_price : parseFloat(total_price);
    
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
        return res.status(400).json({ 
            error: 'quantity must be a valid positive number' 
        });
    }
    
    if (isNaN(parsedTotalPrice) || parsedTotalPrice < 0) {
        return res.status(400).json({ 
            error: 'total_price must be a valid non-negative number' 
        });
    }

    // Validate product_type enum
    const validTypes = ['animal', 'fish', 'crop', 'others', 'produce'];
    if (product_type && !validTypes.includes(product_type)) {
        return res.status(400).json({ 
            error: `Invalid product_type. Must be one of: ${validTypes.join(', ')}` 
        });
    }

    try {
        // Verify farm exists
        const farm = await DatabaseService.getFarmById(farm_id);
        if (!farm) {
            return res.status(404).json({ error: 'Farm not found' });
        }

        const productData = {
            name,
            description: description || null,
            unit: unit || 'piece',
            farm_id: farm_id,
            quantity: parsedQuantity,
            total_price: parsedTotalPrice,
            batch_name: batch_name,
            product_type: product_type || 'others',
            status: 'unsold'
        };

        const created = await DatabaseService.createProduct(productData);
        res.status(201).json(serializeDoc(created));
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
}));

// Get all products - GET /products
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { farm_id, product_type, status, batch_name, skip = 0, limit = 100 } = req.query;

    try {
        const filters = {
            farm_id: farm_id || null,
            product_type: product_type || null,
            status: status || null,
            batch_name: batch_name || null,
            skip: parseInt(skip),
            limit: parseInt(limit)
        };

        const products = await DatabaseService.getProducts(filters);

        console.log(`🔍 Products query result for farm_id ${farm_id}:`, products.length, 'products found');
        if (products.length > 0) {
            console.log('📦 Sample product:', JSON.stringify(products[0], null, 2));
        }

        res.json(serializeDocs(products));
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
}));

// Get products grouped by batch - GET /products/farm/:farm_id/batches
router.get('/farm/:farm_id/batches', authenticate, asyncHandler(async (req, res) => {
    const { farm_id } = req.params;

    try {
        // Verify farm exists (farm_id is UUID)
        const farm = await DatabaseService.getFarmById(farm_id);
        if (!farm) {
            return res.status(404).json({ error: 'Farm not found' });
        }

        const batchGroups = await DatabaseService.getProductsGroupedByBatch(farm_id);
        
        console.log(`🔍 Products grouped by batch for farm_id ${farm_id}:`, batchGroups.length, 'batch groups found');
        if (batchGroups.length > 0) {
            console.log('📦 Sample batch group:', JSON.stringify(batchGroups[0], null, 2));
        }

        res.json(serializeDocs(batchGroups));
    } catch (error) {
        console.error('Error fetching products grouped by batch:', error);
        res.status(500).json({ error: 'Failed to fetch products grouped by batch' });
    }
}));

// Get products by farm - GET /products/farm/:farm_id
router.get('/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
    const { farm_id } = req.params;
    const { category_id, skip = 0, limit = 100 } = req.query;

    try {
        // Verify farm exists (farm_id is UUID)
        const farm = await DatabaseService.getFarmById(farm_id);
        if (!farm) {
            return res.status(404).json({ error: 'Farm not found' });
        }

        const filters = { farm_id: farm_id };
        if (category_id) {
            filters.category_id = validateUUID(category_id);
        }

        const products = await DatabaseService.getProducts(filters, {
            offset: parseInt(skip),
            limit: parseInt(limit)
        });

        res.json(serializeDocs(products));
    } catch (error) {
        console.error('Error fetching farm products:', error);
        res.status(500).json({ error: 'Failed to fetch farm products' });
    }
}));

// Get product by ID - GET /products/:product_id
router.get('/:product_id', authenticate, asyncHandler(async (req, res) => {
    const { product_id } = req.params;

    try {
        const productId = validateUUID(product_id);
        const product = await DatabaseService.getProductById(productId);

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(serializeDoc(product));
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
}));

// Update product - PUT /products/:product_id
router.put('/:product_id', authenticate, asyncHandler(async (req, res) => {
    const { product_id } = req.params;
    const { 
        name, 
        description, 
        unit, 
        category_id,
        product_type,
        quantity,
        total_price,
        batch_name
    } = req.body;

    try {
        const productId = validateUUID(product_id);

        // Check if product exists
        const existingProduct = await DatabaseService.getProductById(productId);
        if (!existingProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Verify category exists if provided
        if (category_id) {
            const categoryIdValidated = validateUUID(category_id);
            const category = await DatabaseService.getProductCategoryById(categoryIdValidated);
            if (!category) {
                return res.status(404).json({ error: 'Product category not found' });
            }
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (unit !== undefined) updateData.unit = unit;
        if (category_id !== undefined) updateData.category_id = validateUUID(category_id);

        // Validate and set product_type if provided
        if (product_type !== undefined) {
            const validTypes = ['animal', 'fish', 'crop', 'others', 'produce'];
            if (!validTypes.includes(product_type)) {
                return res.status(400).json({ 
                    error: `Invalid product_type. Must be one of: ${validTypes.join(', ')}` 
                });
            }
            updateData.product_type = product_type;
        }

        // Parse and validate quantity/total_price
        let parsedQuantity;
        let parsedTotalPrice;

        if (quantity !== undefined) {
            parsedQuantity = typeof quantity === 'number' ? quantity : parseInt(quantity, 10);
            if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
                return res.status(400).json({ error: 'quantity must be a valid positive number' });
            }
            updateData.quantity = parsedQuantity;
        }

        if (total_price !== undefined) {
            parsedTotalPrice = typeof total_price === 'number' ? total_price : parseFloat(total_price);
            if (isNaN(parsedTotalPrice) || parsedTotalPrice < 0) {
                return res.status(400).json({ error: 'total_price must be a valid non-negative number' });
            }
            updateData.total_price = parsedTotalPrice;
        }

        // Derive unit_price when both quantity and total_price are provided
        if (updateData.quantity !== undefined && updateData.total_price !== undefined) {
            updateData.unit_price = updateData.total_price / updateData.quantity;
        }

        // Map batch_name if provided
        if (batch_name !== undefined) {
            if (typeof batch_name !== 'string' || batch_name.trim().length === 0) {
                return res.status(400).json({ error: 'batch_name must be a non-empty string' });
            }
            updateData.batch_name = batch_name.trim();
        }

        const updated = await DatabaseService.updateProduct(productId, updateData);
        res.json(serializeDoc(updated));
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
}));

// Delete product - DELETE /products/:product_id
router.delete('/:product_id', authenticate, asyncHandler(async (req, res) => {
    const { product_id } = req.params;

    try {
        console.log(`[${new Date().toISOString()}] DELETE /api/products/${product_id}`);
        if (req.user) {
            console.log('Authenticated user:', { userId: req.user.userId, role: req.user.role });
        }
        const productId = validateUUID(product_id);
        
        // Check if product exists
        const existingProduct = await DatabaseService.getProductById(productId);
        if (!existingProduct) {
            console.log('Product not found for deletion:', { productId });
            return res.status(404).json({ error: 'Product not found' });
        }

        await DatabaseService.deleteProduct(productId);
        console.log('✅ Product deleted successfully:', { productId });
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
}));

// Create product batch - POST /products/batches
router.post('/batches', authenticate, asyncHandler(async (req, res) => {
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
    } = req.body;

    try {
        // Validate required fields
        if (!product_id || !quantity || !unit_price) {
            return res.status(400).json({ error: 'product_id, quantity, and unit_price are required' });
        }

        // Validate product_id format
        const productIdValidated = validateUUID(product_id);

        // Verify product exists and get farm_id for ownership check
        const product = await DatabaseService.getProductById(productIdValidated);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Verify farm ownership
        const hasAccess = await DatabaseService.verifyFarmOwnership(product.farm_id, req.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this farm' });
        }

        const batchData = {
            product_id: productIdValidated,
            batch_number,
            quantity: parseFloat(quantity),
            unit_price: parseFloat(unit_price),
            production_date,
            expiry_date,
            harvest_date,
            quality_grade,
            storage_location,
            notes
        };

        const batch = await DatabaseService.createProductBatch(batchData);
        res.status(201).json(serializeDoc(batch));
    } catch (error) {
        console.error('Error creating product batch:', error);
        res.status(500).json({ error: 'Failed to create product batch' });
    }
}));

// Get product batches by farm - GET /products/farms/:farm_id/product_batches
router.get('/farms/:farm_id/product_batches', authenticate, asyncHandler(async (req, res) => {
    const { farm_id } = req.params;
    const { product_id, skip = 0, limit = 100 } = req.query;

    try {
        // Verify farm exists (farm_id is UUID)
        const farm = await DatabaseService.getFarmById(farm_id);
        if (!farm) {
            return res.status(404).json({ error: 'Farm not found' });
        }

        const filters = { farm_id: farm_id };
        if (product_id) {
            filters.product_id = validateUUID(product_id);
        }

        const batches = await DatabaseService.getProductBatches(filters, {
            offset: parseInt(skip),
            limit: parseInt(limit)
        });

        res.json(serializeDocs(batches));
    } catch (error) {
        console.error('Error fetching product batches:', error);
        res.status(500).json({ error: 'Failed to fetch product batches' });
    }
}));

// Get batch summaries with expense calculations - GET /products/batches/farm/:farm_id/summary
router.get('/batches/farm/:farm_id/summary', authenticate, asyncHandler(async (req, res) => {
    const { farm_id } = req.params;
    const { skip = 0, limit = 100 } = req.query;

    try {
        // Verify farm exists (farm_id is UUID, no conversion needed)
        const farm = await DatabaseService.getFarmById(farm_id);
        if (!farm) {
            return res.status(404).json({ error: 'Farm not found' });
        }

        // Get all product batches for the farm
        const batches = await DatabaseService.getProductBatchesByFarmWithFilters(farm_id, {
            skip: toInteger(skip),
            limit: toInteger(limit)
        });

        // Calculate expense data for each batch
        const batchSummaries = await Promise.all(batches.map(async (batch) => {
            const totalExpenses = await DatabaseService.getBatchExpensesTotal(farm_id, batch.batch_number);
            const avgExpensePerUnit = batch.quantity > 0 ? totalExpenses / batch.quantity : 0;
            const minimumSellingPrice = batch.unit_price + avgExpensePerUnit;

            return {
                ...batch,
                total_expenses: totalExpenses,
                avg_expense_per_unit: avgExpensePerUnit,
                minimum_selling_price: minimumSellingPrice,
                total_value: batch.quantity * batch.unit_price,
                potential_profit_per_unit: Math.max(0, minimumSellingPrice * 1.2 - minimumSellingPrice) // 20% markup example
            };
        }));

        res.json({
            success: true,
            data: serializeDocs(batchSummaries),
            pagination: {
                skip: toInteger(skip),
                limit: toInteger(limit),
                total: batchSummaries.length
            }
        });
    } catch (error) {
        console.error('Error fetching batch summaries:', error);
        res.status(500).json({ error: 'Failed to fetch batch summaries' });
    }
}));

// Update product status - PATCH /products/:product_id/status
router.patch('/:product_id/status', authenticate, asyncHandler(async (req, res) => {
    const { product_id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'status is required' });
    }

    const validStatuses = ['sold', 'unsold'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        });
    }

    try {
        const product = await DatabaseService.getProductById(product_id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const updated = await DatabaseService.updateProductStatus(product_id, status);
        res.json(serializeDoc(updated));
    } catch (error) {
        console.error('Error updating product status:', error);
        res.status(500).json({ error: 'Failed to update product status' });
    }
}));

// Get batch names for a farm - GET /products/farm/:farm_id/batch-names
router.get('/farm/:farm_id/batch-names', authenticate, asyncHandler(async (req, res) => {
    const { farm_id } = req.params;

    try {
        const batchNames = await DatabaseService.getBatchNamesByFarm(farm_id);
        res.json(batchNames);
    } catch (error) {
        console.error('Error fetching batch names:', error);
        res.status(500).json({ error: 'Failed to fetch batch names' });
    }
}));

module.exports = router;