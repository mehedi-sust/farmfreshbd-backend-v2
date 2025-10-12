/**
 * @api {get} / API Health Check
 * @apiName HealthCheck
 * @apiGroup System
 * @apiVersion 1.0.0
 * 
 * @apiSuccess {String} message Welcome message
 * @apiSuccess {String} version API version
 * @apiSuccess {String} status API status
 * 
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "message": "FarmFresh BD API",
 *       "version": "1.0.0",
 *       "status": "healthy"
 *     }
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'FarmFresh BD API',
    version: '1.0.0',
    status: 'healthy',
    documentation: {
      info: '/docs',
      generate: 'Run: npm run docs',
      location: 'docs/index.html'
    },
    endpoints: {
      auth: '/api/auth',
      farms: '/api/farms',
      products: '/api/products',
      store: '/api/store',
      cart: '/api/cart',
      orders: '/api/orders',
      management: '/api/management',
      stats: '/api/stats',
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/docs', (req, res) => {
  // Redirect to the HTML documentation
  res.redirect('/api-docs/docs.html');
});

app.get('/api/docs', (req, res) => {
  res.json({
    message: 'API Documentation',
    info: 'To view the full API documentation:',
    steps: [
      '1. Visit: http://localhost:8000/docs',
      '2. Or generate detailed docs: npm run docs',
      '3. Then open docs/index.html in your browser'
    ],
    endpoints: {
      'Authentication': {
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'Login user',
        'GET /api/auth/me': 'Get current user'
      },
      'Farms': {
        'POST /api/farms': 'Create farm',
        'GET /api/farms': 'List all farms',
        'GET /api/farms/:id': 'Get farm by ID',
        'PUT /api/farms/:id': 'Update farm',
        'DELETE /api/farms/:id': 'Delete farm'
      },
      'Products': {
        'POST /api/products': 'Create product',
        'GET /api/products': 'List products',
        'GET /api/products/:id': 'Get product',
        'PUT /api/products/:id': 'Update product',
        'DELETE /api/products/:id': 'Delete product'
      },
      'Store': {
        'GET /api/store_products': 'List store products',
        'GET /api/store_products/:id': 'Get store product',
        'POST /api/store_products': 'Add to store',
        'PUT /api/store_products/:id': 'Update store product',
        'DELETE /api/store_products/:id': 'Remove from store'
      },
      'Cart': {
        'POST /api/cart': 'Add to cart',
        'GET /api/cart': 'Get cart items',
        'PUT /api/cart/:id': 'Update cart item',
        'DELETE /api/cart/:id': 'Remove cart item',
        'DELETE /api/cart': 'Clear cart'
      },
      'Orders': {
        'POST /api/orders': 'Create order',
        'GET /api/orders': 'List orders',
        'GET /api/orders/:id': 'Get order',
        'PUT /api/orders/:id/status': 'Update order status',
        'POST /api/orders/:id/cancel': 'Cancel order'
      },
      'Management': {
        'POST /api/management/batches': 'Create batch',
        'GET /api/management/batches': 'List batches',
        'POST /api/management/expenses': 'Create expense',
        'GET /api/management/expenses': 'List expenses',
        'POST /api/management/investments': 'Create investment',
        'GET /api/management/investments': 'List investments',
        'POST /api/management/sales': 'Record sale',
        'GET /api/management/sales': 'List sales',
        'GET /api/management/expense-types': 'Get expense types'
      },
      'Statistics': {
        'GET /api/stats': 'Get farm statistics',
        'GET /api/stats/dashboard': 'Get dashboard summary'
      }
    },
    examples: {
      'Register User': {
        method: 'POST',
        url: '/api/auth/register',
        body: {
          email: 'user@example.com',
          password: 'password123',
          role: 'farm_manager'
        }
      },
      'Get Store Products': {
        method: 'GET',
        url: '/api/store_products',
        description: 'No authentication required'
      },
      'Create Farm': {
        method: 'POST',
        url: '/api/farms',
        headers: {
          Authorization: 'Bearer YOUR_TOKEN'
        },
        body: {
          name: 'My Farm',
          type: 'dairy',
          location: 'Dhaka'
        }
      }
    }
  });
});

module.exports = app;
