/**
 * Management API - Consolidated endpoint for admin, finance, stats, and reports
 * This consolidation reduces serverless function count for Vercel Hobby plan
 */

const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { verifyToken } = require('../src/config/auth');
const { asyncHandler, serializeDoc } = require('../src/utils/helpers');

const router = express.Router();

// Import individual route handlers
const adminRoutes = require('./admin');
const financeRoutes = require('./finance');
const statsRoutes = require('./stats');
const reportsRoutes = require('./reports');

// Mount routes with proper prefixes
router.use('/admin', adminRoutes);
router.use('/finance', financeRoutes);
router.use('/stats', statsRoutes);
router.use('/reports', reportsRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Management API is running',
    endpoints: ['admin', 'finance', 'stats', 'reports']
  });
});

// Handle all requests
module.exports = (req, res) => {
  return router(req, res);
};