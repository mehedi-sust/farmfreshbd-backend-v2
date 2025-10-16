const express = require('express');
const DatabaseService = require('../services/database.service');
const { query } = require('../config/database');
const { asyncHandler } = require('../utils/helpers');
const { authenticate } = require('../config/auth');

const router = express.Router();

// Helper function to calculate stats
async function calculateFarmStats(farmId) {
  try {
    // Get farm stats using DatabaseService
    const stats = await DatabaseService.getFarmStats(farmId);
    return stats;
  } catch (error) {
    console.error('Error calculating farm stats:', error);
    throw error;
  }
}

// Get farm stats (path param version - what frontend uses)
router.get('/:farmId', authenticate, asyncHandler(async (req, res) => {
    const { farmId } = req.params;

    if (!farmId) {
        return res.status(400).json({ error: 'farm_id is required' });
    }

    try {
        // Verify farm access
        const hasAccess = await DatabaseService.verifyFarmOwnership(farmId, req.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this farm' });
        }

        const stats = await calculateFarmStats(farmId);

        res.json({
            stats,
            updated_at: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error fetching farm stats:', error);
        res.status(500).json({ error: 'Failed to fetch farm stats' });
    }
}));

// Get profit over time (for chart)
router.get('/farm/:farmId/profit_over_time', authenticate, asyncHandler(async (req, res) => {
    const { farmId } = req.params;

    if (!farmId) {
        return res.status(400).json({ error: 'farm_id is required' });
    }

    try {
        // Verify farm access
        const hasAccess = await DatabaseService.verifyFarmOwnership(farmId, req.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this farm' });
        }

        // Get last 12 months of data
        const currentDate = new Date();
        const profitData = [];

        for (let i = 11; i >= 0; i--) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
            const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

            // Get expenses for this month
            const expensesResult = await query(`
                SELECT COALESCE(SUM(amount), 0) as total_expenses
                FROM expenses
                WHERE farm_id = $1 AND expense_date >= $2 AND expense_date <= $3
            `, [farmId, startDate, endDate]);
            const totalExpenses = parseFloat(expensesResult.rows[0].total_expenses) || 0;

            // Get sales for this month
            const salesResult = await query(`
                SELECT 
                    COALESCE(SUM(total_amount), 0) as revenue,
                    COALESCE(SUM(profit), 0) as profit
                FROM sales
                WHERE farm_id = $1 AND sale_date >= $2 AND sale_date <= $3
            `, [farmId, startDate, endDate]);
            
            const profit = parseFloat(salesResult.rows[0].profit) || 0;

            profitData.push({
                date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
                value: profit,
            });
        }

        res.json(profitData);
    } catch (error) {
        console.error('Error fetching profit over time data:', error);
        res.status(500).json({ error: 'Failed to fetch profit over time data' });
    }
}));

// Batch summaries for a farm used by frontend page
router.get('/farm/:farmId/batch_summaries', authenticate, asyncHandler(async (req, res) => {
  const { farmId } = req.params;

  if (!farmId) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  try {
    const hasAccess = await DatabaseService.verifyFarmOwnership(farmId, req.user.userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this farm' });
    }

    // Fetch products with sold quantity aggregated
    const productsResult = await query(
      `SELECT
         p.id AS _id,
         p.name,
         COALESCE(p.quantity, 0) AS quantity,
         COALESCE(p.unit_price, 0) AS unit_price,
         COALESCE(p.quantity, 0) * COALESCE(p.unit_price, 0) AS total_value,
         COALESCE(p.batch_name, 'No Batch') AS product_batch,
         COALESCE(p.status, 'unsold') AS status,
         COALESCE((SELECT SUM(s.quantity) FROM sales s WHERE s.product_id = p.id), 0) AS sold_quantity
       FROM products p
       WHERE p.farm_id = $1
       ORDER BY p.created_at DESC`,
      [farmId]
    );

    const rows = productsResult.rows || [];

    // Group by batch_name
    const batchesMap = new Map();
    for (const r of rows) {
      const batchName = r.product_batch || 'No Batch';
      const quantity = Number(r.quantity) || 0;
      const unitPrice = Number(r.unit_price) || 0;
      const soldQty = Number(r.sold_quantity) || 0;
      const originalQty = quantity + soldQty;
      const unsoldValue = quantity * unitPrice;

      if (!batchesMap.has(batchName)) {
        batchesMap.set(batchName, {
          batch_name: batchName,
          total_expenses: 0,
          total_products_value: 0,
          total_original_quantity_in_batch: 0,
          avg_expense_per_unit: 0,
          products: []
        });
      }

      const acc = batchesMap.get(batchName);
      acc.total_original_quantity_in_batch += originalQty;
      // Only unsold contributes to current unsold value and product list
      if (String(r.status).toLowerCase() === 'unsold' && quantity > 0) {
        acc.total_products_value += unsoldValue;
        acc.products.push({
          _id: r._id,
          name: r.name,
          quantity: quantity,
          unit_price: unitPrice,
          total_value: unsoldValue,
          product_batch: batchName,
          status: r.status,
          sold_quantity: soldQty,
          original_quantity: originalQty
        });
      }
    }

    // Compute expenses and avg per unit per batch
    const summaries = [];
    for (const [batchName, acc] of batchesMap.entries()) {
      const expenses = await DatabaseService.getBatchExpensesTotal(farmId, batchName);
      acc.total_expenses = expenses;
      acc.avg_expense_per_unit = acc.total_original_quantity_in_batch > 0
        ? expenses / acc.total_original_quantity_in_batch
        : 0;
      summaries.push(acc);
    }

    // Sort batches by name for stable output
    summaries.sort((a, b) => a.batch_name.localeCompare(b.batch_name));

    res.json(summaries);
  } catch (error) {
    console.error('Error fetching batch summaries:', error);
    res.status(500).json({ error: 'Failed to fetch batch summaries' });
  }
}));

module.exports = router;