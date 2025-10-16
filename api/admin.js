const express = require('express');
const { asyncHandler } = require('../src/utils/helpers');
const DatabaseService = require('../src/services/database.service');
const { authenticate, requireAdmin } = require('../src/config/auth.js');

const router = express.Router();

// GET /admin/stats - Fetch statistics for the admin dashboard
router.get('/stats', [authenticate, requireAdmin], asyncHandler(async (req, res) => {
    try {
        // Get counts for all entities
        const total_users = await DatabaseService.getUsersCount();
        const total_farms = await DatabaseService.getFarmsCount();
        const total_products = await DatabaseService.getProductsCount();
        const total_orders = await DatabaseService.getOrdersCount();
        const total_store_products = await DatabaseService.getStoreProductsCount();

        // Get users by role
        const users_by_role = await DatabaseService.getUsersByRole();

        // Get recent users and orders
        const recent_users = await DatabaseService.getRecentUsers(5);
        const recent_orders = await DatabaseService.getRecentOrders(5);

        res.json({
            total_users,
            total_farms,
            total_products,
            total_orders,
            total_store_products,
            users_by_role,
            recent_users,
            recent_orders
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Failed to fetch admin statistics' });
    }
}));

// GET /admin/users - Fetch all users with pagination
router.get('/users', [authenticate, requireAdmin], asyncHandler(async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';

        const result = await DatabaseService.getUsers({
            page,
            limit,
            search
        });

        res.json({
            users: result.users,
            pagination: {
                currentPage: page,
                totalPages: result.totalPages,
                totalUsers: result.totalUsers,
                usersPerPage: limit
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
}));

// DELETE /admin/users/:userId - Delete a user
router.delete('/users/:userId', [authenticate, requireAdmin], asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;

        // Check if user exists and is not admin
        const user = await DatabaseService.getUserById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role === 'admin') {
            return res.status(400).json({ message: 'Cannot delete admin users' });
        }

        await DatabaseService.deleteUser(userId);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
}));

// GET /admin/farms - Fetch all farms with pagination
router.get('/farms', [authenticate, requireAdmin], asyncHandler(async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';

        const result = await DatabaseService.getFarms({
            page,
            limit,
            search
        });

        res.json({
            farms: result.farms,
            pagination: {
                currentPage: page,
                totalPages: result.totalPages,
                totalFarms: result.totalFarms,
                farmsPerPage: limit
            }
        });
    } catch (error) {
        console.error('Error fetching farms:', error);
        res.status(500).json({ error: 'Failed to fetch farms' });
    }
}));

// DELETE /admin/farms/:farmId - Delete a farm
router.delete('/farms/:farmId', [authenticate, requireAdmin], asyncHandler(async (req, res) => {
    try {
        const { farmId } = req.params;

        const farm = await DatabaseService.getFarmById(farmId);
        if (!farm) {
            return res.status(404).json({ detail: 'Farm not found' });
        }

        await DatabaseService.deleteFarm(farmId);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting farm:', error);
        res.status(500).json({ error: 'Failed to delete farm' });
    }
}));

// GET /admin/store-products - Fetch all store products with pagination
router.get('/store-products', [authenticate, requireAdmin], asyncHandler(async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000;
        const search = req.query.search || '';

        const result = await DatabaseService.getStoreProducts({
            page,
            limit,
            search
        });

        res.json({
            store_products: result.store_products,
            pagination: {
                currentPage: page,
                totalPages: result.totalPages,
                totalStoreProducts: result.totalStoreProducts,
                storeProductsPerPage: limit
            }
        });
    } catch (error) {
        console.error('Error fetching store products:', error);
        res.status(500).json({ error: 'Failed to fetch store products' });
    }
}));

module.exports = router;