/**
 * Database Reset Script
 * 
 * This script completely resets the database by dropping all collections.
 * Use with caution as this will delete ALL data in the database.
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

// Get MongoDB connection string from environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/farmfreshbd';

async function resetDatabase() {
  console.log('🔄 Starting database reset process...');
  console.log('⚠️ WARNING: This will delete ALL data in the database!');
  console.log('⏳ Connecting to MongoDB...');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB successfully');
    
    const db = client.db();
    
    // Get all collections in the database
    const collections = await db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log('ℹ️ No collections found in the database');
    } else {
      console.log(`🗑️ Found ${collections.length} collections to drop`);
      
      // Drop each collection
      for (const collection of collections) {
        console.log(`🗑️ Dropping collection: ${collection.name}`);
        await db.collection(collection.name).drop();
      }
      
      console.log('✅ All collections have been dropped successfully');
    }
    
    console.log('🎉 Database reset complete! You can now start fresh with a new signup.');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the reset function
resetDatabase();