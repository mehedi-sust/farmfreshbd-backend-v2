const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function testRoutes() {
  console.log('🧪 Testing Available Routes...\n');

  const routes = [
    '/',
    '/health',
    '/api/auth/register',
    '/register',
    '/login',
    '/users/register',
    '/users/login',
    '/farms',
    '/api/farms',
    '/products',
    '/api/products',
    '/store_products',
    '/api/store_products',
    '/cart',
    '/api/cart',
    '/orders',
    '/api/orders'
  ];

  for (const route of routes) {
    try {
      const response = await axios.get(`${BASE_URL}${route}`);
      console.log(`✅ ${route} - Status: ${response.status}`);
    } catch (error) {
      if (error.response) {
        console.log(`⚠️ ${route} - Status: ${error.response.status} - ${error.response.data?.error || 'Error'}`);
      } else {
        console.log(`❌ ${route} - Connection failed: ${error.message}`);
      }
    }
  }

  // Test POST routes
  console.log('\n🧪 Testing POST Routes...\n');
  
  const postRoutes = [
    '/register',
    '/login',
    '/api/auth/register',
    '/api/auth/login',
    '/users/register',
    '/users/login'
  ];

  for (const route of postRoutes) {
    try {
      const response = await axios.post(`${BASE_URL}${route}`, {
        email: 'test@example.com',
        password: 'password123'
      });
      console.log(`✅ POST ${route} - Status: ${response.status}`);
    } catch (error) {
      if (error.response) {
        console.log(`⚠️ POST ${route} - Status: ${error.response.status} - ${error.response.data?.error || 'Error'}`);
      } else {
        console.log(`❌ POST ${route} - Connection failed: ${error.message}`);
      }
    }
  }
}

testRoutes();