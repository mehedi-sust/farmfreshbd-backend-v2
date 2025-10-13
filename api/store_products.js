/**
 * Store Products API endpoints
 * Handles store product operations for the marketplace
 */

const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { ObjectId } = require('mongodb');
const { asyncHandler, serializeDoc } = require('../src/utils/helpers');

const router = express.Router();

// Get all store products (public endpoint - only published products)
router.get('/', asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { store_products, products, farms } = await getCollections(db);
  // Default to only published products for public store access
  if (!req.query.is_published) {
    req.query.is_published = 'true';
  }
  return await handleGetStoreProducts(req, res, store_products, products, farms);
}));

// Create store product
router.post('/', asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { store_products } = await getCollections(db);
  return await handleCreateStoreProduct(req, res, store_products);
}));

// Get store product by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { store_products, products, farms } = await getCollections(db);
  return await handleGetStoreProduct(req, res, store_products, products, farms, req.params.id);
}));

// Update store product
router.put('/:id', asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { store_products } = await getCollections(db);
  return await handleUpdateStoreProduct(req, res, store_products, req.params.id);
}));

// Get available products for a farm (products not yet in store)
router.get('/farm/:farmId/available_products', asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { store_products, products } = await getCollections(db);
  return await handleGetAvailableProducts(req, res, store_products, products, req.params.farmId);
}));

// Get store products for a specific farm
router.get('/farm/:farmId', asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { store_products, products, farms } = await getCollections(db);
  return await handleGetFarmStoreProducts(req, res, store_products, products, farms, req.params.farmId);
}));

// Delete store product
router.delete('/:id', asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { store_products } = await getCollections(db);
  return await handleDeleteStoreProduct(req, res, store_products, req.params.id);
}));

// Publish store product
router.patch('/:id/publish', asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { store_products } = await getCollections(db);
  return await handlePublishStoreProduct(req, res, store_products, req.params.id);
}));

// Unpublish store product
router.patch('/:id/unpublish', asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { store_products } = await getCollections(db);
  return await handleUnpublishStoreProduct(req, res, store_products, req.params.id);
}));

