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

module.exports = router;