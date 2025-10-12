const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

// Add timeout and better error handling
axios.defaults.timeout = 10000;

// Test data
const testUser = {
  email: 'testuser@example.com',
  password: 'password123',
  name: 'Test User',
  phone: '1234567890',
  address: 'Test Address'
};

let authToken = '';
let testStoreProductId = '';

async function testCartPersistence() {
  console.log('🧪 Testing Cart Persistence System...\n');

  try {
    // 1. Register/Login user
    console.log('1️⃣ Setting up test user...');
    try {
      await axios.post(`${BASE_URL}/auth/register`, testUser);
      console.log('✅ User registered');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('ℹ️ User already exists, proceeding with login');
      } else {
        throw error;
      }
    }

    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    authToken = loginResponse.data.token;
    console.log('✅ User logged in');

    // 2. Get a store product to add to cart
    console.log('\n2️⃣ Getting store products...');
    const storeResponse = await axios.get(`${BASE_URL}/store/products`);
    if (storeResponse.data.length === 0) {
      throw new Error('No store products available for testing');
    }
    testStoreProductId = storeResponse.data[0]._id;
    console.log(`✅ Found test product: ${storeResponse.data[0].name}`);

    // 3. Add items to cart
    console.log('\n3️⃣ Adding items to cart...');
    await axios.post(`${BASE_URL}/cart`, {
      store_product_id: testStoreProductId,
      quantity: 2
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Added 2 items to cart');

    // 4. Verify cart contents
    console.log('\n4️⃣ Verifying cart contents...');
    const cartResponse = await axios.get(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (cartResponse.data.length === 0) {
      throw new Error('Cart is empty after adding items');
    }
    
    const cartItem = cartResponse.data[0];
    if (cartItem.quantity !== 2) {
      throw new Error(`Expected quantity 2, got ${cartItem.quantity}`);
    }
    
    console.log('✅ Cart contents verified');
    console.log(`   - Product: ${cartItem.product.product_name}`);
    console.log(`   - Quantity: ${cartItem.quantity}`);
    console.log(`   - Price: $${cartItem.product.price}`);

    // 5. Test cart sync endpoint
    console.log('\n5️⃣ Testing cart sync...');
    await axios.post(`${BASE_URL}/cart/sync`, {
      items: [
        { store_product_id: testStoreProductId, quantity: 3 }
      ]
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Cart synced with new quantity');

    // 6. Verify sync worked
    const syncedCartResponse = await axios.get(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const syncedItem = syncedCartResponse.data[0];
    if (syncedItem.quantity !== 3) {
      throw new Error(`Expected synced quantity 3, got ${syncedItem.quantity}`);
    }
    console.log('✅ Cart sync verified - quantity updated to 3');

    // 7. Test empty cart sync
    console.log('\n6️⃣ Testing empty cart sync...');
    await axios.post(`${BASE_URL}/cart/sync`, {
      items: []
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const emptyCartResponse = await axios.get(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (emptyCartResponse.data.length !== 0) {
      throw new Error(`Expected empty cart, got ${emptyCartResponse.data.length} items`);
    }
    console.log('✅ Empty cart sync verified');

    console.log('\n🎉 All cart persistence tests passed!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ User authentication');
    console.log('   ✅ Add items to cart');
    console.log('   ✅ Retrieve cart contents');
    console.log('   ✅ Cart synchronization');
    console.log('   ✅ Empty cart handling');
    console.log('   ✅ Proper data structure for frontend');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n🚨 Backend server is not running!');
      console.error('Please start the backend server first:');
      console.error('   cd farmfreshbd-backend-v2');
      console.error('   npm start');
    } else {
      console.error('Full error:', error);
    }
    process.exit(1);
  }
}

// Run the test
testCartPersistence();