// Get store products handler with aggregation
async function handleGetStoreProducts(req, res, store_products, products, farms) {
  const { 
    page = 1, 
    limit = 1000, 
    search = '', 
    category = '', 
    farm_id = '',
    is_published = '',
    sort = 'created_at',
    order = 'desc',
    min_price = 0,
    max_price = 999999
  } = req.query;

  // Build match stage for aggregation
  const matchStage = {
    store_price: { $gte: parseFloat(min_price), $lte: parseFloat(max_price) }
  };

  if (farm_id) {
    matchStage.farm_id = new ObjectId(farm_id);
  }

  if (is_published !== '') {
    matchStage.is_published = is_published === 'true';
  }

  // Build aggregation pipeline
  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: 'products',
        localField: 'product_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    {
      $lookup: {
        from: 'farms',
        localField: 'farm_id',
        foreignField: '_id',
        as: 'farm'
      }
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$farm', preserveNullAndEmptyArrays: true } }
  ];

  // Add search filter
  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { 'product.name': { $regex: search, $options: 'i' } },
          { 'product.description': { $regex: search, $options: 'i' } },
          { 'farm.name': { $regex: search, $options: 'i' } }
        ]
      }
    });
  }

  // Add category filter
  if (category) {
    pipeline.push({
      $match: { 'product.category': category }
    });
  }

  // Add projection to flatten structure for frontend compatibility
  pipeline.push({
    $project: {
      _id: 1,
      product_id: 1,
      farm_id: 1,
      store_price: 1,
      store_stock_quantity: 1,
      is_featured: 1,
      discount_percentage: 1,
      is_published: 1,
      created_at: 1,
      updated_at: 1,
      // Flatten structure for frontend compatibility - prioritize stored fields over joined fields
      product_name: { $ifNull: ['$name', '$product.name'] },
      product_image_url: { $ifNull: ['$product_image_url', '$product.product_image_url'] },
      category: { $ifNull: ['$category', '$product.category'] },
      product_type: '$product.type',
      description: { $ifNull: ['$description', '$product.description'] },
      unit: { $ifNull: ['$unit', '$product.unit'] },
      farm_name: '$farm.name',
      farm_location: '$farm.location',
      farm_address: '$farm.address',
      // Legacy field mappings for backward compatibility
      price: '$store_price',
      is_available: { $gt: ['$store_stock_quantity', 0] },
      product_quantity: '$store_stock_quantity',
      // Keep nested structure for new components - prioritize stored fields
      product: {
        _id: '$product._id',
        name: { $ifNull: ['$name', '$product.name'] },
        type: '$product.type',
        category: { $ifNull: ['$category', '$product.category'] },
        description: { $ifNull: ['$description', '$product.description'] },
        product_image_url: { $ifNull: ['$product_image_url', '$product.product_image_url'] },
        unit: { $ifNull: ['$unit', '$product.unit'] }
      },
      farm: {
        _id: '$farm._id',
        name: '$farm.name',
        location: '$farm.location',
        address: '$farm.address'
      }
    }
  });

  // Add sort
  const sortObj = {};
  if (sort === 'price') {
    sortObj['store_price'] = order === 'desc' ? -1 : 1;
  } else {
    sortObj[sort] = order === 'desc' ? -1 : 1;
  }
  pipeline.push({ $sort: sortObj });

  // Get total count (before projection for accurate counting)
  const countPipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: 'products',
        localField: 'product_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    {
      $lookup: {
        from: 'farms',
        localField: 'farm_id',
        foreignField: '_id',
        as: 'farm'
      }
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$farm', preserveNullAndEmptyArrays: true } }
  ];

  // Add search filter to count pipeline
  if (search) {
    countPipeline.push({
      $match: {
        $or: [
          { 'product.name': { $regex: search, $options: 'i' } },
          { 'product.description': { $regex: search, $options: 'i' } },
          { 'farm.name': { $regex: search, $options: 'i' } }
        ]
      }
    });
  }

  // Add category filter to count pipeline
  if (category) {
    countPipeline.push({
      $match: { 'product.category': category }
    });
  }

  countPipeline.push({ $count: 'total' });
  const countResult = await store_products.aggregate(countPipeline).toArray();
  const total = countResult.length > 0 ? countResult[0].total : 0;

  // Add pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: parseInt(limit) });

  const storeProductsList = await store_products.aggregate(pipeline).toArray();

  return res.status(200).json({
    store_products: storeProductsList.map(serializeDoc),
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalProducts: total,
      productsPerPage: parseInt(limit)
    }
  });
}

