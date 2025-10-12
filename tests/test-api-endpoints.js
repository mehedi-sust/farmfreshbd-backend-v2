require('dotenv').config();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

async function testEndpoints() {
  console.log('🧪 Testing API Endpoints...\n');
  console.log(`Backend URL: ${BACKEND_URL}\n`);

  try {
    // Step 1: Register a test user
    console.log('1️⃣ Registering test user...');
    const registerResponse = await fetch(`${BACKEND_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test_${Date.now()}@example.com`,
        password: 'test123',
        role: 'farm_manager'
      })
    });

    if (!registerResponse.ok) {
      console.log('   ⚠️  Registration failed (user might already exist), trying login...');
    } else {
      console.log('   ✅ User registered');
    }

    // Step 2: Login
    console.log('\n2️⃣ Logging in...');
    const loginResponse = await fetch(`${BACKEND_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'test123'
      })
    });

    if (!loginResponse.ok) {
      console.log('   ❌ Login failed. Please make sure you have a test user.');
      console.log('   Run: node test-register-login.js first');
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.access_token;
    const userId = loginData.user_id;
    console.log('   ✅ Logged in successfully');

    // Step 3: Get or create farm
    console.log('\n3️⃣ Getting farm...');
    const farmsResponse = await fetch(`${BACKEND_URL}/farms`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    let farmId;
    if (farmsResponse.ok) {
      const farms = await farmsResponse.json();
      if (farms.length > 0) {
        farmId = farms[0]._id;
        console.log(`   ✅ Using existing farm: ${farmId}`);
      }
    }

    if (!farmId) {
      console.log('   Creating new farm...');
      const createFarmResponse = await fetch(`${BACKEND_URL}/farms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Farm',
          type: 'dairy',
          location: 'Test Location'
        })
      });

      if (createFarmResponse.ok) {
        const farm = await createFarmResponse.json();
        farmId = farm._id;
        console.log(`   ✅ Created farm: ${farmId}`);
      } else {
        console.log('   ❌ Failed to create farm');
        return;
      }
    }

    // Step 4: Test Product Batches endpoint
    console.log('\n4️⃣ Testing Product Batches endpoint...');
    console.log(`   GET ${BACKEND_URL}/product_batches/farm/${farmId}`);
    const batchesResponse = await fetch(`${BACKEND_URL}/product_batches/farm/${farmId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (batchesResponse.ok) {
      const batches = await batchesResponse.json();
      console.log(`   ✅ SUCCESS: Got ${batches.length} product batches`);
      batches.forEach(b => console.log(`      - ${b.name}`));
    } else {
      const error = await batchesResponse.text();
      console.log(`   ❌ FAILED: ${batchesResponse.status} - ${error}`);
    }

    // Step 5: Test Expense Types endpoint
    console.log('\n5️⃣ Testing Expense Types endpoint...');
    console.log(`   GET ${BACKEND_URL}/expense_types/farm/${farmId}`);
    const typesResponse = await fetch(`${BACKEND_URL}/expense_types/farm/${farmId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (typesResponse.ok) {
      const types = await typesResponse.json();
      console.log(`   ✅ SUCCESS: Got ${types.length} expense types`);
      types.forEach(t => console.log(`      - ${t.name}`));
    } else {
      const error = await typesResponse.text();
      console.log(`   ❌ FAILED: ${typesResponse.status} - ${error}`);
    }

    // Step 6: Verify they're different
    console.log('\n6️⃣ Verification:');
    if (batchesResponse.ok && typesResponse.ok) {
      const batches = await fetch(`${BACKEND_URL}/product_batches/farm/${farmId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json());
      
      const types = await fetch(`${BACKEND_URL}/expense_types/farm/${farmId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json());

      const batchNames = batches.map(b => b.name);
      const typeNames = types.map(t => t.name);
      
      const overlap = batchNames.filter(name => typeNames.includes(name));
      
      if (overlap.length > 0) {
        console.log(`   ❌ PROBLEM: Found ${overlap.length} items in both endpoints:`);
        overlap.forEach(name => console.log(`      - ${name}`));
      } else {
        console.log('   ✅ SUCCESS: Endpoints return different data!');
        console.log('   ✅ Product batches and expense types are properly separated!');
      }
    }

    console.log('\n✅ All tests complete!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testEndpoints();
