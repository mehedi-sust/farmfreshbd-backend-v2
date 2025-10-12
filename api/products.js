/**
 * Products API endpoints for Vercel serverless deployment
 * Handles product CRUD operations
 */

const { connectToDatabase, getCollections } = require('../src/config/database');
const { ObjectId } = require('mongodb');
const { serializeDoc } = require('../src/utils/helpers');

// Serverless function handler
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
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
    const { products } = await getCollections();

    const { method, url } = req;
    const path = url.replace('/api/products', '').replace('/products', '');

    // Route handling
    if (method === 'GET' && (path === '' || path === '/')) {
      return await handleGetProducts(req, res, products);
    }
    
    if (method === 'POST' && (path === '' || path === '/')) {
      return await handleCreateProduct(req, res, products);
    }

    if (method === 'GET' && path.startsWith('/')) {
      const id = path.substring(1);
      return await handleGetProduct(req, res, products, id);
    }

    if (method === 'PUT' && path.startsWith('/')) {
      const id = path.substring(1);
      return await handleUpdateProduct(req, res, products, id);
    }

    if (method === 'DELETE' && path.startsWith('/')) {
      const id = path.substring(1);
      return await handleDeleteProduct(req, res, products, id);
    }

    // If no route matches
    return res.status(404).json({ 
      error: 'Products endpoint not found',
      path: path,
      method: method
    });

  } catch (error) {
    console.error('Products API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Get products handler
async function handleGetProducts(req, res, products) {
  const { 
    page = 1, 
    limit = 20, 
    search = '', 
    category = '', 
    farm_id = '',
    sort = 'created_at',
    order = 'desc'
  } = req.query;

  // Build query
  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  if (category) {
    query.category = category;
  }
  if (farm_id) {
    query.farm_id = new ObjectId(farm_id);
  }

  // Build sort
  const sortObj = {};
  sortObj[sort] = order === 'desc' ? -1 : 1;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const productsList = await products.find(query)
    .sort(sortObj)
    .skip(skip)
    .limit(parseInt(limit))
    .toArray();

  const total = await products.countDocuments(query);

  return res.status(200).json({
    products: productsList.map(serializeDoc),
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalProducts: total,
      productsPerPage: parseInt(limit)
    }
  });
}

// Create product handler
async function handleCreateProduct(req, res, products) {
  const {
    name,
    description,
    price,
    category,
    farm_id,
    stock_quantity = 0,
    unit = 'kg',
    images = [],
    is_organic = false
  } = req.body;

  if (!name || !price || !farm_id) {
    return res.status(400).json({ 
      error: 'Name, price, and farm_id are required' 
    });
  }

  const newProduct = {
    name,
    description,
    price: parseFloat(price),
    category,
    farm_id: new ObjectId(farm_id),
    stock_quantity: parseInt(stock_quantity),
    unit,
    images,
    is_organic,
    created_at: new Date(),
    updated_at: new Date()
  };

  const result = await products.insertOne(newProduct);

  return res.status(201).json({
    message: 'Product created successfully',
    productId: result.insertedId,
    product: serializeDoc({ _id: result.insertedId, ...newProduct })
  });
}

// Get single product handler
async function handleGetProduct(req, res, products, id) {
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  const product = await products.findOne({ _id: new ObjectId(id) });
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  return res.status(200).json({
    product: serializeDoc(product)
  });
}

// Update product handler
async function handleUpdateProduct(req, res, products, id) {
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  const updateData = { ...req.body };
  delete updateData._id; // Remove _id if present
  updateData.updated_at = new Date();

  // Convert farm_id to ObjectId if present
  if (updateData.farm_id) {
    updateData.farm_id = new ObjectId(updateData.farm_id);
  }

  const result = await products.updateOne(
    { _id: new ObjectId(id) },
    { $set: updateData }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }

  return res.status(200).json({
    message: 'Product updated successfully',
    modifiedCount: result.modifiedCount
  });
}

// Delete product handler
async function handleDeleteProduct(req, res, products, id) {
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  const result = await products.deleteOne({ _id: new ObjectId(id) });

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }

  return res.status(200).json({
    message: 'Product deleted successfully'
  });
}