// Create store product handler
async function handleCreateStoreProduct(req, res, store_products) {
  const {
    product_id,
    farm_id,
    store_price,
    store_stock_quantity = 0,
    is_featured = false,
    discount_percentage = 0,
    // Product information fields
    name,
    description,
    product_image_url,
    category,
    unit
  } = req.body;

  if (!product_id || !farm_id || !store_price) {
    return res.status(400).json({ 
      error: 'Product ID, farm ID, and store price are required' 
    });
  }

  if (store_stock_quantity <= 0) {
    return res.status(400).json({ 
      error: 'Store stock quantity must be greater than 0' 
    });
  }

  try {
    const { db } = await connectToDatabase();
    const { products } = await getCollections(db);

    // Get the original product to check available quantity
    const originalProduct = await products.findOne({ _id: new ObjectId(product_id) });
    
    if (!originalProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (originalProduct.farm_id.toString() !== farm_id) {
      return res.status(403).json({ error: 'Product does not belong to this farm' });
    }

    // Check if product has sufficient stock
    if (originalProduct.quantity <= 0 || originalProduct.product_status === 'sold') {
      return res.status(400).json({ error: 'Product is out of stock or already sold' });
    }

    // Get existing store products for this product to calculate total allocated quantity
    const existingStoreProducts = await store_products.find({
      product_id: new ObjectId(product_id)
    }).toArray();

    const totalAllocatedQuantity = existingStoreProducts.reduce((sum, sp) => sum + sp.store_stock_quantity, 0);
    const availableQuantity = originalProduct.quantity - totalAllocatedQuantity;

    if (store_stock_quantity > availableQuantity) {
      return res.status(400).json({ 
        error: `Insufficient stock. Available: ${availableQuantity}, Requested: ${store_stock_quantity}. Total product stock: ${originalProduct.quantity}, Already allocated: ${totalAllocatedQuantity}` 
      });
    }

    const newStoreProduct = {
      product_id: new ObjectId(product_id),
      farm_id: new ObjectId(farm_id),
      store_price: parseFloat(store_price),
      store_stock_quantity: parseInt(store_stock_quantity),
      is_featured,
      discount_percentage: parseFloat(discount_percentage),
      is_published: true, // Default to published when creating
      // Product information fields
      name: name || '',
      description: description || '',
      product_image_url: product_image_url || '',
      category: category || 'other',
      unit: unit || 'piece',
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await store_products.insertOne(newStoreProduct);

    return res.status(201).json({
      message: 'Store product created successfully',
      storeProductId: result.insertedId,
      store_product: serializeDoc({ _id: result.insertedId, ...newStoreProduct }),
      stock_info: {
        original_product_stock: originalProduct.quantity,
        total_allocated: totalAllocatedQuantity + store_stock_quantity,
        remaining_available: availableQuantity - store_stock_quantity
      }
    });
  } catch (error) {
    return res.status(400).json({ 
      error: 'Invalid data format: ' + error.message 
    });
  }
}

// Get single store product handler
async function handleGetStoreProduct(req, res, store_products, products, farms, id) {
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid store product ID' });
  }

  const pipeline = [
    { $match: { _id: new ObjectId(id) } },
    {
      $lookup: {
        from: 'products',
        localField: 'product_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    {
      $lookup: {
        from: 'farms',
        localField: 'farm_id',
        foreignField: '_id',
        as: 'farm'
      }
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$farm', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        product_id: 1,
        farm_id: 1,
        store_price: 1,
        store_stock_quantity: 1,
        is_featured: 1,
        discount_percentage: 1,
        created_at: 1,
        updated_at: 1,
        // Flatten structure for frontend compatibility - prioritize stored fields
        product_name: { $ifNull: ['$name', '$product.name'] },
        product_image_url: { $ifNull: ['$product_image_url', '$product.product_image_url'] },
        category: { $ifNull: ['$category', '$product.category'] },
        product_type: '$product.type',
        description: { $ifNull: ['$description', '$product.description'] },
        unit: { $ifNull: ['$unit', '$product.unit'] },
        farm_name: '$farm.name',
        farm_location: '$farm.location',
        farm_address: '$farm.address',
        // Legacy field mappings for backward compatibility
        price: '$store_price',
        is_available: { $gt: ['$store_stock_quantity', 0] },
        product_quantity: '$store_stock_quantity',
        // Keep nested structure for new components - prioritize stored fields
        product: {
          _id: '$product._id',
          name: { $ifNull: ['$name', '$product.name'] },
          type: '$product.type',
          category: { $ifNull: ['$category', '$product.category'] },
          description: { $ifNull: ['$description', '$product.description'] },
          product_image_url: { $ifNull: ['$product_image_url', '$product.product_image_url'] },
          unit: { $ifNull: ['$unit', '$product.unit'] }
        },
        farm: {
          _id: '$farm._id',
          name: '$farm.name',
          location: '$farm.location',
          address: '$farm.address'
        }
      }
    }
  ];

  const result = await store_products.aggregate(pipeline).toArray();
  
  if (result.length === 0) {
    return res.status(404).json({ error: 'Store product not found' });
  }

  return res.status(200).json({
    store_product: serializeDoc(result[0])
  });
}

// Update store product handler
async function handleUpdateStoreProduct(req, res, store_products, id) {
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid store product ID' });
  }

  const updateData = { ...req.body };
  delete updateData._id; // Remove _id if present
  updateData.updated_at = new Date();

  // Convert ObjectIds if present
  if (updateData.product_id) {
    updateData.product_id = new ObjectId(updateData.product_id);
  }
  if (updateData.farm_id) {
    updateData.farm_id = new ObjectId(updateData.farm_id);
  }

  const result = await store_products.updateOne(
    { _id: new ObjectId(id) },
    { $set: updateData }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: 'Store product not found' });
  }

  return res.status(200).json({
    message: 'Store product updated successfully',
    modifiedCount: result.modifiedCount
  });
}

