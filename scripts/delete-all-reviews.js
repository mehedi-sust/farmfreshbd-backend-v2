#!/usr/bin/env node
/**
 * Delete all reviews from the database (PostgreSQL).
 *
 * Usage:
 *   node scripts/delete-all-reviews.js              # delete ALL reviews
 *   node scripts/delete-all-reviews.js --product <UUID>  # delete reviews for a specific product
 *
 * Environment:
 *   Ensure your PostgreSQL env vars are set (e.g., PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT)
 */

const path = require('path');
// Load .env if present
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {}

const { query, closePool } = require('../src/config/database');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--product' && args[i + 1]) {
      options.product = args[i + 1];
      i++;
    }
  }
  return options;
}

async function deleteAllReviews({ product }) {
  try {
    const preCountRes = await query('SELECT COUNT(*)::int AS count FROM product_reviews');
    const beforeCount = preCountRes.rows[0].count;

    if (product) {
      console.log(`Deleting reviews for product: ${product}`);
      await query('DELETE FROM product_reviews WHERE product_id = $1', [product]);
    } else {
      console.log('Deleting ALL reviews from product_reviews...');
      await query('DELETE FROM product_reviews');
    }

    const postCountRes = await query('SELECT COUNT(*)::int AS count FROM product_reviews');
    const afterCount = postCountRes.rows[0].count;

    console.log(`Done. Reviews before: ${beforeCount}, after: ${afterCount}.`);
  } catch (err) {
    console.error('Failed to delete reviews:', err.message || err);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

(async () => {
  const opts = parseArgs();
  await deleteAllReviews(opts);
})();