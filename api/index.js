/**
 * Main API handler for Vercel serverless deployment
 * This file handles all API routes in a serverless environment
 */

const express = require('express');
const { testConnection } = require('../src/config/database');
const coreHandler = require('../src/routes/core');
const authHandler = require('../src/routes/auth');
// PostgreSQL migration complete for these handlers
const productsHandler = require('../src/routes/products');
const storeProductsHandler = require('../src/routes/store_products');
const farmsHandler = require('../src/routes/farms');
const productCategoriesHandler = require('../src/routes/product_categories');
const managementHandler = require('../src/routes/management');
const statsHandler = require('../src/routes/stats');
// const adminHandler = require('../src/routes/admin');
// const expensesHandler = require('../src/routes/expenses');
// const investmentsHandler = require('../src/routes/investments');

const app = express();

// Middleware
app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Database Connection Middleware (run once to verify connectivity)
let hasTestedDb = false;
app.use(async (req, res, next) => {
  try {
    if (!hasTestedDb) {
      await testConnection();
      hasTestedDb = true;
    }
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route handlers
// Mount specific, modernized handlers FIRST so they take precedence over legacy core routes
app.use('/api/auth', authHandler);
app.use('/api/products', productsHandler);
app.use('/api/store_products', storeProductsHandler);
app.use('/api/farms', farmsHandler);
app.use('/api/product_categories', productCategoriesHandler);
// Management/finance routes (expenses, expense_types, investments)
app.use('/api', managementHandler);
// Mount legacy core router LAST to avoid overlapping routes shadowing the newer implementations
app.use('/api', coreHandler);
app.use('/api/stats', statsHandler);
// app.use('/api/admin', adminHandler);
// app.use('/api/expenses', expensesHandler);
// app.use('/api/investments', investmentsHandler);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    message: 'The requested endpoint does not exist.'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

module.exports = (req, res) => app(req, res);