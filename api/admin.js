/**
 * Admin API endpoints for Vercel serverless deployment
 * Handles admin-specific operations
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
    const collections = await getCollections();

    const { method, url } = req;
    const path = url.replace('/api/admin', '').replace('/admin', '');

    // Route handling
    if (method === 'GET' && (path === '/users' || path === '/users/')) {
      return await handleGetUsers(req, res, collections.users);
    }
    
    if (method === 'GET' && (path === '/farms' || path === '/farms/')) {
      return await handleGetFarms(req, res, collections.farms);
    }

    if (method === 'GET' && (path === '/products' || path === '/products/')) {
      return await handleGetProducts(req, res, collections.products);
    }

    if (method === 'GET' && (path === '/store_products' || path === '/store_products/')) {
      return await handleGetStoreProducts(req, res, collections.store_products);
    }

    if (method === 'GET' && (path === '/dashboard' || path === '/dashboard/')) {
      return await handleGetDashboard(req, res, collections);
    }

    if (method === 'PUT' && path.startsWith('/users/')) {
      const id = path.replace('/users/', '');
      return await handleUpdateUser(req, res, collections.users, id);
    }

    if (method === 'DELETE' && path.startsWith('/users/')) {
      const id = path.replace('/users/', '');
      return await handleDeleteUser(req, res, collections.users, id);
    }

    // If no route matches
    return res.status(404).json({ 
      error: 'Admin endpoint not found',
      path: path,
      method: method
    });

  } catch (error) {
    console.error('Admin API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Get users handler (admin)
async function handleGetUsers(req, res, users) {
  const { 
    page = 1, 
    limit = 1000, 
    search = '', 
    role = '',
    sort = 'created_at',
    order = 'desc'
  } = req.query;

  // Build query
  const query = {};
  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } },
      { role: { $regex: search, $options: 'i' } }
    ];
  }
  if (role) {
    query.role = role;
  }

  // Build sort
  const sortObj = {};
  sortObj[sort] = order === 'desc' ? -1 : 1;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const usersList = await users.find(query)
    .sort(sortObj)
    .skip(skip)
    .limit(parseInt(limit))
    .project({ password: 0 }) // Exclude password
    .toArray();

  const total = await users.countDocuments(query);

  return res.status(200).json({
    users: usersList.map(serializeDoc),
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalUsers: total,
      usersPerPage: parseInt(limit)
    }
  });
}

// Get farms handler (admin)
async function handleGetFarms(req, res, farms) {
  const { 
    page = 1, 
    limit = 20, 
    search = '', 
    verified = '',
    sort = 'created_at',
    order = 'desc'
  } = req.query;

  // Build query
  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { owner_name: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } }
    ];
  }
  if (verified !== '') {
    query.is_verified = verified === 'true';
  }

  // Build sort
  const sortObj = {};
  sortObj[sort] = order === 'desc' ? -1 : 1;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const farmsList = await farms.find(query)
    .sort(sortObj)
    .skip(skip)
    .limit(parseInt(limit))
    .toArray();

  const total = await farms.countDocuments(query);

  return res.status(200).json({
    farms: farmsList.map(serializeDoc),
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalFarms: total,
      farmsPerPage: parseInt(limit)
    }
  });
}

// Get products handler (admin)
async function handleGetProducts(req, res, products) {
  const { 
    page = 1, 
    limit = 20, 
    search = '', 
    category = '',
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

// Get store products handler (admin)
async function handleGetStoreProducts(req, res, store_products) {
  const { 
    page = 1, 
    limit = 20, 
    search = '',
    sort = 'created_at',
    order = 'desc'
  } = req.query;

  // Build aggregation pipeline
  const pipeline = [
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
          { 'farm.name': { $regex: search, $options: 'i' } }
        ]
      }
    });
  }

  // Add sort
  const sortObj = {};
  sortObj[sort] = order === 'desc' ? -1 : 1;
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

// Get dashboard stats handler (admin)
async function handleGetDashboard(req, res, collections) {
  const { users, farms, products, store_products } = collections;

  const [
    totalUsers,
    totalFarms,
    totalProducts,
    totalStoreProducts,
    recentUsers,
    verifiedFarms
  ] = await Promise.all([
    users.countDocuments(),
    farms.countDocuments(),
    products.countDocuments(),
    store_products.countDocuments(),
    users.countDocuments({ 
      created_at: { 
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
      } 
    }),
    farms.countDocuments({ is_verified: true })
  ]);

  return res.status(200).json({
    dashboard: {
      totals: {
        users: totalUsers,
        farms: totalFarms,
        products: totalProducts,
        store_products: totalStoreProducts
      },
      recent: {
        new_users_last_30_days: recentUsers
      },
      verification: {
        verified_farms: verifiedFarms,
        unverified_farms: totalFarms - verifiedFarms
      },
      last_updated: new Date().toISOString()
    }
  });
}

// Update user handler (admin)
async function handleUpdateUser(req, res, users, id) {
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const updateData = { ...req.body };
  delete updateData._id; // Remove _id if present
  delete updateData.password; // Don't allow password updates through this endpoint
  updateData.updated_at = new Date();

  const result = await users.updateOne(
    { _id: new ObjectId(id) },
    { $set: updateData }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.status(200).json({
    message: 'User updated successfully',
    modifiedCount: result.modifiedCount
  });
}

// Delete user handler (admin)
async function handleDeleteUser(req, res, users, id) {
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const result = await users.deleteOne({ _id: new ObjectId(id) });

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.status(200).json({
    message: 'User deleted successfully'
  });
}