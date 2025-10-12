const request = require('supertest');
const app = require('../src/index');

require('./setup');

describe('Store API', () => {
  let token;
  let farmId;
  let productId;
  let storeProductId;

  beforeEach(async () => {
    // Register and create farm
    const authRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'farmer@example.com',
        password: 'password123',
        role: 'farm_manager'
      });
    token = authRes.body.token;

    const farmRes = await request(app)
      .post('/api/farms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Farm',
        type: 'vegetable'
      });
    farmId = farmRes.body._id;

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
    productId = productRes.body._id;
  });

  describe('POST /api/store_products', () => {
    it('should create store product', async () => {
      const res = await request(app)
        .post('/api/store_products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_id: productId,
          farm_id: farmId,
          name: 'Fresh Tomatoes',
          description: 'Organic tomatoes',
          selling_price: 10,
          available_stock: 50,
          category: 'vegetables',
          unit: 'kg'
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Fresh Tomatoes');
      expect(res.body.selling_price).toBe(10);
    });
  });

  describe('GET /api/store_products', () => {
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/store_products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          product_id: productId,
          farm_id: farmId,
          name: 'Fresh Tomatoes',
          description: 'Organic tomatoes',
          selling_price: 10,
          available_stock: 50,
          category: 'vegetables'
        });
      storeProductId = res.body._id;
    });

    it('should get all store products', async () => {
      const res = await request(app)
        .get('/api/store_products');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('product_name');
      expect(res.body[0]).toHaveProperty('farm_name');
    });

    it('should get store product by ID', async () => {
      const res = await request(app)
        .get(`/api/store_products/${storeProductId}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(storeProductId);
      expect(res.body.product_name).toBe('Fresh Tomatoes');
    });
  });
});
