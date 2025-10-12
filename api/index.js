/**
 * Main API handler for Vercel serverless deployment
 * This file handles all API routes in a serverless environment
 */

const { connectToDatabase } = require('../src/config/database');

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
    // Test database connection
    await connectToDatabase();

    // API documentation endpoint
    if (req.url === '/' || req.url === '/api') {
      return res.status(200).json({
        name: 'FarmFresh BD API',
        version: '1.0.0',
        description: 'Serverless API for FarmFresh BD platform',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: 'serverless',
        endpoints: {
          auth: '/api/auth/*',
          farms: '/api/farms/*',
          products: '/api/products/*',
          store: '/api/store_products/*',
          cart: '/api/cart/*',
          orders: '/api/orders/*',
          management: '/api/management/*',
          sales: '/api/sales/*',
          stats: '/api/stats/*',
          reviews: '/api/reviews/*',
          admin: '/api/admin/*',
          reports: '/api/reports/*'
        }
      });
    }

    // Health check endpoint
    if (req.url === '/health' || req.url === '/api/health') {
      return res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        environment: 'serverless',
        database: 'connected'
      });
    }

    // If no specific route matches, return 404
    return res.status(404).json({ 
      error: 'Endpoint not found',
      path: req.url,
      method: req.method,
      message: 'Please use specific API endpoints like /api/auth, /api/farms, etc.'
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};