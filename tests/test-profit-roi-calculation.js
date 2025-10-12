const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

// Test data
const testUser = {
  email: 'testfarmer@example.com',
  password: 'password123',
  name: 'Test Farmer',
  phone: '1234567890',
  address: 'Test Address',
  role: 'farm_manager'
};

let authToken = '';
let farmId = '';

async function testProfitROICalculation() {
  console.log('🧪 Testing Farm Profit and ROI Calculation...\n');

  try {
    // 1. Register/Login user
    console.log('1️⃣ Setting up test user...');
    try {
      await axios.post(`${BASE_URL}/auth/register`, testUser);
      console.log('✅ User registered');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('ℹ️ User already exists, proceeding with login');
      } else {
        throw error;
      }
    }

    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    authToken = loginResponse.data.token;
    console.log('✅ User logged in');

    // 2. Create a farm
    console.log('\n2️⃣ Creating test farm...');
    const farmResponse = await axios.post(`${BASE_URL}/farms`, {
      name: 'Test Farm for Profit Calculation',
      location: 'Test Location',
      size: 100,
      description: 'Test farm for profit and ROI calculation'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    farmId = farmResponse.data._id;
    console.log(`✅ Farm created with ID: ${farmId}`);

    // 3. Add investments
    console.log('\n3️⃣ Adding investments...');
    const investment1 = await axios.post(`${BASE_URL}/investments`, {
      farm_id: farmId,
      type: 'Infrastructure',
      description: 'Greenhouse construction',
      amount: 50000,
      date: new Date().toISOString()
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const investment2 = await axios.post(`${BASE_URL}/investments`, {
      farm_id: farmId,
      type: 'Equipment',
      description: 'Irrigation system',
      amount: 30000,
      date: new Date().toISOString()
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Added investments: ৳50,000 + ৳30,000 = ৳80,000 total');

    // 4. Add products
    console.log('\n4️⃣ Adding products...');
    const product1 = await axios.post(`${BASE_URL}/products`, {
      farm_id: farmId,
      name: 'Tomatoes',
      type: 'vegetables',
      quantity: 100,
      unit_price: 50,
      unit: 'kg'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const product2 = await axios.post(`${BASE_URL}/products`, {
      farm_id: farmId,
      name: 'Carrots',
      type: 'vegetables',
      quantity: 80,
      unit_price: 40,
      unit: 'kg'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Added products: 100kg Tomatoes (৳5,000) + 80kg Carrots (৳3,200) = ৳8,200 total');

    // 5. Add expenses
    console.log('\n5️⃣ Adding expenses...');
    const expense1 = await axios.post(`${BASE_URL}/expenses`, {
      farm_id: farmId,
      type: 'Seeds',
      description: 'Tomato seeds',
      amount: 1000,
      date: new Date().toISOString()
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const expense2 = await axios.post(`${BASE_URL}/expenses`, {
      farm_id: farmId,
      type: 'Fertilizer',
      description: 'Organic fertilizer',
      amount: 2000,
      date: new Date().toISOString()
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Added expenses: ৳1,000 + ৳2,000 = ৳3,000 total');

    // 6. Add sales
    console.log('\n6️⃣ Adding sales...');
    const sale1 = await axios.post(`${BASE_URL}/sales`, {
      farm_id: farmId,
      product_id: product1.data._id,
      quantity_sold: 60,
      price_per_unit: 80,
      sale_date: new Date().toISOString()
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const sale2 = await axios.post(`${BASE_URL}/sales`, {
      farm_id: farmId,
      product_id: product2.data._id,
      quantity_sold: 50,
      price_per_unit: 70,
      sale_date: new Date().toISOString()
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Added sales: 60kg Tomatoes @ ৳80 (৳4,800) + 50kg Carrots @ ৳70 (৳3,500) = ৳8,300 revenue');

    // 7. Get stats and verify calculations
    console.log('\n7️⃣ Calculating and verifying stats...');
    const statsResponse = await axios.get(`${BASE_URL}/stats/farm/${farmId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const stats = statsResponse.data;
    console.log('\n📊 Farm Statistics:');
    console.log(`   Total Investments: ৳${stats.total_investments.toFixed(2)}`);
    console.log(`   Total Products Value: ৳${stats.total_products.toFixed(2)}`);
    console.log(`   Total Expenses: ৳${stats.total_expenses.toFixed(2)}`);
    console.log(`   Total Sales Revenue: ৳${stats.total_sales.toFixed(2)}`);
    console.log(`   Sales Profit: ৳${stats.total_profit.toFixed(2)}`);
    console.log(`   Farm's Gross Profit: ৳${stats.gross_profit.toFixed(2)}`);
    console.log(`   ROI: ${stats.roi.toFixed(2)}%`);

    // 8. Manual calculation verification
    console.log('\n🧮 Manual Calculation Verification:');
    
    // Expected values
    const expectedInvestments = 80000; // 50000 + 30000
    const expectedProductValue = 8200; // (100*50) + (80*40)
    const expectedExpenses = 3000; // 1000 + 2000
    const expectedSalesRevenue = 8300; // (60*80) + (50*70)
    
    // Sales profit calculation (revenue - cost of sold products - expenses)
    const soldTomatoCost = 60 * 50; // 60kg at cost price ৳50
    const soldCarrotCost = 50 * 40; // 50kg at cost price ৳40
    const totalSoldProductCost = soldTomatoCost + soldCarrotCost;
    const expectedSalesProfit = expectedSalesRevenue - totalSoldProductCost - expectedExpenses;
    
    // Farm's gross profit (sales profit - investments)
    const expectedGrossProfit = expectedSalesProfit - expectedInvestments;
    
    // ROI calculation (sales profit / total investment * 100)
    const totalInvestment = expectedInvestments + expectedProductValue;
    const expectedROI = (expectedSalesProfit / totalInvestment) * 100;
    
    console.log(`   Expected Sales Profit: ৳${expectedSalesProfit.toFixed(2)}`);
    console.log(`   Expected Farm's Gross Profit: ৳${expectedGrossProfit.toFixed(2)}`);
    console.log(`   Expected ROI: ${expectedROI.toFixed(2)}%`);
    
    // Verify calculations
    console.log('\n✅ Verification Results:');
    console.log(`   Investments: ${stats.total_investments === expectedInvestments ? '✅' : '❌'} (${stats.total_investments} vs ${expectedInvestments})`);
    console.log(`   Sales Profit: ${Math.abs(stats.total_profit - expectedSalesProfit) < 0.01 ? '✅' : '❌'} (${stats.total_profit.toFixed(2)} vs ${expectedSalesProfit.toFixed(2)})`);
    console.log(`   Farm's Gross Profit: ${Math.abs(stats.gross_profit - expectedGrossProfit) < 0.01 ? '✅' : '❌'} (${stats.gross_profit.toFixed(2)} vs ${expectedGrossProfit.toFixed(2)})`);
    console.log(`   ROI: ${Math.abs(stats.roi - expectedROI) < 0.01 ? '✅' : '❌'} (${stats.roi.toFixed(2)}% vs ${expectedROI.toFixed(2)}%)`);

    console.log('\n🎉 Profit and ROI calculation test completed!');
    
    // 9. Explanation
    console.log('\n📝 Calculation Explanation:');
    console.log('   Sales Revenue: ৳8,300 (60kg × ৳80 + 50kg × ৳70)');
    console.log('   Cost of Sold Products: ৳5,000 (60kg × ৳50 + 50kg × ৳40)');
    console.log('   Expenses: ৳3,000');
    console.log('   Sales Profit: ৳8,300 - ৳5,000 - ৳3,000 = ৳300');
    console.log('   Total Investments: ৳80,000');
    console.log('   Farm\'s Gross Profit: ৳300 - ৳80,000 = -৳79,700 (Loss)');
    console.log('   Total Investment (for ROI): ৳80,000 + ৳8,200 = ৳88,200');
    console.log('   ROI: (৳300 ÷ ৳88,200) × 100 = 0.34%');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
testProfitROICalculation();