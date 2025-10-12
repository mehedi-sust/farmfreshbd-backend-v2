require('dotenv').config();
const { connectToDatabase, getCollections } = require('./src/config/database');

async function checkCollections() {
  try {
    console.log('🔍 Checking database collections...\n');
    
    const { db } = await connectToDatabase();
    const { productBatches, expenseTypes } = getCollections(db);

    // Check product_batches collection
    console.log('📦 PRODUCT BATCHES Collection:');
    console.log('================================');
    const batches = await productBatches.find({}).toArray();
    console.log(`Total documents: ${batches.length}`);
    batches.forEach((batch, index) => {
      console.log(`\n${index + 1}. ${batch.name}`);
      console.log(`   ID: ${batch._id}`);
      console.log(`   Farm ID: ${batch.farm_id}`);
      console.log(`   Created: ${batch.created_at || 'N/A'}`);
    });

    // Check expense_types collection
    console.log('\n\n💰 EXPENSE TYPES Collection:');
    console.log('================================');
    const types = await expenseTypes.find({}).toArray();
    console.log(`Total documents: ${types.length}`);
    types.forEach((type, index) => {
      console.log(`\n${index + 1}. ${type.name}`);
      console.log(`   ID: ${type._id}`);
      console.log(`   Farm ID: ${type.farm_id || 'N/A'}`);
      console.log(`   Is Default: ${type.is_default || false}`);
      console.log(`   Created: ${type.created_at || 'N/A'}`);
    });

    console.log('\n\n✅ Check complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkCollections();
