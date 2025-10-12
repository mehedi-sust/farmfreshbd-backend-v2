const axios = require('axios');

const API_URL = 'http://localhost:8000';

// Test credentials - update these with your actual test account
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

let authToken = '';
let farmId = '';

async function login() {
  console.log('\n🔐 Testing Login...');
  try {
    const response = await axios.post(`${API_URL}/users/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    
    authToken = response.data.access_token;
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

async function testStatsEndpoint() {
  console.log('\n📊 Testing Stats Endpoint (GET /stats/farm/:farm_id)...');
  try {
    const response = await axios.get(`${API_URL}/stats/farm/${farmId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    console.log('✅ Stats endpoint successful');
    console.log('   Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Stats endpoint failed:', error.response?.data || error.message);
    return false;
  }
}

async function testUpdateStatsEndpoint() {
  console.log('\n🔄 Testing Update Stats Endpoint (POST /stats/farm/:farm_id/update_stats_data)...');
  try {
    const response = await axios.post(`${API_URL}/stats/farm/${farmId}/update_stats_data`, {}, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    console.log('✅ Update stats endpoint successful');
    console.log('   Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Update stats endpoint failed:', error.response?.data || error.message);
    return false;
  }
}

async function testMonthlyFinancialEndpoint() {
  console.log('\n📈 Testing Monthly Financial Endpoint (GET /stats/farm/:farm_id/monthly_financial)...');
  try {
    const response = await axios.get(`${API_URL}/stats/farm/${farmId}/monthly_financial`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    console.log('✅ Monthly financial endpoint successful');
    console.log(`   Returned ${response.data.length} months of data`);
    console.log('   Sample (first 3 months):', JSON.stringify(response.data.slice(0, 3), null, 2));
    return true;
  } catch (error) {
    console.error('❌ Monthly financial endpoint failed:', error.response?.data || error.message);
    return false;
  }
}

async function testCurrentYearProfitEndpoint() {
  console.log('\n💰 Testing Current Year Profit Endpoint (GET /stats/farm/:farm_id/current_year_profit)...');
  try {
    const response = await axios.get(`${API_URL}/stats/farm/${farmId}/current_year_profit`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    console.log('✅ Current year profit endpoint successful');
    console.log(`   Returned ${response.data.length} months of data`);
    console.log('   Sample (first 3 months):', JSON.stringify(response.data.slice(0, 3), null, 2));
    return true;
  } catch (error) {
    console.error('❌ Current year profit endpoint failed:', error.response?.data || error.message);
    return false;
  }
}

async function testProfitOverTimeEndpoint() {
  console.log('\n📊 Testing Profit Over Time Endpoint (GET /stats/farm/:farm_id/profit_over_time)...');
  try {
    const response = await axios.get(`${API_URL}/stats/farm/${farmId}/profit_over_time`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    console.log('✅ Profit over time endpoint successful');
    console.log(`   Returned ${response.data.length} months of data`);
    console.log('   Sample (first 3 months):', JSON.stringify(response.data.slice(0, 3), null, 2));
    return true;
  } catch (error) {
    console.error('❌ Profit over time endpoint failed:', error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('========================================');
  console.log('🧪 FarmFresh BD Stats API Tests');
  console.log('========================================');
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`📧 Test Email: ${TEST_EMAIL}`);
  console.log('========================================');

  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('\n❌ Cannot proceed without login. Please check credentials.');
    return;
  }

  await testStatsEndpoint();
  await testUpdateStatsEndpoint();
  await testMonthlyFinancialEndpoint();
  await testCurrentYearProfitEndpoint();
  await testProfitOverTimeEndpoint();

  console.log('\n========================================');
  console.log('✅ All Stats Tests Complete!');
  console.log('========================================');
}

runTests().catch(console.error);
