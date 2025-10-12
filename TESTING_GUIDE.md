# Testing Guide - FarmFresh BD API

Complete guide for testing the Express.js API.

## 🎯 Overview

The API uses **Jest** as the testing framework with **Supertest** for HTTP testing and **MongoDB Memory Server** for isolated database testing.

## 🚀 Quick Start

```bash
# Run all tests
npm test

# Run with coverage report
npm test -- --coverage

# Run in watch mode (for development)
npm run test:watch

# Run specific test file
npm test tests/auth.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should register"
```

## 📁 Test Structure

```
tests/
├── setup.js          # Test configuration & MongoDB setup
├── auth.test.js      # Authentication endpoint tests
├── farms.test.js     # Farms API tests
├── store.test.js     # Store products tests
└── [feature].test.js # Additional feature tests
```

## 🔧 Test Configuration

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  testTimeout: 30000,
  verbose: true
};
```

### Test Setup (`tests/setup.js`)

- Creates in-memory MongoDB instance
- Runs before all tests
- Cleans database between tests
- Closes connections after tests

## ✍️ Writing Tests

### Basic Test Structure

```javascript
const request = require('supertest');
const app = require('../src/index');

require('./setup'); // Import test setup

describe('Feature Name', () => {
  let token;
  let resourceId;

  // Setup before each test
  beforeEach(async () => {
    // Create test data
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'pass', role: 'farmer' });
    token = res.body.token;
  });

  describe('POST /api/endpoint', () => {
    it('should do something', async () => {
      const res = await request(app)
        .post('/api/endpoint')
        .set('Authorization', `Bearer ${token}`)
        .send({ data: 'value' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });
  });
});
```

### Testing Authenticated Endpoints

```javascript
describe('Protected Endpoint', () => {
  let token;

  beforeEach(async () => {
    // Register and get token
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user@example.com',
        password: 'password123',
        role: 'farm_manager'
      });
    token = res.body.token;
  });

  it('should access protected route', async () => {
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should reject without token', async () => {
    const res = await request(app)
      .get('/api/protected');

    expect(res.status).toBe(401);
  });
});
```

### Testing with Related Resources

```javascript
describe('Complex Workflow', () => {
  let token, farmId, productId;

  beforeEach(async () => {
    // 1. Register user
    const authRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'farmer@example.com', password: 'pass', role: 'farm_manager' });
    token = authRes.body.token;

    // 2. Create farm
    const farmRes = await request(app)
      .post('/api/farms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Farm', type: 'dairy' });
    farmId = farmRes.body._id;

    // 3. Create product
    const productRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Milk',
        type: 'produce',
        quantity: 100,
        total_price: 500,
        farm_id: farmId,
        product_batch: 'batch1'
      });
    productId = productRes.body._id;
  });

  it('should complete full workflow', async () => {
    // Test using created resources
    const res = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Milk');
  });
});
```

## 🧪 Test Categories

### 1. Unit Tests
Test individual functions and utilities:

```javascript
const { isValidObjectId, toObjectId } = require('../src/utils/helpers');

describe('Helpers', () => {
  describe('isValidObjectId', () => {
    it('should validate correct ObjectId', () => {
      expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
    });

    it('should reject invalid ObjectId', () => {
      expect(isValidObjectId('invalid')).toBe(false);
    });
  });
});
```

### 2. Integration Tests
Test API endpoints with database:

```javascript
describe('Store Products Integration', () => {
  it('should create and retrieve store product', async () => {
    // Create
    const createRes = await request(app)
      .post('/api/store_products')
      .set('Authorization', `Bearer ${token}`)
      .send(productData);

    const productId = createRes.body._id;

    // Retrieve
    const getRes = await request(app)
      .get(`/api/store_products/${productId}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body._id).toBe(productId);
  });
});
```

### 3. Error Handling Tests

```javascript
describe('Error Handling', () => {
  it('should handle invalid ID format', async () => {
    const res = await request(app)
      .get('/api/products/invalid-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid');
  });

  it('should handle not found', async () => {
    const res = await request(app)
      .get('/api/products/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
```

## 📊 Coverage Reports

### Generate Coverage

```bash
npm test -- --coverage
```

### View Coverage Report

```bash
# Open in browser
open coverage/lcov-report/index.html
```

### Coverage Goals
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## 🔍 Debugging Tests

### Run Single Test

```bash
npm test -- --testNamePattern="should register a new user"
```

### Verbose Output

```bash
npm test -- --verbose
```

### Debug with Node Inspector

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

## 📝 Best Practices

### 1. Test Isolation
- Each test should be independent
- Use `beforeEach` to setup fresh data
- Clean up after tests automatically (handled by setup.js)

### 2. Descriptive Names
```javascript
// Good
it('should reject registration with duplicate email', async () => {});

// Bad
it('test registration', async () => {});
```

### 3. Test Both Success and Failure
```javascript
describe('POST /api/farms', () => {
  it('should create farm with valid data', async () => {});
  it('should reject farm without name', async () => {});
  it('should reject farm with invalid type', async () => {});
  it('should reject farm without authentication', async () => {});
});
```

### 4. Use Meaningful Assertions
```javascript
// Good
expect(res.body.email).toBe('test@example.com');
expect(res.body).toHaveProperty('token');
expect(Array.isArray(res.body)).toBe(true);

// Avoid
expect(res.body).toBeTruthy();
```

### 5. Test Edge Cases
- Empty inputs
- Invalid formats
- Boundary values
- Missing required fields
- Unauthorized access

## 🚨 Common Issues

### Issue: Tests Timeout
```javascript
// Increase timeout for slow tests
jest.setTimeout(30000);
```

### Issue: MongoDB Connection
```javascript
// Ensure setup.js is imported
require('./setup');
```

### Issue: Port Already in Use
```javascript
// Tests use in-memory DB, no port conflicts
// If issue persists, check for running dev server
```

## 📈 Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --coverage
```

## 🎓 Example Test Scenarios

### Complete E-Commerce Flow

```javascript
describe('E-Commerce Flow', () => {
  let customerToken, farmToken;
  let farmId, storeProductId;

  beforeEach(async () => {
    // Setup farm manager
    const farmRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'farm@example.com', password: 'pass', role: 'farm_manager' });
    farmToken = farmRes.body.token;

    // Setup customer
    const custRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'customer@example.com', password: 'pass', role: 'customer' });
    customerToken = custRes.body.token;

    // Create farm and products...
  });

  it('should complete purchase flow', async () => {
    // 1. Customer views products
    const productsRes = await request(app)
      .get('/api/store_products');
    expect(productsRes.status).toBe(200);

    // 2. Add to cart
    const cartRes = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ store_product_id: storeProductId, quantity: 2 });
    expect(cartRes.status).toBe(201);

    // 3. Create order
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ store_product_id: storeProductId, quantity: 2 }],
        farm_id: farmId
      });
    expect(orderRes.status).toBe(201);

    // 4. Farm manager confirms order
    const confirmRes = await request(app)
      .put(`/api/orders/${orderRes.body._id}/status`)
      .set('Authorization', `Bearer ${farmToken}`)
      .send({ status: 'confirmed' });
    expect(confirmRes.status).toBe(200);
  });
});
```

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)

## 🤝 Contributing Tests

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain >80% coverage
4. Document complex test scenarios
5. Update this guide if needed
