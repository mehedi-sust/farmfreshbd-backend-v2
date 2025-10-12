const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function testMyOrdersFix() {
  console.log('🧪 Testing My Orders Fix...\n');

  try {
    // 1. Login to get token
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'password123'
    });
    
    const authToken = loginResponse.data.token;
    console.log('✅ Login successful');

    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    // 2. Test /orders/my-orders endpoint
    console.log('\n2️⃣ Testing /orders/my-orders endpoint...');
    const myOrdersResponse = await axios.get(`${BASE_URL}/orders/my-orders`, { headers });
    console.log('✅ My orders retrieved successfully:', myOrdersResponse.data.length, 'orders');

    // 3. Test /orders endpoint (should work the same)
    console.log('\n3️⃣ Testing /orders endpoint...');
    const ordersResponse = await axios.get(`${BASE_URL}/orders`, { headers });
    console.log('✅ Orders retrieved successfully:', ordersResponse.data.length, 'orders');

    // 4. Test with status filter
    console.log('\n4️⃣ Testing with status filter...');
    const pendingOrdersResponse = await axios.get(`${BASE_URL}/orders/my-orders?status=pending`, { headers });
    console.log('✅ Pending orders retrieved:', pendingOrdersResponse.data.length, 'orders');

    console.log('\n🎉 All my-orders tests passed!');

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data?.error || error.message);
    if (error.response?.data?.stack) {
      console.error('Stack:', error.response.data.stack);
    }
  }
}

testMyOrdersFix();