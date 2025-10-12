/**
 * Store Products API endpoints for Vercel serverless deployment
 * Handles store product operations for the marketplace
 */

const { connectToDatabase, getCollections } = require('../src/config/database');
const { ObjectId } = require('mongodb');
const { serializeDoc } = require('../src/utils/helpers');

// Serverless function handler
module.exports = async (req, res) => {
  // Set CORS headers - allow all origins for development
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Connect to database
    await connectToDatabase();
    const { store_products, products, farms } = await getCollections();

    const { method, url } = req;
    const path = url.replace('/api/store_products', '').replace('/store_products', '');

    // Route handling
    if (method === 'GET' && (path === '' || path === '/')) {
      return await handleGetStoreProducts(req, res, store_products, products, farms);
    }
    
    if (method === 'POST' && (path === '' || path === '/')) {
      return await handleCreateStoreProduct(req, res, store_products);
    }

    if (method === 'GET' && path.startsWith('/')) {
      const id = path.substring(1);
      return await handleGetStoreProduct(req, res, store_products, products, farms, id);
    }

    if (method === 'PUT' && path.startsWith('/')) {
      const id = path.substring(1);
      return await handleUpdateStoreProduct(req, res, store_products, id);
    }

    if (method === 'DELETE' && path.startsWith('/')) {
      const id = path.substring(1);
      return await handleDeleteStoreProduct(req, res, store_products, id);
    }

    // If no route matches
    return res.status(404).json({ 
      error: 'Store products endpoint not found',
      path: path,
      method: method
    });

  } catch (error) {
    console.error('Store Products API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Get store products handler with aggregation
async function handleGetStoreProducts(req, res, store_products, products, farms) {
  const { 
    page = 1, 
    limit = 1000, 
    search = '', 
    category = '', 
    farm_id = '',
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

  // Add sort
  const sortObj = {};
  if (sort === 'price') {
    sortObj['store_price'] = order === 'desc' ? -1 : 1;
  } else {
    sortObj[sort] = order === 'desc' ? -1 : 1;
  }
  pipeline.push({ $sort: sortObj });

  // Get total count
  const countPipeline = [...pipeline, { $count: 'total' }];
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
    discount_percentage = 0
  } = req.body;

  if (!product_id || !farm_id || !store_price) {
    return res.status(400).json({ 
      error: 'Product ID, farm ID, and store price are required' 
    });
  }

  const newStoreProduct = {
    product_id: new ObjectId(product_id),
    farm_id: new ObjectId(farm_id),
    store_price: parseFloat(store_price),
    store_stock_quantity: parseInt(store_stock_quantity),
    is_featured,
    discount_percentage: parseFloat(discount_percentage),
    created_at: new Date(),
    updated_at: new Date()
  };

  const result = await store_products.insertOne(newStoreProduct);

  return res.status(201).json({
    message: 'Store product created successfully',
    storeProductId: result.insertedId,
    store_product: serializeDoc({ _id: result.insertedId, ...newStoreProduct })
  });
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
    { $unwind: { path: '$farm', preserveNullAndEmptyArrays: true } }
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