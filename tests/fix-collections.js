/**
 * Script to fix mixed product_batches and expense_types
 * Moves expense types from product_batches to expense_types collection
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

// Known expense type names (case-insensitive)
const EXPENSE_TYPE_NAMES = ['food', 'medicine', 'vaccine', 'labor', 'feed', 'others', 'utilities', 'maintenance'];

async function fixCollections() {
  console.log('🔧 Starting collection fix...\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db('farmfreshbd');
    const productBatches = db.collection('product_batches');
    const expenseTypes = db.collection('expense_types');

    // Find all items in product_batches
    const allBatches = await productBatches.find({}).toArray();
    console.log(`📦 Found ${allBatches.length} items in product_batches collection\n`);

    let movedCount = 0;
    let keptCount = 0;

    for (const item of allBatches) {
      const itemName = item.name.toLowerCase();
      const isExpenseType = EXPENSE_TYPE_NAMES.some(type => itemName.includes(type));

      if (isExpenseType) {
        console.log(`🔄 Moving "${item.name}" to expense_types...`);
        
        // Check if it already exists in expense_types
        const existing = await expenseTypes.findOne({ 
          name: item.name,
          farm_id: item.farm_id 
        });

        if (!existing) {
          // Move to expense_types
          await expenseTypes.insertOne({
            name: item.name,
            farm_id: item.farm_id,
            is_default: false,
            created_at: item.created_at || new Date(),
          });
          console.log(`   ✅ Moved to expense_types`);
        } else {
          console.log(`   ⚠️  Already exists in expense_types`);
        }

        // Remove from product_batches
        await productBatches.deleteOne({ _id: item._id });
        console.log(`   ✅ Removed from product_batches\n`);
        movedCount++;
      } else {
        console.log(`✓ Keeping "${item.name}" in product_batches (it's a batch)`);
        keptCount++;
      }
    }

    console.log('\n========================================');
    console.log('📊 Summary:');
    console.log(`   Moved to expense_types: ${movedCount}`);
    console.log(`   Kept in product_batches: ${keptCount}`);
    console.log('========================================\n');

    // Show final counts
    const finalBatches = await productBatches.countDocuments();
    const finalTypes = await expenseTypes.countDocuments();

    console.log('📦 Final Collections:');
    console.log(`   product_batches: ${finalBatches} items`);
    console.log(`   expense_types: ${finalTypes} items\n`);

    console.log('✅ Collection fix complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

fixCollections();
