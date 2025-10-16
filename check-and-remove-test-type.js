// Load environment variables first
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function removeTestType() {
  console.log('🔗 Using MongoDB URI:', process.env.MONGODB_URI ? 'Found in .env' : 'Not found');
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('farmfreshbd-test');
    const expenseTypes = db.collection('expense_types');
    
    // Find all expense types
    const allTypes = await expenseTypes.find({}).toArray();
    console.log('\n📋 Current expense types:');
    allTypes.forEach((type, index) => {
      console.log(`${index + 1}. "${type.name}" (ID: ${type._id})`);
    });
    
    // Find and remove Test Type entries
    const testTypes = await expenseTypes.find({ 
      name: { $regex: /test/i } 
    }).toArray();
    
    if (testTypes.length > 0) {
      console.log('\n🎯 Found Test Type entries to remove:');
      testTypes.forEach((type, index) => {
        console.log(`${index + 1}. "${type.name}" (ID: ${type._id})`);
      });
      
      const result = await expenseTypes.deleteMany({ 
        name: { $regex: /test/i } 
      });
      
      console.log(`\n✅ Successfully removed ${result.deletedCount} Test Type entries`);
    } else {
      console.log('\n✅ No Test Type entries found to remove');
    }
    
    // Show final count
    const finalTypes = await expenseTypes.find({}).toArray();
    console.log('\n📊 Final expense types:');
    finalTypes.forEach((type, index) => {
      console.log(`${index + 1}. "${type.name}"`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

removeTestType();