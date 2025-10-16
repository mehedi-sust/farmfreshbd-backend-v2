const express = require('express');
const { asyncHandler, serializeDocs } = require('../src/utils/helpers');
const DatabaseService = require('../src/services/database.service');

const router = express.Router();

// Get all product categories - GET /product_categories
router.get('/', asyncHandler(async (req, res) => {
  try {
    const categories = await DatabaseService.getProductCategories();
    res.json(serializeDocs(categories));
  } catch (error) {
    console.error('Error fetching product categories:', error);
    res.status(500).json({ error: 'Failed to fetch product categories' });
  }
}));

module.exports = router;