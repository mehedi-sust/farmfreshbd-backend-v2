const axios = require('axios');

const API_URL = 'http://localhost:8000';

// Test credentials - update these
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

let authToken = '';
let farmId = '';
let batchId = '';

async function login() {
  console.log('\n🔐 Testing Login...');
  try {
    const response = await axios.post(`${API_URL}/users/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    
    authToken = response.data.access_token || response.data.token;
    farmId = response.data.farm_id;
    
    console.log('✅ Login successful');
    console.log(`   Token: ${authToken.substring(0, 20)}...`);
    console.log(`   Farm ID: ${farmId}`);
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

async function testCreateBatch() {
  console.log('\n📦 Testing Create Product Batch (POST /product_batches)...');
  try {
    const response = await axios.post(`${API_URL}/products/batches`, {
      name: `Test Batch ${Date.now()}`,
      farm_id: farmId,
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    batchId = response.data._id;
    console.log('✅ Create batch successful');
    console.log('   Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Create batch failed:', error.response?.data || error.message);
    console.error('   Status:', error.response?.status);
    console.error('   URL:', error.config?.url);
    return false;
  }
}

async function testGetBatchesByFarm() {
  console.log('\n📋 Testing Get Batches by Farm (GET /product_batches/farm/:farm_id)...');
  try {
    const response = await axios.get(`${API_URL}/products/batches/farm/${farmId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    console.log('✅ Get batches successful');
    console.log(`   Found ${response.data.length} batches`);
    if (response.data.length > 0) {
      console.log('   Sample batch:', JSON.stringify(response.data[0], null, 2));
    }
    return true;
  } catch (error) {
    console.error('❌ Get batches failed:', error.response?.data || error.message);
    console.error('   Status:', error.response?.status);
    console.error('   URL:', error.config?.url);
    return false;
  }
}

async function testGetBatchesQuery() {
  console.log('\n📋 Testing Get Batches (GET /product_batches/batches?farm_id=xxx)...');
  try {
    const response = await axios.get(`${API_URL}/products/batches`, {
      params: { farm_id: farmId },
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    console.log('✅ Get batches (query) successful');
    console.log(`   Found ${response.data.length} batches`);
    return true;
  } catch (error) {
    console.error('❌ Get batches (query) failed:', error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('========================================');
  console.log('🧪 Product Batches API Tests');
  console.log('========================================');
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`📧 Test Email: ${TEST_EMAIL}`);
  console.log('========================================');

  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('\n❌ Cannot proceed without login. Please check credentials.');
    return;
  }

  if (!farmId) {
    console.log('\n❌ No farm_id found. Please create a farm first.');
    return;
  }

  await testCreateBatch();
  await testGetBatchesByFarm();
  await testGetBatchesQuery();

  console.log('\n========================================');
  console.log('✅ All Product Batch Tests Complete!');
  console.log('========================================');
  console.log('\n💡 Next Steps:');
  console.log('   1. Start frontend: cd farmfreshbd-frontend && npm run dev');
  console.log('   2. Go to Products page');
  console.log('   3. Try adding a new product');
  console.log('   4. Product batches dropdown should load');
}

runTests().catch(console.error);
