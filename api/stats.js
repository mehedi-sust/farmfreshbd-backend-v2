/**
 * Stats API endpoints for Vercel serverless deployment
 * Handles statistics and analytics data
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
    const { users, farms, products, store_products, orders } = await getCollections();

    const { method, url } = req;
    const path = url.replace('/api/stats', '').replace('/stats', '');

    // Route handling
    if (method === 'GET' && (path === '' || path === '/')) {
      return await handleGetOverallStats(req, res, { users, farms, products, store_products, orders });
    }
    
    if (method === 'GET' && path === '/dashboard') {
      return await handleGetDashboardStats(req, res, { users, farms, products, store_products, orders });
    }

    if (method === 'GET' && path === '/users') {
      return await handleGetUserStats(req, res, users);
    }

    if (method === 'GET' && path === '/farms') {
      return await handleGetFarmStats(req, res, farms);
    }

    if (method === 'GET' && path === '/products') {
      return await handleGetProductStats(req, res, products, store_products);
    }

    if (method === 'GET' && path === '/orders') {
      return await handleGetOrderStats(req, res, orders);
    }

    // If no route matches
    return res.status(404).json({ 
      error: 'Stats endpoint not found',
      path: path,
      method: method
    });

  } catch (error) {
    console.error('Stats API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Get overall stats handler
async function handleGetOverallStats(req, res, collections) {
  const { users, farms, products, store_products, orders } = collections;

  const [
    totalUsers,
    totalFarms,
    totalProducts,
    totalStoreProducts,
    totalOrders
  ] = await Promise.all([
    users.countDocuments(),
    farms.countDocuments(),
    products.countDocuments(),
    store_products.countDocuments(),
    orders ? orders.countDocuments() : 0
  ]);

  return res.status(200).json({
    overall_stats: {
      total_users: totalUsers,
      total_farms: totalFarms,
      total_products: totalProducts,
      total_store_products: totalStoreProducts,
      total_orders: totalOrders,
      last_updated: new Date().toISOString()
    }
  });
}

// Get dashboard stats handler
async function handleGetDashboardStats(req, res, collections) {
  const { users, farms, products, store_products, orders } = collections;

  // Get counts
  const [
    totalUsers,
    totalFarms,
    totalProducts,
    totalStoreProducts
  ] = await Promise.all([
    users.countDocuments(),
    farms.countDocuments(),
    products.countDocuments(),
    store_products.countDocuments()
  ]);

  // Get recent users (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentUsers = await users.countDocuments({
    created_at: { $gte: thirtyDaysAgo }
  });

  // Get user role distribution
  const userRoles = await users.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  // Get farm verification status
  const farmVerification = await farms.aggregate([
    {
      $group: {
        _id: '$is_verified',
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  return res.status(200).json({
    dashboard_stats: {
      totals: {
        users: totalUsers,
        farms: totalFarms,
        products: totalProducts,
        store_products: totalStoreProducts
      },
      recent: {
        new_users_last_30_days: recentUsers
      },
      distributions: {
        user_roles: userRoles.map(serializeDoc),
        farm_verification: farmVerification.map(serializeDoc)
      },
      last_updated: new Date().toISOString()
    }
  });
}

// Get user stats handler
async function handleGetUserStats(req, res, users) {
  const { period = '30' } = req.query;
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - parseInt(period));

  const [
    totalUsers,
    recentUsers,
    usersByRole,
    userGrowth
  ] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({ created_at: { $gte: daysAgo } }),
    users.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]).toArray(),
    users.aggregate([
      {
        $match: { created_at: { $gte: daysAgo } }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$created_at'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]).toArray()
  ]);

  return res.status(200).json({
    user_stats: {
      total_users: totalUsers,
      recent_users: recentUsers,
      users_by_role: usersByRole.map(serializeDoc),
      user_growth: userGrowth.map(serializeDoc),
      period_days: parseInt(period)
    }
  });
}

// Get farm stats handler
async function handleGetFarmStats(req, res, farms) {
  const [
    totalFarms,
    verifiedFarms,
    farmsByType,
    farmsByLocation
  ] = await Promise.all([
    farms.countDocuments(),
    farms.countDocuments({ is_verified: true }),
    farms.aggregate([
      {
        $group: {
          _id: '$farm_type',
          count: { $sum: 1 }
        }
      }
    ]).toArray(),
    farms.aggregate([
      {
        $group: {
          _id: '$location',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray()
  ]);

  return res.status(200).json({
    farm_stats: {
      total_farms: totalFarms,
      verified_farms: verifiedFarms,
      unverified_farms: totalFarms - verifiedFarms,
      farms_by_type: farmsByType.map(serializeDoc),
      top_locations: farmsByLocation.map(serializeDoc)
    }
  });
}

// Get product stats handler
async function handleGetProductStats(req, res, products, store_products) {
  const [
    totalProducts,
    totalStoreProducts,
    productsByCategory,
    averagePrice
  ] = await Promise.all([
    products.countDocuments(),
    store_products.countDocuments(),
    products.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]).toArray(),
    store_products.aggregate([
      {
        $group: {
          _id: null,
          average_price: { $avg: '$store_price' }
        }
      }
    ]).toArray()
  ]);

  return res.status(200).json({
    product_stats: {
      total_products: totalProducts,
      total_store_products: totalStoreProducts,
      products_by_category: productsByCategory.map(serializeDoc),
      average_store_price: averagePrice.length > 0 ? averagePrice[0].average_price : 0
    }
  });
}

// Get order stats handler (placeholder)
async function handleGetOrderStats(req, res, orders) {
  if (!orders) {
    return res.status(200).json({
      order_stats: {
        message: 'Orders collection not available',
        total_orders: 0
      }
    });
  }

  const totalOrders = await orders.countDocuments();

  return res.status(200).json({
    order_stats: {
      total_orders: totalOrders
    }
  });
}