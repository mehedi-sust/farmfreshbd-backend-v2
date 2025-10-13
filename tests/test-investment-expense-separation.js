require('dotenv').config();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

async function testSeparation() {
  console.log('🧪 Testing Investment and Expense Separation...\n');
  console.log(`Backend URL: ${BACKEND_URL}\n`);

  try {
    // Step 1: Login
    console.log('1️⃣ Logging in...');
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
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.access_token;
    console.log('   ✅ Logged in successfully');

    // Step 2: Get farm
    console.log('\n2️⃣ Getting farm...');
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
        console.log(`   ✅ Using farm: ${farmId}`);
      }
    }

    if (!farmId) {
      console.log('   ❌ No farm found');
      return;
    }

    // Step 3: Create a test expense
    console.log('\n3️⃣ Creating test expense...');
    const expenseResponse = await fetch(`${BACKEND_URL}/finance/expenses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'Food',
        description: 'Test expense for chicken feed',
        amount: 1500,
        farm_id: farmId,
        product_batch: 'test-batch'
      })
    });

    if (expenseResponse.ok) {
      const expense = await expenseResponse.json();
      console.log(`   ✅ Created expense: ${expense.description}`);
    } else {
      const error = await expenseResponse.text();
      console.log(`   ⚠️  Expense creation: ${error}`);
    }

    // Step 4: Create a test investment
    console.log('\n4️⃣ Creating test investment...');
    const investmentResponse = await fetch(`${BACKEND_URL}/finance/investments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'infrastructure',
        description: 'Test investment for new barn',
        amount: 50000,
        farm_id: farmId
      })
    });

    if (investmentResponse.ok) {
      const investment = await investmentResponse.json();
      console.log(`   ✅ Created investment: ${investment.description}`);
    } else {
      const error = await investmentResponse.text();
      console.log(`   ⚠️  Investment creation: ${error}`);
    }

    // Step 5: Fetch expenses
    console.log('\n5️⃣ Fetching expenses...');
    const getExpensesResponse = await fetch(`${BACKEND_URL}/finance/expenses?farm_id=${farmId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    let expenses = [];
    if (getExpensesResponse.ok) {
      expenses = await getExpensesResponse.json();
      console.log(`   ✅ Found ${expenses.length} expenses:`);
      expenses.forEach(e => {
        console.log(`      - ${e.description} (Type: ${e.type}, Amount: ৳${e.amount})`);
      });
    } else {
      console.log(`   ❌ Failed to fetch expenses`);
    }

    // Step 6: Fetch investments
    console.log('\n6️⃣ Fetching investments...');
    const getInvestmentsResponse = await fetch(`${BACKEND_URL}/finance/investments?farm_id=${farmId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    let investments = [];
    if (getInvestmentsResponse.ok) {
      investments = await getInvestmentsResponse.json();
      console.log(`   ✅ Found ${investments.length} investments:`);
      investments.forEach(i => {
        console.log(`      - ${i.description} (Type: ${i.type}, Amount: ৳${i.amount})`);
      });
    } else {
      console.log(`   ❌ Failed to fetch investments`);
    }

    // Step 7: Verify separation
    console.log('\n7️⃣ Verification:');
    console.log('================================');
    
    // Check if any expense appears in investments
    const expenseDescriptions = expenses.map(e => e.description);
    const investmentDescriptions = investments.map(i => i.description);
    
    const expensesInInvestments = expenseDescriptions.filter(desc => 
      investmentDescriptions.includes(desc)
    );
    
    if (expensesInInvestments.length > 0) {
      console.log(`   ❌ PROBLEM: Found ${expensesInInvestments.length} items in both lists:`);
      expensesInInvestments.forEach(desc => console.log(`      - ${desc}`));
    } else {
      console.log('   ✅ SUCCESS: No overlap between expenses and investments!');
    }

    // Check expense types
    const expenseTypes = [...new Set(expenses.map(e => e.type))];
    const investmentTypes = [...new Set(investments.map(i => i.type))];
    
    console.log(`\n   Expense types: ${expenseTypes.join(', ') || 'None'}`);
    console.log(`   Investment types: ${investmentTypes.join(', ') || 'None'}`);
    
    // Check for product_batch in investments
    const investmentsWithBatch = investments.filter(i => i.product_batch);
    if (investmentsWithBatch.length > 0) {
      console.log(`\n   ❌ PROBLEM: ${investmentsWithBatch.length} investments have product_batch field!`);
    } else {
      console.log(`\n   ✅ Investments don't have product_batch field`);
    }

    // Check for investment types in expenses
    const investmentTypesList = ['infrastructure', 'tools', 'others'];
    const expensesWithInvestmentTypes = expenses.filter(e => 
      investmentTypesList.includes(e.type)
    );
    if (expensesWithInvestmentTypes.length > 0) {
      console.log(`   ❌ PROBLEM: ${expensesWithInvestmentTypes.length} expenses have investment types!`);
    } else {
      console.log(`   ✅ Expenses don't have investment types`);
    }

    console.log('\n✅ All tests complete!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testSeparation();
