require('dotenv').config();
const { connectToDatabase, getCollections } = require('./src/config/database');

async function checkExpensesAndInvestments() {
  try {
    console.log('🔍 Checking Expenses and Investments Collections...\n');
    
    const { db } = await connectToDatabase();
    const { expenses, investments } = getCollections(db);

    // Check expenses collection
    console.log('💰 EXPENSES Collection:');
    console.log('================================');
    const expensesList = await expenses.find({}).toArray();
    console.log(`Total documents: ${expensesList.length}`);
    expensesList.forEach((expense, index) => {
      console.log(`\n${index + 1}. Type: ${expense.type}`);
      console.log(`   Description: ${expense.description}`);
      console.log(`   Amount: ৳${expense.amount}`);
      console.log(`   Product Batch: ${expense.product_batch || 'N/A'}`);
      console.log(`   Farm ID: ${expense.farm_id}`);
      console.log(`   Date: ${expense.date}`);
    });

    // Check investments collection
    console.log('\n\n🏗️  INVESTMENTS Collection:');
    console.log('================================');
    const investmentsList = await investments.find({}).toArray();
    console.log(`Total documents: ${investmentsList.length}`);
    investmentsList.forEach((investment, index) => {
      console.log(`\n${index + 1}. Type: ${investment.type}`);
      console.log(`   Description: ${investment.description}`);
      console.log(`   Amount: ৳${investment.amount}`);
      console.log(`   Farm ID: ${investment.farm_id}`);
      console.log(`   Date: ${investment.date}`);
    });

    // Check for data mixing
    console.log('\n\n🔍 Verification:');
    console.log('================================');
    
    // Check if expenses have investment types
    const expenseTypes = expensesList.map(e => e.type);
    const investmentTypes = ['infrastructure', 'tools', 'others'];
    const expensesWithInvestmentTypes = expensesList.filter(e => 
      investmentTypes.includes(e.type)
    );
    
    if (expensesWithInvestmentTypes.length > 0) {
      console.log(`❌ PROBLEM: Found ${expensesWithInvestmentTypes.length} expenses with investment types:`);
      expensesWithInvestmentTypes.forEach(e => {
        console.log(`   - ${e.description} (Type: ${e.type})`);
      });
    } else {
      console.log('✅ No expenses with investment types found');
    }

    // Check if investments have expense types (with product_batch field)
    const investmentsWithBatch = investmentsList.filter(i => i.product_batch);
    
    if (investmentsWithBatch.length > 0) {
      console.log(`\n❌ PROBLEM: Found ${investmentsWithBatch.length} investments with product_batch field:`);
      investmentsWithBatch.forEach(i => {
        console.log(`   - ${i.description} (Batch: ${i.product_batch})`);
      });
    } else {
      console.log('✅ No investments with product_batch field found');
    }

    // Summary
    console.log('\n\n📊 Summary:');
    console.log('================================');
    console.log(`Expenses: ${expensesList.length} records`);
    console.log(`Investments: ${investmentsList.length} records`);
    
    if (expensesWithInvestmentTypes.length === 0 && investmentsWithBatch.length === 0) {
      console.log('\n✅ SUCCESS: Collections are properly separated!');
    } else {
      console.log('\n⚠️  WARNING: Data mixing detected. Run migration script.');
    }

    console.log('\n✅ Check complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkExpensesAndInvestments();
