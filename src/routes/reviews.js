const express = require('express');
const { authenticate } = require('../config/auth');
const { asyncHandler, serializeDoc, serializeDocs, isValidUUID } = require('../utils/helpers');
const { query } = require('../config/database');

const router = express.Router();

// Get all reviews for a product - GET /reviews/product/:product_id
router.get('/product/:product_id', asyncHandler(async (req, res) => {
    const { product_id } = req.params;
    
    if (!isValidUUID(product_id)) {
        return res.status(400).json({ error: 'Invalid product ID format' });
    }

    try {
        const result = await query(`
            SELECT 
                pr.*,
                u.first_name,
                u.last_name,
                u.email
            FROM product_reviews pr
            JOIN users u ON pr.user_id = u.id
            WHERE pr.product_id = $1 
            AND pr.is_approved = true
            ORDER BY pr.created_at DESC
        `, [product_id]);

        const reviews = result.rows.map(review => ({
            ...serializeDoc(review),
            user_name: `${review.first_name || ''} ${review.last_name || ''}`.trim() || 'Anonymous',
            user_email: review.email
        }));

        res.json({ reviews });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
}));

// Get review statistics for a product - GET /reviews/product/:product_id/stats
router.get('/product/:product_id/stats', asyncHandler(async (req, res) => {
    const { product_id } = req.params;
    
    if (!isValidUUID(product_id)) {
        return res.status(400).json({ error: 'Invalid product ID format' });
    }

    try {
        const result = await query(`
            SELECT 
                COALESCE(AVG(rating), 0) as average_rating,
                COUNT(*) as total_reviews,
                COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
                COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
                COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
                COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
                COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
            FROM product_reviews 
            WHERE product_id = $1 
            AND is_approved = true
        `, [product_id]);

        const stats = result.rows[0];
        
        res.json({
            average_rating: parseFloat(stats.average_rating) || 0,
            total_reviews: parseInt(stats.total_reviews) || 0,
            five_star: parseInt(stats.five_star) || 0,
            four_star: parseInt(stats.four_star) || 0,
            three_star: parseInt(stats.three_star) || 0,
            two_star: parseInt(stats.two_star) || 0,
            one_star: parseInt(stats.one_star) || 0
        });
    } catch (error) {
        console.error('Error fetching review stats:', error);
        res.status(500).json({ error: 'Failed to fetch review statistics' });
    }
}));

// Get review statistics for a farm - GET /reviews/farm/:farm_id/stats
router.get('/farm/:farm_id/stats', asyncHandler(async (req, res) => {
    const { farm_id } = req.params;

    if (!isValidUUID(farm_id)) {
        return res.status(400).json({ error: 'Invalid farm ID format' });
    }

    try {
        const result = await query(`
            SELECT 
                COALESCE(AVG(pr.rating), 0) as average_rating,
                COUNT(*) as total_reviews,
                COUNT(CASE WHEN pr.rating = 5 THEN 1 END) as five_star,
                COUNT(CASE WHEN pr.rating = 4 THEN 1 END) as four_star,
                COUNT(CASE WHEN pr.rating = 3 THEN 1 END) as three_star,
                COUNT(CASE WHEN pr.rating = 2 THEN 1 END) as two_star,
                COUNT(CASE WHEN pr.rating = 1 THEN 1 END) as one_star
            FROM product_reviews pr
            JOIN products p ON pr.product_id = p.id
            WHERE p.farm_id = $1 
            AND pr.is_approved = true
        `, [farm_id]);

        const stats = result.rows[0] || {};

        res.json({
            average_rating: parseFloat(stats.average_rating) || 0,
            total_reviews: parseInt(stats.total_reviews) || 0,
            five_star: parseInt(stats.five_star) || 0,
            four_star: parseInt(stats.four_star) || 0,
            three_star: parseInt(stats.three_star) || 0,
            two_star: parseInt(stats.two_star) || 0,
            one_star: parseInt(stats.one_star) || 0
        });
    } catch (error) {
        console.error('Error fetching farm review stats:', error);
        res.status(500).json({ error: 'Failed to fetch farm review statistics' });
    }
}));

// Get user's review for a product - GET /reviews/product/:product_id/user
router.get('/product/:product_id/user', authenticate, asyncHandler(async (req, res) => {
    const { product_id } = req.params;
    const user_id = req.user.userId;
    
    if (!isValidUUID(product_id)) {
        return res.status(400).json({ error: 'Invalid product ID format' });
    }

    try {
        const result = await query(`
            SELECT * FROM product_reviews 
            WHERE product_id = $1 AND user_id = $2
        `, [product_id, user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No review found' });
        }

        res.json({ review: serializeDoc(result.rows[0]) });
    } catch (error) {
        console.error('Error fetching user review:', error);
        res.status(500).json({ error: 'Failed to fetch user review' });
    }
}));

// Create a review - POST /reviews
router.post('/', authenticate, asyncHandler(async (req, res) => {
    const { product_id, rating, title, comment, order_item_id } = req.body;
    const user_id = req.user.userId;

    if (!product_id || !rating) {
        return res.status(400).json({ error: 'product_id and rating are required' });
    }

    if (!isValidUUID(product_id)) {
        return res.status(400).json({ error: 'Invalid product ID format' });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    try {
        // Check if user already has a review for this product
        const existingResult = await query(`
            SELECT id FROM product_reviews 
            WHERE product_id = $1 AND user_id = $2
        `, [product_id, user_id]);

        if (existingResult.rows.length > 0) {
            return res.status(400).json({ error: 'You have already reviewed this product. Use PUT to update your review.' });
        }

        // Verify product exists
        const productResult = await query(`
            SELECT id FROM products WHERE id = $1
        `, [product_id]);

        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Check if order_item_id is valid (if provided)
        let is_verified_purchase = false;
        if (order_item_id && isValidUUID(order_item_id)) {
            const orderItemResult = await query(`
                SELECT oi.id FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                JOIN store_products sp ON oi.store_product_id = sp.id
                WHERE oi.id = $1 
                  AND o.customer_id = $2 
                  AND sp.product_id = $3
                  AND o.status = 'delivered'
            `, [order_item_id, user_id, product_id]);
            
            is_verified_purchase = orderItemResult.rows.length > 0;
        }

        const result = await query(`
            INSERT INTO product_reviews (product_id, user_id, order_item_id, rating, title, comment, is_verified_purchase, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING *
        `, [product_id, user_id, order_item_id || null, rating, title || null, comment || null, is_verified_purchase]);

        res.status(201).json({ 
            message: 'Review created successfully',
            review: serializeDoc(result.rows[0])
        });
    } catch (error) {
        console.error('Error creating review:', error);
        res.status(500).json({ error: 'Failed to create review' });
    }
}));

// Update a review - PUT /reviews/:review_id
router.put('/:review_id', authenticate, asyncHandler(async (req, res) => {
    const { review_id } = req.params;
    const { rating, title, comment } = req.body;
    const user_id = req.user.userId;

    if (!isValidUUID(review_id)) {
        return res.status(400).json({ error: 'Invalid review ID format' });
    }

    if (!rating) {
        return res.status(400).json({ error: 'Rating is required' });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    try {
        // Check if review exists and belongs to user
        const existingResult = await query(`
            SELECT id FROM product_reviews 
            WHERE id = $1 AND user_id = $2
        `, [review_id, user_id]);

        if (existingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found or you do not have permission to update it' });
        }

        const result = await query(`
            UPDATE product_reviews 
            SET rating = $1, title = $2, comment = $3, updated_at = NOW()
            WHERE id = $4 AND user_id = $5
            RETURNING *
        `, [rating, title || null, comment || null, review_id, user_id]);

        res.json({ 
            message: 'Review updated successfully',
            review: serializeDoc(result.rows[0])
        });
    } catch (error) {
        console.error('Error updating review:', error);
        res.status(500).json({ error: 'Failed to update review' });
    }
}));

// Delete a review - DELETE /reviews/:review_id
router.delete('/:review_id', authenticate, asyncHandler(async (req, res) => {
    const { review_id } = req.params;
    const user_id = req.user.userId;

    if (!isValidUUID(review_id)) {
        return res.status(400).json({ error: 'Invalid review ID format' });
    }

    try {
        // Check if review exists and belongs to user
        const existingResult = await query(`
            SELECT id FROM product_reviews 
            WHERE id = $1 AND user_id = $2
        `, [review_id, user_id]);

        if (existingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found or you do not have permission to delete it' });
        }

        await query(`
            DELETE FROM product_reviews 
            WHERE id = $1 AND user_id = $2
        `, [review_id, user_id]);

        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ error: 'Failed to delete review' });
    }
}));

module.exports = router;