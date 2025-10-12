const axios = require('axios');

const API_URL = 'http://localhost:8000';

// Test credentials
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

let authToken = '';
let userId = '';
let farmId = '';

async function testLogin() {
  console.log('\n🔐 Testing Login...');
  try {
    const response = await axios.post(`${API_URL}/users/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    
    authToken = response.data.access_token || response.data.token;
    userId = response.data.user._id;
    farmId = response.data.farm_id;
    
    console.log('✅ Login successful');
    console.log(`   Token: ${authToken.substring(0, 20)}...`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Farm ID: ${farmId || 'No farm yet'}`);
    console.log('\n📦 Full Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

async function testGetFarm() {
  if (!farmId) {
    console.log('\n⚠️ No farm_id, skipping farm fetch test');
    return false;
  }

  console.log('\n🏡 Testing Get Farm...');
  try {
    const response = await axios.get(`${API_URL}/farms/${farmId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    console.log('✅ Farm fetch successful');
    console.log('\n📦 Farm Data:');
    console.log(JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Farm fetch failed:', error.response?.data || error.message);
    return false;
  }
}

async function testCreateFarm() {
  console.log('\n🏗️ Testing Create Farm...');
  try {
    const response = await axios.post(`${API_URL}/users/create-farm`, {
      farm_name: 'Test Farm',
      farm_type: 'multi_purpose',
      contact_number: '1234567890',
      address: 'Test Address',
      location: 'https://maps.google.com/test',
      bio: 'Test farm bio',
      build_year: '2025',
      banner_image: '',
      user_id: userId,
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    console.log('✅ Farm creation successful');
    console.log('\n📦 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Update farmId if returned
    if (response.data.farm_id) {
      farmId = response.data.farm_id;
      console.log(`\n✅ Farm ID updated: ${farmId}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Farm creation failed:', error.response?.data || error.message);
    return false;
  }
}

async function testDashboardStats() {
  if (!farmId) {
    console.log('\n⚠️ No farm_id, skipping dashboard stats test');
    return false;
  }

  console.log('\n📊 Testing Dashboard Stats...');
  try {
    const response = await axios.get(`${API_URL}/stats/farm/${farmId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    console.log('✅ Dashboard stats successful');
    console.log('\n📦 Stats:');
    console.log(JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Dashboard stats failed:', error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('========================================');
  console.log('🧪 Farm Flow Tests');
  console.log('========================================');
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`📧 Test Email: ${TEST_EMAIL}`);
  console.log('========================================');

  // Test 1: Login
  const loginSuccess = await testLogin();
  if (!loginSuccess) {
    console.log('\n❌ Cannot proceed without login. Please check credentials.');
    return;
  }

  // Test 2: Get Farm (if exists)
  if (farmId) {
    await testGetFarm();
  } else {
    console.log('\n⚠️ User has no farm, will test farm creation');
  }

  // Test 3: Create Farm (or get existing)
  await testCreateFarm();

  // Test 4: Dashboard Stats
  await testDashboardStats();

  console.log('\n========================================');
  console.log('✅ All Tests Complete!');
  console.log('========================================');
  console.log('\n📝 Summary:');
  console.log(`   User ID: ${userId}`);
  console.log(`   Farm ID: ${farmId || 'Not created'}`);
  console.log(`   Token: ${authToken ? 'Valid' : 'Invalid'}`);
  console.log('\n💡 Next Steps:');
  console.log('   1. Start frontend: cd farmfreshbd-frontend && npm run dev');
  console.log('   2. Login with test credentials');
  console.log('   3. Check if dashboard loads correctly');
  console.log('   4. Navigate to /my-farm to see farm info');
}

runTests().catch(console.error);
