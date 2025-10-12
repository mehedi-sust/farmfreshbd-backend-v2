/**
 * @api {get} /api/admin/users Get All Users
 * @apiName GetAllUsers
 * @apiGroup Admin
 * @apiVersion 1.0.0
 * @apiPermission admin
 */

const express = require('express');
const cors = require('cors');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticateAdmin } = require('../src/config/auth');
const { asyncHandler, serializeDoc, toObjectId } = require('../src/utils/helpers');

const app = express();
app.use(cors());
app.use(express.json());

// Get all users with pagination
app.get('/users', authenticateAdmin, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const { db } = await connectToDatabase();
  const { users } = getCollections(db);

  // Build query
  let query = {};
  if (role && role !== 'all') {
    query.role = role;
  }
  if (search) {
    query.email = { $regex: search, $options: 'i' };
  }

  const totalUsers = await users.countDocuments(query);
  const totalPages = Math.ceil(totalUsers / parseInt(limit));

  const userList = await users
    .find(query)
    .project({ hashed_password: 0 }) // Exclude password
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .toArray();

  res.json({
    users: userList.map(serializeDoc),
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalUsers,
      usersPerPage: parseInt(limit)
    }
  });
}));

// Get user by ID
app.get('/users/:userId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const { db } = await connectToDatabase();
  const { users } = getCollections(db);

  const user = await users.findOne(
    { _id: toObjectId(userId) },
    { projection: { hashed_password: 0 } }
  );

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(serializeDoc(user));
}));

// Update user
app.put('/users/:userId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { email, role, is_active, farm_id } = req.body;

  const { db } = await connectToDatabase();
  const { users } = getCollections(db);

  const updateData = {
    updated_at: new Date()
  };

  if (email) updateData.email = email;
  if (role) updateData.role = role;
  if (typeof is_active === 'boolean') updateData.is_active = is_active;
  if (farm_id) updateData.farm_id = toObjectId(farm_id);

  const result = await users.updateOne(
    { _id: toObjectId(userId) },
    { $set: updateData }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const updatedUser = await users.findOne(
    { _id: toObjectId(userId) },
    { projection: { hashed_password: 0 } }
  );

  res.json({
    message: 'User updated successfully',
    user: serializeDoc(updatedUser)
  });
}));

// Delete user and all associated data
app.delete('/users/:userId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const { db } = await connectToDatabase();
  const { 
    users, 
    farms, 
    products, 
    orders, 
    cart, 
    reviews,
    investments,
    expenses,
    sales,
    productBatches,
    expenseTypes,
    storeProducts
  } = getCollections(db);

  // Get user to check if exists and get farm_id
  const user = await users.findOne({ _id: toObjectId(userId) });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Prevent deleting admin users (safety check)
  if (user.role === 'admin') {
    return res.status(403).json({ error: 'Cannot delete admin users' });
  }

  const farmId = user.farm_id;

  // Delete all user-related data
  const deletionResults = {};

  // Delete user's cart items
  deletionResults.cart = await cart.deleteMany({ user_id: toObjectId(userId) });

  // Delete user's reviews
  deletionResults.reviews = await reviews.deleteMany({ user_id: toObjectId(userId) });

  // Delete user's orders
  deletionResults.orders = await orders.deleteMany({ user_id: toObjectId(userId) });

  // If user has a farm, delete all farm-related data
  if (farmId) {
    deletionResults.investments = await investments.deleteMany({ farm_id: farmId });
    deletionResults.expenses = await expenses.deleteMany({ farm_id: farmId });
    deletionResults.sales = await sales.deleteMany({ farm_id: farmId });
    deletionResults.productBatches = await productBatches.deleteMany({ farm_id: farmId });
    deletionResults.expenseTypes = await expenseTypes.deleteMany({ farm_id: farmId });
    deletionResults.products = await products.deleteMany({ farm_id: farmId });
    deletionResults.storeProducts = await storeProducts.deleteMany({ farm_id: farmId });
    deletionResults.farm = await farms.deleteOne({ _id: farmId });
  }

  // Finally, delete the user
  deletionResults.user = await users.deleteOne({ _id: toObjectId(userId) });

  res.json({
    message: 'User and all associated data deleted successfully',
    deletionResults
  });
}));

