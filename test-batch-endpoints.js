const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

// Test data
const testUser = {
  email: 'batchtest@example.com',
  password: 'password123',
  name: 'Batch Test User',
  phone: '01234567890',
  role: 'farmer'
};

const testFarm = {
  farm_name: 'Test Batch Farm',
  farm_type: 'mixed',
  address: 'Test Address',
  location: 'Test Location',
  bio: 'Test farm for batch management'
};

let authToken = '';
let userId = '';
let farmId = ''; // Will be set from actual farm creation

async function testBatchEndpoints() {
    try {
        console.log('🧪 Testing Batch Management Endpoints\n');

        // 1. Login/Register user
        console.log('1️⃣ Logging in user...');
        try {
            const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
                email: testUser.email,
                password: testUser.password
            });
            authToken = loginResponse.data.token;
            userId = loginResponse.data.user.id;
            console.log('   ✅ User authenticated');
        } catch (loginError) {
            // If login fails, try to register
            console.log('   ⚠️ Login failed, attempting registration...');
            const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, testUser);
            userId = registerResponse.data.id;
            console.log('   ✅ User registered');
            
            // Now login to get token
            const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
                email: testUser.email,
                password: testUser.password
            });
            authToken = loginResponse.data.token;
            userId = loginResponse.data.user.id;
            console.log('   ✅ User authenticated after registration');
        }

        // 2. Setup farm
        console.log('\n2️⃣ Setting up farm...');
        try {
            // First check if user already has a farm
            const userFarmResponse = await axios.get(`${BASE_URL}/api/farms/user/${userId}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            farmId = userFarmResponse.data.id;
            console.log('   ✅ Using existing farm:', farmId);
        } catch (farmError) {
            // If no farm exists, create one
            console.log('   ⚠️ No existing farm, creating new one...');
            const farmData = { ...testFarm, user_id: userId };
            const farmResponse = await axios.post(`${BASE_URL}/api/farms/create-farm`, farmData, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            farmId = farmResponse.data.id;
            console.log('   ✅ Farm created:', farmId);
        }

        const headers = { Authorization: `Bearer ${authToken}` };

        // 3. Test GET batches (should be empty initially)
        console.log('\n3️⃣ Testing GET /api/product_batches/farm/:farm_id');
        const getBatchesResponse = await axios.get(`${BASE_URL}/api/product_batches/farm/${farmId}`, { headers });
        console.log(`   ✅ Retrieved ${getBatchesResponse.data.length} batches`);

        // 4. Test CREATE batch
        console.log('\n4️⃣ Testing POST /api/product_batches');
        const createBatchResponse = await axios.post(`${BASE_URL}/api/product_batches`, {
            name: 'Test Batch 1',
            farm_id: farmId
        }, { headers });
        
        const batchId = createBatchResponse.data.id;
        console.log(`   ✅ Created batch: ${createBatchResponse.data.name} (ID: ${batchId})`);

        // 5. Test UPDATE batch (toggle visibility)
        console.log('\n5️⃣ Testing PUT /api/product_batches/:id');
        const updateBatchResponse = await axios.put(`${BASE_URL}/api/product_batches/${batchId}`, {
            is_available: false
        }, { headers });
        
        console.log(`   ✅ Updated batch visibility: ${updateBatchResponse.data.is_available}`);

        // 6. Test GET batches again (should show updated batch)
        console.log('\n6️⃣ Testing GET batches again...');
        const getBatchesResponse2 = await axios.get(`${BASE_URL}/api/product_batches/farm/${farmId}`, { headers });
        console.log(`   ✅ Retrieved ${getBatchesResponse2.data.length} batches`);
        console.log(`   📦 Batch "${getBatchesResponse2.data[0].name}" is_available: ${getBatchesResponse2.data[0].is_available}`);

        console.log('\n🎉 All batch management endpoints working correctly!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.response?.data || error.message);
        console.error('Status:', error.response?.status);
    }
}

testBatchEndpoints();