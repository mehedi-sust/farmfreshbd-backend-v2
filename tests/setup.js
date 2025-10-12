const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');

let mongoServer;
let connection;
let db;

// Setup before all tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'test-secret-key';
  
  connection = await MongoClient.connect(uri);
  db = connection.db();
});

// Cleanup after all tests
afterAll(async () => {
  if (connection) {
    await connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Clear database between tests
afterEach(async () => {
  if (db) {
    const collections = await db.collections();
    for (let collection of collections) {
      await collection.deleteMany({});
    }
  }
});

module.exports = { getDb: () => db };
