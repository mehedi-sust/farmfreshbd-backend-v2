/**
 * Test Registration and Login
 * Run this to verify auth endpoints are working
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8000';

async function testAuth() {
  console.log('');
  console.log('========================================');
  console.log('🧪 Testing Authentication');
  console.log('========================================');
  console.log('');

  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'password123';
  const testRole = 'farmer';

  try {
    // Test 1: Register
    console.log('📝 Test 1: Registration');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Role: ${testRole}`);
    console.log('');

    const registerResponse = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        role: testRole,
      }),
    });

    console.log(`   Status: ${registerResponse.status} ${registerResponse.statusText}`);

    if (!registerResponse.ok) {
      const error = await registerResponse.json();
      console.log('   ❌ Registration failed:', error);
      return;
    }

    const registerData = await registerResponse.json();
    console.log('   ✅ Registration successful!');
    console.log('   User ID:', registerData.userId);
    console.log('   Token:', registerData.token.substring(0, 20) + '...');
    console.log('');

    // Test 2: Login
    console.log('🔐 Test 2: Login');
    console.log(`   Email: ${testEmail}`);
    console.log('');

    const loginResponse = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    console.log(`   Status: ${loginResponse.status} ${loginResponse.statusText}`);

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      console.log('   ❌ Login failed:', error);
      return;
    }

    const loginData = await loginResponse.json();
    console.log('   ✅ Login successful!');
    console.log('   Token:', loginData.token.substring(0, 20) + '...');
    console.log('   User:', loginData.user);
    console.log('');

    // Test 3: Get Current User
    console.log('👤 Test 3: Get Current User');
    console.log('');

    const meResponse = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
      },
    });

    console.log(`   Status: ${meResponse.status} ${meResponse.statusText}`);

    if (!meResponse.ok) {
      const error = await meResponse.json();
      console.log('   ❌ Get user failed:', error);
      return;
    }

    const meData = await meResponse.json();
    console.log('   ✅ Get user successful!');
    console.log('   User:', meData);
    console.log('');

    console.log('========================================');
    console.log('✅ All Authentication Tests PASSED!');
    console.log('========================================');
    console.log('');

  } catch (error) {
    console.log('');
    console.log('========================================');
    console.log('❌ Test Failed!');
    console.log('========================================');
    console.log('');
    console.error('Error:', error.message);
    console.log('');
    console.log('💡 Make sure the server is running:');
    console.log('   cd farmfreshbd-backend-v2');
    console.log('   npm run dev');
    console.log('');
  }
}

testAuth();
