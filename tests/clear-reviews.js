/**
 * Clear user's reviews for a specific product.
 * Usage:
 *   BASE_URL=http://localhost:5000 EMAIL=user@example.com PASSWORD=secret \
 *   node tests/clear-reviews.js <product_id>
 */
const axios = require('axios');

async function login(baseUrl, email, password) {
  const res = await axios.post(`${baseUrl}/api/auth/login`, { email, password });
  return res.data?.token || res.data?.access_token;
}

async function getUserReview(baseUrl, token, productId) {
  const res = await axios.get(`${baseUrl}/api/reviews/product/${productId}/user`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data?.review;
}

async function getApprovedReviews(baseUrl, productId) {
  const res = await axios.get(`${baseUrl}/api/reviews/product/${productId}`);
  return Array.isArray(res.data?.reviews) ? res.data.reviews : [];
}

async function deleteReview(baseUrl, token, reviewId) {
  const res = await axios.delete(`${baseUrl}/api/reviews/${reviewId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

(async () => {
  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const email = process.env.EMAIL;
    const password = process.env.PASSWORD;
    const productId = process.argv[2];

    if (!email || !password) {
      console.error('ERROR: EMAIL and PASSWORD env vars are required to authenticate.');
      process.exit(1);
    }
    if (!productId) {
      console.error('ERROR: Provide <product_id> as the first argument.');
      process.exit(1);
    }

    console.log('Logging in...');
    const token = await login(baseUrl, email, password);
    if (!token) throw new Error('Failed to obtain auth token');

    console.log('Fetching user review for product:', productId);
    let userReview = null;
    try {
      userReview = await getUserReview(baseUrl, token, productId);
    } catch (err) {
      // 404 when no user review exists; continue
      if (err.response && err.response.status === 404) {
        console.log('No user review found via /user endpoint.');
      } else {
        throw err;
      }
    }

    if (userReview && userReview.id) {
      console.log('Deleting user review:', userReview.id);
      await deleteReview(baseUrl, token, userReview.id);
      console.log('✅ Deleted user review');
    } else {
      console.log('Checking approved reviews list (may include your approved review)...');
      const reviews = await getApprovedReviews(baseUrl, productId);
      const myReviews = reviews.filter(r => r.user_email); // backend includes user_email in approved list
      // Attempt deletion for any reviews returned (will only succeed for your own)
      for (const r of myReviews) {
        try {
          console.log('Attempting to delete review:', r.id);
          await deleteReview(baseUrl, token, r.id);
          console.log('✅ Deleted review:', r.id);
        } catch (err) {
          if (err.response) {
            console.log(`Skipping review ${r.id}: ${err.response.status} ${err.response.data?.error || err.response.statusText}`);
          } else {
            console.log(`Skipping review ${r.id}: ${err.message}`);
          }
        }
      }
    }

    console.log('Done. If store stars still look wrong, reload the frontend.');
  } catch (error) {
    console.error('Failed to clear reviews:', error.response?.data || error.message);
    process.exit(1);
  }
})();