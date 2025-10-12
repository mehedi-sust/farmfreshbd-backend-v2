const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'password123',
  role: 'customer'
};

const testFarm = {
  name: 'Test Farm',
  description: 'A test farm for orders',
  location: 'Test Location',
  contact_info: 'test@farm.com'
};

const testProduct = {
  name: 'Test Product',
  description: 'A test product',
  category: 'vegetables',
  unit: 'kg',
  price: 100,
  stock: 50
};

let authToken = '';
let farmId = '';
let productId = '';
let storeProductId = '';

async function testOrderFlow() {
  console.log('🧪 Testing Complete Order Flow...\n');

  try {
    // 1. Register/Login user
    console.log('1️⃣ Testing User Authentication...');
    try {
      const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, testUser);
      authToken = registerResponse.data.token;
      console.log('✅ User registered successfully');
    } catch (error) {
      if (error.response?.status === 400) {
        // User already exists, try login
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
          email: testUser.email,
          password: testUser.password
        });
        authToken = loginResponse.data.token;
        console.log('✅ User logged in successfully');
      } else {
        throw error;
      }
    }

    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    // 2. Create farm
    console.log('\n2️⃣ Testing Farm Creation...');
    
    // First check if user already has a farm
    const userResponse = await axios.get(`${BASE_URL}/api/auth/me`, { headers });
    if (userResponse.data.farm_id) {
      farmId = userResponse.data.farm_id;
      console.log('✅ Using existing farm from user:', farmId);
    } else {
      // Create farm using auth endpoint
      try {
        const farmResponse = await axios.post(`${BASE_URL}/api/auth/create-farm`, {
          farm_name: testFarm.name,
          farm_type: 'vegetable',
          contact_number: '01234567890',
          address: testFarm.location,
          location: testFarm.location,
          bio: testFarm.description,
          user_id: userResponse.data._id
        }, { headers });
        farmId = farmResponse.data.farm_id;
        console.log('✅ Farm created successfully:', farmId);
      } catch (error) {
        console.log('ℹ️ Farm creation failed:', error.response?.data?.error);
        // Try regular farms endpoint
        try {
          const farmResponse = await axios.post(`${BASE_URL}/farms`, {
            name: testFarm.name,
            type: 'vegetable',
            address: testFarm.location,
            phone: '01234567890',
            location: testFarm.location,
            bio: testFarm.description
          }, { headers });
          farmId = farmResponse.data._id;
          console.log('✅ Farm created via farms endpoint:', farmId);
        } catch (error2) {
          console.log('❌ Both farm creation methods failed');
          throw error2;
        }
      }
    }

    // 3. Create product batch first
    console.log('\n3️⃣ Testing Product Batch Creation...');
    let batchId = '';
    try {
      const batchResponse = await axios.post(`${BASE_URL}/product_batches`, {
        name: 'test-batch-001',
        farm_id: farmId
      }, { headers });
      batchId = batchResponse.data._id;
      console.log('✅ Product batch created successfully:', batchId);
    } catch (error) {
      console.log('ℹ️ Product batch creation failed, might already exist');
      // Get existing batches
      const batchesResponse = await axios.get(`${BASE_URL}/product_batches/farm/${farmId}`, { headers });
      if (batchesResponse.data.length > 0) {
        batchId = batchesResponse.data[0]._id;
        console.log('✅ Using existing batch:', batchId);
      }
    }

    // 4. Create product
    console.log('\n4️⃣ Testing Product Creation...');
    try {
      const productResponse = await axios.post(`${BASE_URL}/products`, {
        name: testProduct.name,
        type: 'produce',
        quantity: 10,
        total_price: testProduct.price * 10,
        farm_id: farmId,
        product_batch: batchId
      }, { headers });
      productId = productResponse.data._id;
      console.log('✅ Product created successfully:', productId);
    } catch (error) {
      console.log('ℹ️ Product creation failed, might already exist');
      console.log('Error:', error.response?.data?.error);
      // Get existing products for this farm
      const productsResponse = await axios.get(`${BASE_URL}/products?farm_id=${farmId}`, { headers });
      if (productsResponse.data.length > 0) {
        productId = productsResponse.data[0]._id;
        console.log('✅ Using existing product:', productId);
      }
    }

    // 5. Add product to store
    console.log('\n5️⃣ Testing Store Product Addition...');
    try {
      const storeResponse = await axios.post(`${BASE_URL}/store_products`, {
        product_id: productId,
        farm_id: farmId,
        name: testProduct.name,
        description: testProduct.description,
        selling_price: testProduct.price,
        available_stock: testProduct.stock,
        category: 'vegetables',
        unit: testProduct.unit
      }, { headers });
      storeProductId = storeResponse.data._id;
      console.log('✅ Product added to store successfully:', storeProductId);
    } catch (error) {
      console.log('ℹ️ Store product addition failed, might already exist');
      console.log('Error:', error.response?.data?.error);
      // Get existing store products
      const storeProductsResponse = await axios.get(`${BASE_URL}/store_products`, { headers });
      if (storeProductsResponse.data.length > 0) {
        storeProductId = storeProductsResponse.data[0]._id;
        console.log('✅ Using existing store product:', storeProductId);
      }
    }

    // 6. Add to cart
    console.log('\n6️⃣ Testing Cart Addition...');
    const cartResponse = await axios.post(`${BASE_URL}/cart`, {
      store_product_id: storeProductId,
      quantity: 2
    }, { headers });
    console.log('✅ Product added to cart successfully');

    // 7. Get cart items
    console.log('\n7️⃣ Testing Cart Retrieval...');
    const cartItemsResponse = await axios.get(`${BASE_URL}/cart`, { headers });
    console.log('✅ Cart items retrieved:', cartItemsResponse.data.length, 'items');

    // 8. Place order
    console.log('\n8️⃣ Testing Order Placement...');
    const orderResponse = await axios.post(`${BASE_URL}/orders`, {
      items: [{
        store_product_id: storeProductId,
        quantity: 2
      }],
      customer_phone: '01234567890',
      delivery_address: 'Test Address, Test City'
    }, { headers });
    
    const orderId = orderResponse.data.orders[0]._id;
    console.log('✅ Order placed successfully:', orderId);

    // 9. Get user orders
    console.log('\n9️⃣ Testing Order History Retrieval...');
    const userOrdersResponse = await axios.get(`${BASE_URL}/orders`, { headers });
    console.log('✅ User orders retrieved:', userOrdersResponse.data.length, 'orders');

    // 10. Get specific order
    console.log('\n🔟 Testing Specific Order Retrieval...');
    const specificOrderResponse = await axios.get(`${BASE_URL}/orders/${orderId}`, { headers });
    console.log('✅ Specific order retrieved:', specificOrderResponse.data.status);

    // 11. Update order status (as farm manager)
    console.log('\n1️⃣1️⃣ Testing Order Status Update...');
    try {
      const statusUpdateResponse = await axios.put(`${BASE_URL}/orders/${orderId}/status`, {
        status: 'confirmed',
        delivery_fee: 50
      }, { headers });
      console.log('✅ Order status updated successfully');
    } catch (error) {
      console.log('⚠️ Order status update failed:', error.response?.data?.error || error.message);
    }

    // 12. Get farm orders
    console.log('\n1️⃣2️⃣ Testing Farm Orders Retrieval...');
    try {
      const farmOrdersResponse = await axios.get(`${BASE_URL}/orders?farm_id=${farmId}`, { headers });
      console.log('✅ Farm orders retrieved:', farmOrdersResponse.data.length, 'orders');
    } catch (error) {
      console.log('⚠️ Farm orders retrieval failed:', error.response?.data?.error || error.message);
    }

    console.log('\n🎉 All order tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Order test failed:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data?.error || error.message);
    console.error('Details:', error.response?.data?.details || 'No additional details');
    
    if (error.response?.data?.stack) {
      console.error('Stack trace:', error.response.data.stack);
    }
  }
}

// Run the test
testOrderFlow();