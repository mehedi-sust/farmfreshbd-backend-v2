/**
 * Test MongoDB Connection
 * Run this to verify your database connection before starting the server
 */

require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('❌ MONGODB_URI not found in .env file');
    console.log('💡 Create a .env file with your MongoDB connection string');
    console.log('💡 Example: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/farmfreshbd');
    process.exit(1);
  }

  console.log('');
  console.log('========================================');
  console.log('🧪 Testing MongoDB Connection');
  console.log('========================================');
  console.log('');
  
  const isAtlas = uri.includes('mongodb+srv://') || uri.includes('mongodb.net');
  console.log(`📍 Connection Type: ${isAtlas ? 'MongoDB Atlas' : 'Local MongoDB'}`);
  console.log(`🔗 URI: ${uri.substring(0, 30)}...`);
  console.log('');

  const clientOptions = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };

  if (isAtlas) {
    clientOptions.serverApi = {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    };
  }

  const client = new MongoClient(uri, clientOptions);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');
    console.log('');

    console.log('🏓 Pinging database...');
    await client.db('admin').command({ ping: 1 });
    console.log('✅ Ping successful!');
    console.log('');

    // Get database name
    let dbName = 'farmfreshbd';
    if (isAtlas) {
      const match = uri.match(/mongodb\.net\/([^?]+)/);
      if (match && match[1] && match[1] !== '') {
        dbName = match[1];
      }
    }

    console.log(`📦 Database: ${dbName}`);
    
    // List collections
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    console.log(`📚 Collections found: ${collections.length}`);
    if (collections.length > 0) {
      console.log('   Collections:', collections.map(c => c.name).join(', '));
    }
    console.log('');

    // Test users collection
    const users = db.collection('users');
    const userCount = await users.countDocuments();
    console.log(`👥 Users in database: ${userCount}`);
    console.log('');

    console.log('========================================');
    console.log('✅ Database Connection Test PASSED!');
    console.log('========================================');
    console.log('');
    console.log('💡 You can now start the server with: npm run dev');
    console.log('');

  } catch (error) {
    console.log('');
    console.log('========================================');
    console.log('❌ Database Connection Test FAILED!');
    console.log('========================================');
    console.log('');
    console.error('Error:', error.message);
    console.log('');
    
    if (error.message.includes('authentication failed')) {
      console.log('💡 Troubleshooting:');
      console.log('   1. Check your username and password in MONGODB_URI');
      console.log('   2. Make sure the password is URL-encoded');
      console.log('   3. Verify the user has correct permissions');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
      console.log('💡 Troubleshooting:');
      console.log('   1. Check your internet connection');
      console.log('   2. Verify the cluster URL is correct');
      console.log('   3. Check if your IP is whitelisted in MongoDB Atlas');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Troubleshooting:');
      console.log('   1. Make sure MongoDB is running locally');
      console.log('   2. Check if MongoDB is listening on port 27017');
      console.log('   3. Try: mongod --dbpath /path/to/data');
    }
    console.log('');
    
    process.exit(1);
  } finally {
    await client.close();
  }
}

testConnection();
