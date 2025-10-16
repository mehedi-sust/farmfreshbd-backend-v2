const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FarmFresh BD API',
      version: '2.0.0',
      description: 'API documentation for FarmFresh BD backend services',
      contact: {
        name: 'FarmFresh BD Team',
        email: 'support@farmfreshbd.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:8000',
        description: 'Development server'
      },
      {
        url: 'https://farmfreshbd-backend.onrender.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            role: { type: 'string', enum: ['customer', 'farm_manager', 'admin'] },
            farm_id: { type: 'string' },
            address: { type: 'string' }
          }
        },
        Product: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            product_name: { type: 'string' },
            category: { type: 'string' },
            price_per_unit: { type: 'number' },
            unit: { type: 'string' },
            farm_id: { type: 'string' },
            description: { type: 'string' },
            image_url: { type: 'string' }
          }
        },
        ProductBatch: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            product_id: { type: 'string' },
            batch_number: { type: 'string' },
            quantity: { type: 'number' },
            production_date: { type: 'string', format: 'date' },
            expiry_date: { type: 'string', format: 'date' },
            farm_id: { type: 'string' }
          }
        },
        Expense: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            expense_type_id: { type: 'string' },
            amount: { type: 'number' },
            description: { type: 'string' },
            date: { type: 'string', format: 'date' },
            farm_id: { type: 'string' }
          }
        },
        ExpenseType: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            is_default: { type: 'boolean', description: 'Whether this is a default system expense type' },
            is_global: { type: 'boolean', description: 'Whether this expense type is available to all farms' },
            created_by: { type: 'string', description: 'User ID who created this expense type' },
            updated_by: { type: 'string', description: 'User ID who last updated this expense type' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Sale: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            product_id: { type: 'string' },
            batch_id: { type: 'string' },
            quantity: { type: 'number' },
            price_per_unit: { type: 'number' },
            total_amount: { type: 'number' },
            sale_date: { type: 'string', format: 'date' },
            farm_id: { type: 'string' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            path: { type: 'string' },
            method: { type: 'string' }
          }
        }
      }
    }
  },
  apis: ['./api/*.js', './src/index.js'], // paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs
};