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

// Import API routes
const indexRouter = require('../api/index');
const authRouter = require('../api/auth');
const farmsRouter = require('../api/farms');
const productsRouter = require('../api/products');
const storeRouter = require('../api/store');
const cartRouter = require('../api/cart');
const ordersRouter = require('../api/orders');
const managementRouter = require('../api/management');
const productBatchesRouter = require('../api/product-batches');
const expensesRouter = require('../api/expenses');
const expenseTypesRouter = require('../api/expense-types');
const investmentsRouter = require('../api/investments');
const salesRouter = require('../api/sales');
const statsRouter = require('../api/stats');
const reviewsRouter = require('../api/reviews');
const databaseRouter = require('../api/database');
const reportsRouter = require('../api/reports-new');
const adminRouter = require('../api/admin');

// Mount routes
app.use('/', indexRouter);

// Mount routes WITH /api prefix (new style)
app.use('/api/auth', authRouter);
app.use('/api/farms', farmsRouter);
app.use('/api/products', productsRouter);
app.use('/api/store_products', storeRouter);
app.use('/api/cart', cartRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/management', managementRouter);
app.use('/api/stats', statsRouter);
app.use('/api/database', databaseRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);

// Mount routes WITHOUT /api prefix (FastAPI compatibility)
app.use('/register', authRouter);
app.use('/login', authRouter);
app.use('/users', authRouter); // FastAPI used /users/login and /users/register
app.use('/farms', farmsRouter);
app.use('/products', productsRouter);
app.use('/store_products', storeRouter);
app.use('/cart', cartRouter);
app.use('/orders', ordersRouter);
app.use('/product_batches', productBatchesRouter);
app.use('/expenses', expensesRouter);
app.use('/expense_types', expenseTypesRouter);
app.use('/investments', investmentsRouter);
app.use('/sales', salesRouter);
app.use('/stats', statsRouter);
app.use('/reviews', reviewsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/database', databaseRouter);
app.use('/reports', reportsRouter);

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
  res.status(404).json({ error: 'Endpoint not found' });
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
