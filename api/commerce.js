/**
 * Commerce API - Consolidated endpoint for cart, orders, and sales
 * This consolidation reduces serverless function count for Vercel Hobby plan
 */

const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { verifyToken } = require('../src/config/auth');
const { asyncHandler, serializeDoc } = require('../src/utils/helpers');

const router = express.Router();

// Import individual route handlers
const cartRoutes = require('./cart');
const ordersRoutes = require('./orders');
const salesRoutes = require('./sales');

// Mount routes with proper prefixes
router.use('/cart', cartRoutes);
router.use('/orders', ordersRoutes);
router.use('/sales', salesRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Commerce API is running',
    endpoints: ['cart', 'orders', 'sales']
  });
});

// Handle all requests
module.exports = (req, res) => {
  return router(req, res);
};