require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Request/Response Logger (like FastAPI)
const { requestLogger, errorLogger } = require('./middleware/logger');
app.use(requestLogger);

// Serve static documentation files
app.use('/docs', express.static(path.join(__dirname, '../docs')));
app.use('/api-docs', express.static(path.join(__dirname, '../public')));

// Import API routes (only the ones that exist)
const indexRouter = require('../api/index');
console.log('🔍 Importing auth router...');
const authRouter = require('../api/auth');
console.log('🔍 Auth router imported:', typeof authRouter, authRouter.stack?.length, 'routes');
const farmsRouter = require('../api/farms');
const productsRouter = require('../api/products');
const financeRouter = require('../api/finance');
const storeProductsRouter = require('../api/store_products');
const statsRouter = require('../api/stats');
const adminRouter = require('../api/admin');



const salesRouter = require('../api/sales');
const reportsRouter = require('../api/reports');
const cartRouter = require('../api/cart');
const ordersRouter = require('../api/orders');

// Mount routes
// app.use('/', indexRouter); // Commented out - this is a serverless function, not an Express router

// Mount routes WITH /api prefix (new style)
console.log('🔍 Mounting auth router at /api/auth...');
app.use('/api/auth', authRouter);
console.log('🔍 Auth router mounted successfully');
app.use('/api/farms', farmsRouter);
app.use('/api/products', productsRouter);
app.use('/api/finance', financeRouter);
app.use('/api/store_products', storeProductsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/sales', salesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/cart', cartRouter);
app.use('/api/orders', ordersRouter);

// Mount routes WITHOUT /api prefix (FastAPI compatibility)
app.use('/register', authRouter);
app.use('/login', authRouter);
app.use('/users', authRouter); // FastAPI used /users/login and /users/register
app.use('/farms', farmsRouter);
app.use('/products', productsRouter);
app.use('/finance', financeRouter);
app.use('/store_products', storeProductsRouter);
app.use('/stats', statsRouter);
app.use('/sales', salesRouter);
app.use('/reports', reportsRouter);
app.use('/cart', cartRouter);
app.use('/orders', ordersRouter);

// Error logger
app.use(errorLogger);

// Error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  console.log('🔍 404 Handler - Path:', req.path, 'Method:', req.method);
  console.log('🔍 Available routes on authRouter:', authRouter.stack?.map(layer => layer.route?.path));
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    message: 'Please use specific API endpoints like /api/auth, /api/farms, etc.'
  });
});

// Start server with database connection check
if (require.main === module) {
  const { testConnection } = require('./config/database');
  
  // Test database connection before starting server
  testConnection()
    .then((connected) => {
      if (!connected) {
        console.error('❌ Failed to connect to database. Please check your MONGODB_URI in .env file');
        console.error('💡 Tip: Make sure MongoDB is running or your Atlas connection string is correct');
        process.exit(1);
      }
      
      // Start server only if database is connected
      app.listen(PORT, () => {
        console.log('');
        console.log('========================================');
        console.log('🚀 FarmFresh BD API Server Started!');
        console.log('========================================');
        console.log(`📍 Server: http://localhost:${PORT}`);
        console.log(`📚 API Docs: http://localhost:${PORT}/docs`);
        console.log(`💚 Health: http://localhost:${PORT}/health`);
        console.log(`🗄️  Database: Connected ✅`);
        console.log('========================================');
        console.log('');
      });
    })
    .catch((error) => {
      console.error('❌ Server startup failed:', error.message);
      process.exit(1);
    });
}

module.exports = app;
