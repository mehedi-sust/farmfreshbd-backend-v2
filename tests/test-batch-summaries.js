const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testBatchSummaries() {
  try {
    console.log('Testing Batch Summaries API...\n');

    // Login first
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'password123'
    });

    const token = loginResponse.data.access_token;
    const farmId = loginResponse.data.farm_id;
    console.log('✓ Logged in successfully');
    console.log(`  Farm ID: ${farmId}\n`);

    // Get batch summaries
    console.log('2. Fetching batch summaries...');
    const summariesResponse = await axios.get(
      `${BASE_URL}/stats/farm/${farmId}/batch_summaries`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('✓ Batch summaries fetched successfully\n');
    console.log('Response data:');
    console.log(JSON.stringify(summariesResponse.data, null, 2));

    // Check data types
    console.log('\n3. Checking data types...');
    summariesResponse.data.forEach((summary, index) => {
      console.log(`\nBatch ${index + 1}: ${summary.batch_name}`);
      console.log(`  total_expenses type: ${typeof summary.total_expenses} = ${summary.total_expenses}`);
      console.log(`  total_products_value type: ${typeof summary.total_products_value} = ${summary.total_products_value}`);
      console.log(`  total_original_quantity_in_batch type: ${typeof summary.total_original_quantity_in_batch} = ${summary.total_original_quantity_in_batch}`);
      
      if (summary.products && summary.products.length > 0) {
        console.log(`  First product:`);
        const p = summary.products[0];
        console.log(`    unit_price type: ${typeof p.unit_price} = ${p.unit_price}`);
        console.log(`    total_value type: ${typeof p.total_value} = ${p.total_value}`);
        console.log(`    quantity type: ${typeof p.quantity} = ${p.quantity}`);
      }
    });

    console.log('\n✓ All tests passed!');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testBatchSummaries();
