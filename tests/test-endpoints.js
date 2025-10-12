require('dotenv').config();

const BACKEND_URL = 'http://localhost:8000';
const FARM_ID = '68ea54101a80586217c5aecc';

// You'll need to replace this with a valid token
const TOKEN = 'YOUR_TOKEN_HERE';

async function testEndpoints() {
  console.log('🧪 Testing API Endpoints...\n');

  try {
    // Test 1: Get product batches
    console.log('1️⃣ Testing GET /product_batches/farm/:farm_id');
    console.log(`   URL: ${BACKEND_URL}/product_batches/farm/${FARM_ID}`);
    const batchesResponse = await fetch(`${BACKEND_URL}/product_batches/farm/${FARM_ID}`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`   Status: ${batchesResponse.status}`);
    if (batchesResponse.ok) {
      const batches = await batchesResponse.json();
      console.log(`   ✅ Response:`, JSON.stringify(batches, null, 2));
    } else {
      const error = await batchesResponse.text();
      console.log(`   ❌ Error:`, error);
    }

    console.log('\n');

    // Test 2: Get expense types
    console.log('2️⃣ Testing GET /expense_types/farm/:farm_id');
    console.log(`   URL: ${BACKEND_URL}/expense_types/farm/${FARM_ID}`);
    const typesResponse = await fetch(`${BACKEND_URL}/expense_types/farm/${FARM_ID}`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`   Status: ${typesResponse.status}`);
    if (typesResponse.ok) {
      const types = await typesResponse.json();
      console.log(`   ✅ Response:`, JSON.stringify(types, null, 2));
    } else {
      const error = await typesResponse.text();
      console.log(`   ❌ Error:`, error);
    }

    console.log('\n✅ Test complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

console.log('⚠️  NOTE: You need to update the TOKEN variable in this script');
console.log('   1. Login to get a token');
console.log('   2. Replace TOKEN value in test-endpoints.js');
console.log('   3. Run this script again\n');

// Uncomment to run (after adding token)
// testEndpoints();
