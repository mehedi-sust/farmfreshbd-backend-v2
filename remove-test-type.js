// Load environment variables first
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function removeTestType() {
  console.log('🔗 Using MongoDB URI:', process.env.MONGODB_URI ? 'Found in .env' : 'Not found');
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(process.env.DB_NAME_DEV || 'farm_fresh_bd_dev');
    const expense_types = db.collection('expense_types');
    
    // Find all expense types first
    console.log('\n📋 Current expense types:');
    const allTypes = await expense_types.find({}).toArray();
    allTypes.forEach((type, index) => {
      console.log(`${index + 1}. ${type.name} (ID: ${type._id})`);
    });
    
    // Find and remove "Test Type" (case insensitive)
    const testTypes = await expense_types.find({
      name: { $regex: /test/i }
    }).toArray();
    
    if (testTypes.length === 0) {
      console.log('\n✅ No "Test Type" entries found to remove.');
      return;
    }
    
    console.log(`\n🎯 Found ${testTypes.length} test type(s) to remove:`);
    testTypes.forEach((type, index) => {
      console.log(`${index + 1}. "${type.name}" (ID: ${type._id})`);
    });
    
    // Remove all test types
    const deleteResult = await expense_types.deleteMany({
      name: { $regex: /test/i }
    });
    
    console.log(`\n🗑️  Removed ${deleteResult.deletedCount} test type(s) from database`);
    
    // Show remaining expense types
    console.log('\n📋 Remaining expense types:');
    const remainingTypes = await expense_types.find({}).toArray();
    if (remainingTypes.length === 0) {
      console.log('   (No expense types remaining)');
    } else {
      remainingTypes.forEach((type, index) => {
        console.log(`${index + 1}. ${type.name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

removeTestType();