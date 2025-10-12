require('dotenv').config();
const { connectToDatabase, getCollections } = require('./src/config/database');

async function testSeparation() {
  try {
    console.log('🧪 Testing Collection Separation...\n');
    
    const { db } = await connectToDatabase();
    const { productBatches, expenseTypes } = getCollections(db);

    // Get a sample farm_id from the database
    const { farms } = getCollections(db);
    const farm = await farms.findOne({});
    
    if (!farm) {
      console.log('❌ No farm found. Please create a farm first.');
      process.exit(1);
    }

    const farm_id = farm._id;
    console.log(`📍 Using Farm ID: ${farm_id}\n`);

    // Test 1: Check product batches
    console.log('1️⃣ Product Batches (from product_batches collection):');
    console.log('   Should show: test-01, and any other batches');
    const batches = await productBatches.find({ farm_id }).toArray();
    console.log(`   Found ${batches.length} batches:`);
    batches.forEach(b => console.log(`   - ${b.name} (ID: ${b._id})`));

    // Test 2: Check expense types
    console.log('\n2️⃣ Expense Types (from expense_types collection):');
    console.log('   Should show: Food, Medicine, Vaccine, etc.');
    const types = await expenseTypes.find({
      $or: [
        { is_default: true },
        { farm_id }
      ]
    }).toArray();
    console.log(`   Found ${types.length} expense types:`);
    types.forEach(t => console.log(`   - ${t.name} (ID: ${t._id})`));

    // Test 3: Verify no overlap
    console.log('\n3️⃣ Verification:');
    const batchNames = batches.map(b => b.name);
    const typeNames = types.map(t => t.name);
    
    const overlap = batchNames.filter(name => typeNames.includes(name));
    
    if (overlap.length > 0) {
      console.log(`   ❌ PROBLEM: Found ${overlap.length} items in both collections:`);
      overlap.forEach(name => console.log(`      - ${name}`));
    } else {
      console.log('   ✅ SUCCESS: No overlap between batches and expense types!');
      console.log('   ✅ Collections are properly separated!');
    }

    console.log('\n✅ Test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testSeparation();