// Get all farms
app.get('/farms', authenticateAdmin, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const { db } = await connectToDatabase();
  const { farms } = getCollections(db);

  let query = {};
  if (search) {
    query.farm_name = { $regex: search, $options: 'i' };
  }

  const totalFarms = await farms.countDocuments(query);
  const totalPages = Math.ceil(totalFarms / parseInt(limit));

  const farmList = await farms
    .find(query)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .toArray();

  res.json({
    farms: farmList.map(serializeDoc),
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalFarms,
      farmsPerPage: parseInt(limit)
    }
  });
}));

// Get all products across all farms
app.get('/products', authenticateAdmin, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, farm_id } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const { db } = await connectToDatabase();
  const { products } = getCollections(db);

  let query = {};
  if (search) {
    query.product_name = { $regex: search, $options: 'i' };
  }
  if (farm_id) {
    query.farm_id = toObjectId(farm_id);
  }

  const totalProducts = await products.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / parseInt(limit));

  const productList = await products
    .find(query)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .toArray();

  res.json({
    products: productList.map(serializeDoc),
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalProducts,
      productsPerPage: parseInt(limit)
    }
  });
}));

// Get system statistics
app.get('/stats', authenticateAdmin, asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { 
    users, 
    farms, 
    products, 
    orders, 
    storeProducts 
  } = getCollections(db);

  // Get users by role aggregation
  const usersByRoleArray = await users.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } }
  ]).toArray();

  // Convert array to object format expected by frontend
  const users_by_role = {
    admin: 0,
    farmer: 0,
    farm_manager: 0,
    customer: 0,
    service_provider: 0
  };

  usersByRoleArray.forEach(item => {
    if (users_by_role.hasOwnProperty(item._id)) {
      users_by_role[item._id] = item.count;
    }
  });

  const stats = {
    total_users: await users.countDocuments(),
    total_farms: await farms.countDocuments(),
    total_products: await products.countDocuments(),
    total_orders: await orders.countDocuments(),
    total_store_products: await storeProducts.countDocuments(),
    users_by_role,
    recent_users: await users
      .find({})
      .project({ hashed_password: 0 })
      .sort({ created_at: -1 })
      .limit(5)
      .toArray(),
    recent_orders: await orders
      .find({})
      .sort({ created_at: -1 })
      .limit(5)
      .toArray()
  };

  // Serialize the results
  stats.recent_users = stats.recent_users.map(serializeDoc);
  stats.recent_orders = stats.recent_orders.map(serializeDoc);

  res.json(stats);
}));

// User impersonation - Generate token for any user
app.post('/impersonate/:userId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const { db } = await connectToDatabase();
  const { users } = getCollections(db);

  const targetUser = await users.findOne({ _id: toObjectId(userId) });
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { generateToken } = require('../src/config/auth');
  const impersonationToken = generateToken(
    targetUser._id.toString(),
    targetUser.email,
    targetUser.role
  );

  res.json({
    message: 'Impersonation token generated',
    token: impersonationToken,
    user: serializeDoc({
      _id: targetUser._id,
      email: targetUser.email,
      role: targetUser.role,
      farm_id: targetUser.farm_id
    })
  });
}));

// Get all store products for admin management
app.get('/store-products', authenticateAdmin, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, farm_id } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const { db } = await connectToDatabase();
  const { storeProducts } = getCollections(db);

  let matchQuery = {};
  if (search) {
    matchQuery.$or = [
      { name: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } }
    ];
  }
  if (farm_id) {
    matchQuery.farm_id = toObjectId(farm_id);
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $lookup: {
        from: 'products',
        localField: 'product_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'farms',
        localField: 'farm_id',
        foreignField: '_id',
        as: 'farm'
      }
    },
    { $unwind: { path: '$farm', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        name: 1,
        category: 1,
        description: 1,
        selling_price: 1,
        available_stock: 1,
        unit: 1,
        is_published: 1,
        product_image_url: 1,
        farm_name: '$farm.name',
        farm_location: '$farm.location',
        product_name: '$product.product_name',
        created_at: 1,
        updated_at: 1
      }
    },
    { $sort: { created_at: -1 } },
    { $skip: skip },
    { $limit: parseInt(limit) }
  ];

  const totalStoreProducts = await storeProducts.countDocuments(matchQuery);
  const totalPages = Math.ceil(totalStoreProducts / parseInt(limit));

  const storeProductList = await storeProducts.aggregate(pipeline).toArray();

  res.json({
    store_products: storeProductList.map(serializeDoc),
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalStoreProducts,
      storeProductsPerPage: parseInt(limit)
    }
  });
}));

module.exports = app;