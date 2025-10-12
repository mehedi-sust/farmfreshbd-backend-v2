const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function testFrontendCompatibility() {
  console.log('🧪 Testing Frontend Compatibility...\n');

  try {
    // 1. Login
    console.log('1️⃣ Testing Login...');
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

    // 2. Test my-orders endpoint
    console.log('\n2️⃣ Testing /orders/my-orders...');
    const myOrdersResponse = await axios.get(`${BASE_URL}/orders/my-orders`, { headers });
    console.log('✅ My orders retrieved:', myOrdersResponse.data.length, 'orders');

    if (myOrdersResponse.data.length > 0) {
      const orderId = myOrdersResponse.data[0]._id;
      
      // 3. Test delivery fee endpoint
      console.log('\n3️⃣ Testing delivery fee endpoint...');
      try {
        const deliveryFeeResponse = await axios.put(`${BASE_URL}/orders/${orderId}/delivery-fee`, {
          delivery_fee: 50
        }, { headers });
        console.log('✅ Delivery fee set successfully');
      } catch (error) {
        console.log('⚠️ Delivery fee failed (might not be farm manager):', error.response?.data?.error);
      }

      // 4. Test cancel endpoint (PUT version)
      console.log('\n4️⃣ Testing cancel endpoint (PUT)...');
      try {
        const cancelResponse = await axios.put(`${BASE_URL}/orders/${orderId}/cancel`, {
          reason: 'Test cancellation'
        }, { headers });
        console.log('✅ Order cancelled successfully (PUT)');
      } catch (error) {
        console.log('⚠️ Cancel failed:', error.response?.data?.error);
      }

      // 5. Test status update endpoint
      console.log('\n5️⃣ Testing status update endpoint...');
      try {
        const statusResponse = await axios.put(`${BASE_URL}/orders/${orderId}/status`, {
          status: 'confirmed',
          delivery_fee: 30
        }, { headers });
        console.log('✅ Status updated successfully');
      } catch (error) {
        console.log('⚠️ Status update failed (might not be farm manager):', error.response?.data?.error);
      }
    }

    // 6. Test order placement
    console.log('\n6️⃣ Testing order placement...');
    try {
      // First get some store products
      const storeResponse = await axios.get(`${BASE_URL}/store_products`);
      if (storeResponse.data.length > 0) {
        const storeProductId = storeResponse.data[0]._id;
        
        const orderResponse = await axios.post(`${BASE_URL}/orders`, {
          items: [{
            store_product_id: storeProductId,
            quantity: 1
          }],
          customer_phone: '+8801234567890',
          delivery_address: 'Test Address, Test City'
        }, { headers });
        
        console.log('✅ Order placed successfully');
      } else {
        console.log('⚠️ No store products available for testing');
      }
    } catch (error) {
      console.log('⚠️ Order placement failed:', error.response?.data?.error);
    }

    console.log('\n🎉 Frontend compatibility tests completed!');

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data?.error || error.message);
    if (error.response?.data?.stack) {
      console.error('Stack:', error.response.data.stack);
    }
  }
}

testFrontendCompatibility();