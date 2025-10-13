const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function addTestStoreProducts() {
  try {
    console.log('🚀 Adding test products to store...');

    // 1. Register a test user
    console.log('1️⃣ Registering test user...');
    let authResponse;
    try {
      authResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
        email: 'storetest@example.com',
        password: 'password123',
        role: 'farm_manager'
      });
      console.log('✅ User registered successfully');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
        console.log('ℹ️ User already exists, logging in...');
        authResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
          email: 'storetest@example.com',
          password: 'password123'
        });
        console.log('✅ User logged in successfully');
      } else {
        throw error;
      }
    }

    const token = authResponse.data.token;
    const headers = { Authorization: `Bearer ${token}` };

    // 2. Get existing products
    console.log('2️⃣ Getting existing products...');
    const productsResponse = await axios.get(`${BASE_URL}/api/products`);
    const products = productsResponse.data;
    console.log(`✅ Found ${products.length} products`);

    if (products.length === 0) {
      console.log('❌ No products found to add to store');
      return;
    }

    // 3. Add first few products to store
    console.log('3️⃣ Adding products to store...');
    const productsToAdd = products.slice(0, 3); // Add first 3 products

    for (let i = 0; i < productsToAdd.length; i++) {
      const product = productsToAdd[i];
      try {
        const storeProductData = {
          product_id: product._id,
          farm_id: product.farm_id,
          store_price: product.unit_price * 1.2, // Add 20% markup
          available_stock: Math.min(product.quantity, 50), // Limit stock to 50
          description: `Fresh ${product.name} from our farm`,
          category: product.type === 'produce' ? 'vegetables' : 'meat'
        };

        const storeResponse = await axios.post(`${BASE_URL}/api/store_products`, storeProductData, { headers });
        console.log(`✅ Added ${product.name} to store (ID: ${storeResponse.data._id})`);
      } catch (error) {
        if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
          console.log(`ℹ️ ${product.name} already in store`);
        } else {
          console.log(`❌ Failed to add ${product.name}: ${error.response?.data?.error || error.message}`);
        }
      }
    }

    // 4. Verify store products
    console.log('4️⃣ Verifying store products...');
    const storeResponse = await axios.get(`${BASE_URL}/api/store_products`);
    const storeProducts = storeResponse.data.store_products;
    console.log(`✅ Store now has ${storeProducts.length} products`);

    if (storeProducts.length > 0) {
      console.log('📦 Store products:');
      storeProducts.forEach(product => {
        console.log(`   - ${product.product?.name || 'Unknown'}: $${product.store_price} (Stock: ${product.available_stock})`);
      });
    }

    console.log('🎉 Test store products added successfully!');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.error('Full error:', error);
  }
}

addTestStoreProducts();