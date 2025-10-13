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
const coreRouter = require('../api/core');
const managementRouter = require('../api/management');
const commerceRouter = require('../api/commerce');
const authRouter = require('../api/auth');

// Mount routes
// app.use('/', indexRouter); // Commented out - this is a serverless function, not an Express router

// Mount routes WITH /api prefix (new style)
app.use('/api', coreRouter);
app.use('/api', managementRouter);
app.use('/api', commerceRouter);
app.use('/api/auth', authRouter);

// Mount routes WITHOUT /api prefix for frontend compatibility
app.use('/', coreRouter);
app.use('/', managementRouter);
app.use('/', commerceRouter);
app.use('/auth', authRouter);
app.use('/users', authRouter); // For frontend compatibility (/users/login, /users/register)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: 'connected'
  });
});

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
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    message: 'Please use specific API endpoints like /api/store_products, /api/sales, etc.'
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
