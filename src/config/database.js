const { MongoClient, ServerApiVersion } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

/**
 * Connect to MongoDB with connection pooling for serverless
 * Supports both MongoDB Atlas and local MongoDB
 */
async function connectToDatabase() {
  // Return cached connection if available
  if (cachedClient && cachedDb) {
    try {
      // Verify connection is still alive
      await cachedClient.db('admin').command({ ping: 1 });
      return { client: cachedClient, db: cachedDb };
    } catch (error) {
      console.log('Cached connection lost, reconnecting...');
      cachedClient = null;
      cachedDb = null;
    }
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/farmfreshbd';
  
  // Determine if using MongoDB Atlas or local
  const isAtlas = uri.includes('mongodb+srv://') || uri.includes('mongodb.net');
  
  // Configure client options
  const clientOptions = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4, // Use IPv4, skip trying IPv6
  };

  // Add Atlas-specific options
  if (isAtlas) {
    clientOptions.serverApi = {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    };
    clientOptions.retryWrites = true;
    clientOptions.w = 'majority';
  }

  console.log('🔌 Connecting to MongoDB...');
  console.log(`📍 Type: ${isAtlas ? 'MongoDB Atlas' : 'Local MongoDB'}`);
  
  const client = new MongoClient(uri, clientOptions);

  try {
    // Connect to MongoDB
    await client.connect();
    
    // Verify connection
    await client.db('admin').command({ ping: 1 });
    console.log('✅ Successfully connected to MongoDB!');
    
    // Get database name from URI or use default
    let dbName = 'farmfreshbd';
    if (isAtlas) {
      // Extract database name from Atlas URI if specified
      const match = uri.match(/mongodb\.net\/([^?]+)/);
      if (match && match[1] && match[1] !== '') {
        dbName = match[1];
      }
    }
    
    const db = client.db(dbName);
    console.log(`📦 Using database: ${dbName}`);

    // Cache the connection
    cachedClient = client;
    cachedDb = db;

    return { client, db };
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw new Error(`Failed to connect to MongoDB: ${error.message}`);
  }
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const { client } = await connectToDatabase();
    await client.db('admin').command({ ping: 1 });
    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
}

/**
 * Get database collections
 * Uses cached database connection for serverless functions
 */
async function getCollections(db = null) {
  // If no db provided, use cached connection
  if (!db) {
    if (!cachedDb) {
      await connectToDatabase();
    }
    db = cachedDb;
  }
  
  return {
    users: db.collection('users'),
    farms: db.collection('farms'),
    products: db.collection('products'),
    product_batches: db.collection('product_batches'),
    expenses: db.collection('expenses'),
    expense_types: db.collection('expense_types'),
    investments: db.collection('investments'),
    sales: db.collection('sales'),
    store_products: db.collection('store_products'),
    cart_items: db.collection('cart_items'),
    orders: db.collection('orders'),
    services: db.collection('services'),
    reviews: db.collection('reviews'),
  };
}

module.exports = { connectToDatabase, getCollections, testConnection };
