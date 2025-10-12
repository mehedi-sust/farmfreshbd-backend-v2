const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testReviewsAPI() {
  try {
    console.log('Testing Reviews API...\n');

    // 1. Login
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'password123'
    });

    const token = loginResponse.data.access_token;
    console.log('✓ Logged in successfully\n');

    // 2. Get store products
    console.log('2. Fetching store products...');
    const productsResponse = await axios.get(`${BASE_URL}/store_products`);
    
    if (productsResponse.data.length === 0) {
      console.log('❌ No store products found. Please add products to store first.');
      return;
    }

    const productId = productsResponse.data[0]._id;
    console.log(`✓ Found product: ${productsResponse.data[0].product_name} (ID: ${productId})\n`);

    // 3. Submit a review
    console.log('3. Submitting a review...');
    try {
      const reviewResponse = await axios.post(
        `${BASE_URL}/reviews`,
        {
          store_product_id: productId,
          rating: 5,
          comment: 'Excellent product! Fresh and high quality.'
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log('✓ Review submitted successfully');
      console.log(`  Review ID: ${reviewResponse.data._id}\n`);
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('already reviewed')) {
        console.log('✓ Review already exists (expected)\n');
      } else {
        throw error;
      }
    }

    // 4. Get review stats
    console.log('4. Fetching review statistics...');
    const statsResponse = await axios.get(`${BASE_URL}/reviews/product/${productId}/stats`);
    console.log('✓ Review stats fetched:');
    console.log(`  Average Rating: ${statsResponse.data.average_rating.toFixed(2)}`);
    console.log(`  Total Reviews: ${statsResponse.data.total_reviews}`);
    console.log(`  5 Star: ${statsResponse.data.five_star}`);
    console.log(`  4 Star: ${statsResponse.data.four_star}`);
    console.log(`  3 Star: ${statsResponse.data.three_star}`);
    console.log(`  2 Star: ${statsResponse.data.two_star}`);
    console.log(`  1 Star: ${statsResponse.data.one_star}\n`);

    // 5. Get all reviews for product
    console.log('5. Fetching all reviews...');
    const reviewsResponse = await axios.get(`${BASE_URL}/reviews/product/${productId}`);
    console.log(`✓ Found ${reviewsResponse.data.length} review(s):`);
    reviewsResponse.data.forEach((review, index) => {
      console.log(`  Review ${index + 1}:`);
      console.log(`    User: ${review.user_name || 'Anonymous'}`);
      console.log(`    Rating: ${review.rating} stars`);
      console.log(`    Comment: ${review.comment || 'No comment'}`);
      console.log(`    Date: ${new Date(review.created_at).toLocaleDateString()}`);
    });
    console.log('');

    // 6. Get user's review
    console.log('6. Fetching user\'s review...');
    try {
      const userReviewResponse = await axios.get(
        `${BASE_URL}/reviews/product/${productId}/user`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log('✓ User review found:');
      console.log(`  Rating: ${userReviewResponse.data.rating} stars`);
      console.log(`  Comment: ${userReviewResponse.data.comment}\n`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✓ User has not reviewed this product yet\n');
      } else {
        throw error;
      }
    }

    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

testReviewsAPI();