// Delete store product handler
async function handleDeleteStoreProduct(req, res, store_products, id) {
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid store product ID' });
  }

  const result = await store_products.deleteOne({ _id: new ObjectId(id) });

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: 'Store product not found' });
  }

  return res.status(200).json({
    message: 'Store product deleted successfully'
  });
}

// Get available products for a farm (products that can be added to store)
async function handleGetAvailableProducts(req, res, store_products, products, farmId) {
  if (!ObjectId.isValid(farmId)) {
    return res.status(400).json({ error: 'Invalid farm ID' });
  }

  try {
    // Get all products for this farm that have stock > 0
    const farmProducts = await products.find({
      farm_id: new ObjectId(farmId),
      quantity: { $gt: 0 },
      product_status: { $ne: 'sold' }
    }).toArray();

    // Get all store products for this farm to calculate allocated quantities
    const storeProducts = await store_products.find({
      farm_id: new ObjectId(farmId)
    }).toArray();

    // Calculate allocated quantities per product
    const allocatedQuantities = {};
    storeProducts.forEach(sp => {
      const productId = sp.product_id.toString();
      allocatedQuantities[productId] = (allocatedQuantities[productId] || 0) + sp.store_stock_quantity;
    });

    // Add available quantity information to each product
    const availableProducts = farmProducts.map(product => {
      const productId = product._id.toString();
      const allocatedQuantity = allocatedQuantities[productId] || 0;
      const availableQuantity = product.quantity - allocatedQuantity;
      
      return {
        ...serializeDoc(product),
        allocated_to_store: allocatedQuantity,
        available_for_store: Math.max(0, availableQuantity),
        can_add_to_store: availableQuantity > 0
      };
    }).filter(product => product.available_for_store > 0); // Only show products with available stock

    return res.status(200).json({
      available_products: availableProducts
    });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to fetch available products: ' + error.message 
    });
  }
}

// Get store products for a specific farm
async function handleGetFarmStoreProducts(req, res, store_products, products, farms, farmId) {
  if (!ObjectId.isValid(farmId)) {
    return res.status(400).json({ error: 'Invalid farm ID' });
  }

  try {
    const pipeline = [
      { $match: { farm_id: new ObjectId(farmId) } },
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $lookup: {
          from: 'farms',
          localField: 'farm_id',
          foreignField: '_id',
          as: 'farm'
        }
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$farm', preserveNullAndEmptyArrays: true } },
      { $sort: { created_at: -1 } }
    ];

    const farmStoreProducts = await store_products.aggregate(pipeline).toArray();

    return res.status(200).json({
      store_products: farmStoreProducts.map(serializeDoc)
    });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to fetch farm store products: ' + error.message 
    });
  }
}

// Publish store product handler
async function handlePublishStoreProduct(req, res, store_products, id) {
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid store product ID' });
  }

  try {
    const result = await store_products.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          is_published: true,
          updated_at: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Store product not found' });
    }

    return res.status(200).json({
      message: 'Store product published successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to publish store product: ' + error.message 
    });
  }
}

// Unpublish store product handler
async function handleUnpublishStoreProduct(req, res, store_products, id) {
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid store product ID' });
  }

  try {
    const result = await store_products.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          is_published: false,
          updated_at: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Store product not found' });
    }

    return res.status(200).json({
      message: 'Store product unpublished successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to unpublish store product: ' + error.message 
    });
  }
}

module.exports = router;