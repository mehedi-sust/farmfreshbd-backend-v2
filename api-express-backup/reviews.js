const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId } = require('../src/utils/helpers');

const app = express();
app.use(express.json());

// Get reviews for a store product
app.get('/product/:product_id', asyncHandler(async (req, res) => {
  const { product_id } = req.params;

  const { db } = await connectToDatabase();
  const { reviews, users } = getCollections(db);

  const pipeline = [
    { $match: { store_product_id: toObjectId(product_id) } },
    {
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        store_product_id: 1,
        user_id: 1,
        rating: 1,
        comment: 1,
        created_at: 1,
        updated_at: 1,
        user_name: '$user.name',
        user_email: '$user.email'
      }
    },
    { $sort: { created_at: -1 } }
  ];

  const productReviews = await reviews.aggregate(pipeline).toArray();
  res.json(serializeDocs(productReviews));
}));

// Get review statistics for a product
app.get('/product/:product_id/stats', asyncHandler(async (req, res) => {
  const { product_id } = req.params;

  const { db } = await connectToDatabase();
  const { reviews } = getCollections(db);

  const stats = await reviews.aggregate([
    { $match: { store_product_id: toObjectId(product_id) } },
    {
      $group: {
        _id: null,
        average_rating: { $avg: '$rating' },
        total_reviews: { $sum: 1 },
        five_star: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        four_star: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        three_star: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        two_star: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        one_star: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
      }
    }
  ]).toArray();

  if (stats.length === 0) {
    return res.json({
      average_rating: 0,
      total_reviews: 0,
      five_star: 0,
      four_star: 0,
      three_star: 0,
      two_star: 0,
      one_star: 0
    });
  }

  const result = stats[0];
  delete result._id;
  res.json(result);
}));

// Create a review
app.post('/', authenticate, asyncHandler(async (req, res) => {
  const { store_product_id, rating, comment } = req.body;

  if (!store_product_id || !rating) {
    return res.status(400).json({ error: 'store_product_id and rating are required' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const { db } = await connectToDatabase();
  const { reviews, storeProducts } = getCollections(db);

  // Verify product exists
  const product = await storeProducts.findOne({ _id: toObjectId(store_product_id) });
  if (!product) {
    return res.status(404).json({ error: 'Store product not found' });
  }

  // Check if user already reviewed this product
  const existingReview = await reviews.findOne({
    store_product_id: toObjectId(store_product_id),
    user_id: toObjectId(req.user.userId)
  });

  if (existingReview) {
    return res.status(400).json({ error: 'You have already reviewed this product. Use PUT to update your review.' });
  }

  const reviewDoc = {
    store_product_id: toObjectId(store_product_id),
    user_id: toObjectId(req.user.userId),
    rating: parseInt(rating),
    comment: comment || '',
    created_at: new Date(),
    updated_at: new Date()
  };

  const result = await reviews.insertOne(reviewDoc);
  const created = await reviews.findOne({ _id: result.insertedId });

  res.status(201).json(serializeDoc(created));
}));

// Update a review
app.put('/:review_id', authenticate, asyncHandler(async (req, res) => {
  const { review_id } = req.params;
  const { rating, comment } = req.body;

  const { db } = await connectToDatabase();
  const { reviews } = getCollections(db);

  const review = await reviews.findOne({ _id: toObjectId(review_id) });
  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }

  // Verify user owns this review
  if (review.user_id.toString() !== req.user.userId) {
    return res.status(403).json({ error: 'You can only update your own reviews' });
  }

  const updates = { updated_at: new Date() };
  if (rating !== undefined) {
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    updates.rating = parseInt(rating);
  }
  if (comment !== undefined) {
    updates.comment = comment;
  }

  await reviews.updateOne(
    { _id: toObjectId(review_id) },
    { $set: updates }
  );

  const updated = await reviews.findOne({ _id: toObjectId(review_id) });
  res.json(serializeDoc(updated));
}));

// Delete a review
app.delete('/:review_id', authenticate, asyncHandler(async (req, res) => {
  const { review_id } = req.params;

  const { db } = await connectToDatabase();
  const { reviews } = getCollections(db);

  const review = await reviews.findOne({ _id: toObjectId(review_id) });
  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }

  // Verify user owns this review
  if (review.user_id.toString() !== req.user.userId) {
    return res.status(403).json({ error: 'You can only delete your own reviews' });
  }

  await reviews.deleteOne({ _id: toObjectId(review_id) });
  res.json({ message: 'Review deleted successfully' });
}));

// Get user's review for a product
app.get('/product/:product_id/user', authenticate, asyncHandler(async (req, res) => {
  const { product_id } = req.params;

  const { db } = await connectToDatabase();
  const { reviews } = getCollections(db);

  const review = await reviews.findOne({
    store_product_id: toObjectId(product_id),
    user_id: toObjectId(req.user.userId)
  });

  if (!review) {
    return res.status(404).json({ error: 'No review found' });
  }

  res.json(serializeDoc(review));
}));

module.exports = app;
