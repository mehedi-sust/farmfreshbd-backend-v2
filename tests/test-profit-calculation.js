require('dotenv').config();
const { connectToDatabase, getCollections } = require('./src/config/database');

async function testProfitCalculation() {
  try {
    console.log('🧪 Testing Profit Calculation...\n');
    
    const { db } = await connectToDatabase();
    const { products, expenses, productBatches } = getCollections(db);

    // Get a sample product
    const product = await products.findOne({ status: 'unsold' });
    
    if (!product) {
      console.log('❌ No unsold products found. Create a product first.');
      process.exit(1);
    }

    console.log('📦 Product Details:');
    console.log('================================');
    console.log(`Name: ${product.name}`);
    console.log(`Quantity: ${product.quantity}`);
    console.log(`Unit Price (buying cost): ৳${product.unit_price}`);
    console.log(`Batch ID: ${product.product_batch}`);

    // Get batch name
    let batchName = 'N/A';
    if (product.product_batch) {
      const batch = await productBatches.findOne({ _id: product.product_batch });
      if (batch) {
        batchName = batch.name;
        console.log(`Batch Name: ${batchName}`);
      }
    }

    // Get expenses for this batch
    console.log('\n💰 Batch Expenses:');
    console.log('================================');
    
    let totalBatchExpenses = 0;
    if (product.product_batch) {
      const batchExpenses = await expenses.find({ 
        product_batch: product.product_batch.toString()
      }).toArray();
      
      if (batchExpenses.length > 0) {
        console.log(`Found ${batchExpenses.length} expenses for this batch:`);
        batchExpenses.forEach((expense, index) => {
          console.log(`${index + 1}. ${expense.type}: ${expense.description} - ৳${expense.amount}`);
          totalBatchExpenses += expense.amount;
        });
        console.log(`\nTotal Batch Expenses: ৳${totalBatchExpenses}`);
      } else {
        console.log('No expenses found for this batch');
      }
    }

    // Calculate profit for selling 10 units at ৳150 each
    const quantityToSell = Math.min(10, product.quantity);
    const sellingPrice = 150;

    console.log('\n📊 Profit Calculation:');
    console.log('================================');
    console.log(`Quantity to sell: ${quantityToSell}`);
    console.log(`Selling price per unit: ৳${sellingPrice}`);
    console.log(`\nCost Breakdown:`);
    console.log(`  Unit buying cost: ৳${product.unit_price}`);
    
    const avgExpensePerUnit = product.quantity > 0 ? totalBatchExpenses / product.quantity : 0;
    console.log(`  Average expense per unit: ৳${avgExpensePerUnit.toFixed(2)}`);
    console.log(`    (Total expenses ৳${totalBatchExpenses} / ${product.quantity} units)`);
    
    const totalCostPerUnit = product.unit_price + avgExpensePerUnit;
    console.log(`  Total cost per unit: ৳${totalCostPerUnit.toFixed(2)}`);
    
    const profitPerUnit = sellingPrice - totalCostPerUnit;
    console.log(`\nProfit per unit: ৳${profitPerUnit.toFixed(2)}`);
    console.log(`  (Selling price ৳${sellingPrice} - Total cost ৳${totalCostPerUnit.toFixed(2)})`);
    
    const totalProfit = profitPerUnit * quantityToSell;
    console.log(`\nTotal Profit: ৳${totalProfit.toFixed(2)}`);
    console.log(`  (Profit per unit ৳${profitPerUnit.toFixed(2)} × ${quantityToSell} units)`);

    // Show the formula
    console.log('\n📐 Formula:');
    console.log('================================');
    console.log('Profit = (Selling Price - Total Cost) × Quantity');
    console.log('Where:');
    console.log('  Total Cost = Unit Buying Cost + Average Expense Per Unit');
    console.log('  Average Expense Per Unit = Total Batch Expenses / Total Batch Quantity');
    console.log('\nExample:');
    console.log(`  Profit = (৳${sellingPrice} - ৳${totalCostPerUnit.toFixed(2)}) × ${quantityToSell}`);
    console.log(`  Profit = ৳${profitPerUnit.toFixed(2)} × ${quantityToSell}`);
    console.log(`  Profit = ৳${totalProfit.toFixed(2)}`);

    console.log('\n✅ Calculation complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testProfitCalculation();
