/**
 * Core API - Consolidated endpoint for auth, products, store_products, and farms
 * This consolidation reduces serverless function count for Vercel Hobby plan
 */

const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { generateToken, hashPassword, comparePassword, verifyToken } = require('../src/config/auth');
const { asyncHandler, serializeDoc } = require('../src/utils/helpers');
const { ObjectId } = require('mongodb');

const router = express.Router();

// Import individual route handlers
const authRoutes = require('./auth');
const productsRoutes = require('./products');
const storeProductsRoutes = require('./store_products');
const farmsRoutes = require('./farms');

// Mount routes with proper prefixes
router.use('/auth', authRoutes);
router.use('/products', productsRoutes);
router.use('/store_products', storeProductsRoutes);
router.use('/farms', farmsRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Core API is running',
    endpoints: ['auth', 'products', 'store_products', 'farms']
  });
});

// Handle all requests
module.exports = (req, res) => {
  return router(req, res);
};