const request = require('supertest');
const app = require('../src/index');

require('./setup');

describe('Farms API', () => {
  let token;
  let userId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'farmer@example.com',
        password: 'password123',
        role: 'farm_manager'
      });
    token = res.body.token;
    userId = res.body.userId;
  });

  describe('POST /api/farms', () => {
    it('should create a new farm', async () => {
      const res = await request(app)
        .post('/api/farms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Green Valley Farm',
          type: 'dairy',
          location: 'Dhaka',
          phone: '01712345678'
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Green Valley Farm');
      expect(res.body.type).toBe('dairy');
    });

    it('should reject farm creation without auth', async () => {
      const res = await request(app)
        .post('/api/farms')
        .send({
          name: 'Test Farm',
          type: 'dairy'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/farms', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/farms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Public Farm',
          type: 'vegetable',
          location: 'Chittagong'
        });
    });

    it('should get all public farms', async () => {
      const res = await request(app)
        .get('/api/farms');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/farms/:farmId', () => {
    let farmId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/farms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Farm',
          type: 'dairy'
        });
      farmId = res.body._id;
    });

    it('should get farm by ID', async () => {
      const res = await request(app)
        .get(`/api/farms/${farmId}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(farmId);
      expect(res.body.name).toBe('Test Farm');
    });
  });

  describe('PUT /api/farms/:farmId', () => {
    let farmId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/farms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Original Farm',
          type: 'dairy'
        });
      farmId = res.body._id;
    });

    it('should update farm', async () => {
      const res = await request(app)
        .put(`/api/farms/${farmId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Farm',
          bio: 'New bio'
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Farm');
      expect(res.body.bio).toBe('New bio');
    });
  });
});
