const request = require('supertest');
const app = require('../src/index');

require('./setup');

// Add cleanup to prevent Jest hanging
afterAll(async () => {
  // Close any remaining database connections
  const { connectToDatabase } = require('../src/config/database');
  try {
    const { client } = await connectToDatabase();
    if (client) {
      await client.close();
    }
  } catch (error) {
    // Ignore errors during cleanup
  }
  
  // Clear any remaining timers
  jest.clearAllTimers();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

describe('Store API', () => {
  describe('POST /api/store_products', () => {
    it('should create store product', async () => {
      // Register and create farm
      const authRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'farmer@example.com',
          password: 'password123',
          role: 'farm_manager'
        });
      const token = authRes.body.token;

      const farmRes = await request(app)
        .post('/api/farms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Farm',
          type: 'vegetable'
        });
      const farmId = farmRes.body._id;

      // Create batch
      const batchRes = await request(app)
        .post('/api/management/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Batch 1',
          farm_id: farmId
        });

      // Create product
      const productRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Fresh Tomatoes',
          type: 'produce',
          quantity: 100,
          total_price: 500,
          farm_id: farmId,
          product_batch: batchRes.body._id
        });
      const productId = productRes.body._id;

      const res = await request(app)
        .post('/api/store_products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_id: productId,
          farm_id: farmId,
          store_price: 10,
          store_stock_quantity: 50,
          is_featured: false,
          discount_percentage: 0
        });

      if (res.status !== 201) {
        console.log('Store product creation failed:', res.status, res.body);
        console.log('Request body was:', {
          product_id: productId,
          farm_id: farmId,
          store_price: 10,
          store_stock_quantity: 50,
          is_featured: false,
          discount_percentage: 0
        });
      }

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Store product created successfully');
      expect(res.body.store_product.store_price).toBe(10);
    });
  });

  describe('GET /api/store_products', () => {
    it('should get all store products', async () => {
      // Register and create farm
      const authRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'farmer@example.com',
          password: 'password123',
          role: 'farm_manager'
        });
      const token = authRes.body.token;

      const farmRes = await request(app)
        .post('/api/farms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Farm',
          type: 'vegetable'
        });
      const farmId = farmRes.body._id;

      // Create batch
      const batchRes = await request(app)
        .post('/api/management/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Batch 1',
          farm_id: farmId
        });

      // Create product
      const productRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Fresh Tomatoes',
          type: 'produce',
          quantity: 100,
          total_price: 500,
          farm_id: farmId,
          product_batch: batchRes.body._id
        });
      const productId = productRes.body._id;

      // Create store product
      const storeRes = await request(app)
        .post('/api/store_products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_id: productId,
          farm_id: farmId,
          store_price: 10,
          store_stock_quantity: 50,
          is_featured: false,
          discount_percentage: 0
        });

      const res = await request(app)
        .get('/api/store_products');

      console.log('GET store products response:', res.status, res.body);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('store_products');
      expect(Array.isArray(res.body.store_products)).toBe(true);
      expect(res.body.store_products.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('pagination');
    });

    it('should get store product by ID', async () => {
      // Register and create farm
      const authRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'farmer@example.com',
          password: 'password123',
          role: 'farm_manager'
        });
      const token = authRes.body.token;

      const farmRes = await request(app)
        .post('/api/farms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Farm',
          type: 'vegetable'
        });
      const farmId = farmRes.body._id;

      // Create batch
      const batchRes = await request(app)
        .post('/api/management/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Batch 1',
          farm_id: farmId
        });

      // Create product
      const productRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Fresh Tomatoes',
          type: 'produce',
          quantity: 100,
          total_price: 500,
          farm_id: farmId,
          product_batch: batchRes.body._id
        });
      const productId = productRes.body._id;

      // Create store product
      const storeRes = await request(app)
        .post('/api/store_products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_id: productId,
          farm_id: farmId,
          store_price: 10,
          store_stock_quantity: 50,
          is_featured: false,
          discount_percentage: 0
        });
      const storeProductId = storeRes.body.storeProductId;

      const res = await request(app)
        .get(`/api/store_products/${storeProductId}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('store_product');
      expect(res.body.store_product._id).toBe(storeProductId);
      expect(res.body.store_product.store_price).toBe(10);
    });
  });
});
