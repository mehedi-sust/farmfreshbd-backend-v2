require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
// Robust CORS configuration to support localhost, Vercel domains, and credentials
const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://farmfreshbd-frontend.vercel.app',
  'https://farmfreshbd-backend-v2.vercel.app',
];

const envOriginsRaw = (process.env.CORS_ALLOW_ORIGINS || '').trim();
const allowAllOrigins = envOriginsRaw === '*';
const envOrigins = (allowAllOrigins ? '' : envOriginsRaw)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const originWhitelist = new Set([...defaultOrigins, ...envOrigins]);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // Non-browser or same-origin requests
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    if (originWhitelist.has(origin)) return true;
    // Allow any Vercel or Cloudflare Tunnel subdomain
    if (hostname.endsWith('.vercel.app')) return true;
    if (hostname.endsWith('.trycloudflare.com')) return true;
    return false;
  } catch (_) {
    // Fallback to direct string match if URL parsing fails
    return originWhitelist.has(origin);
  }
};

const corsOptions = {
  origin: (origin, callback) => {
    if (allowAllOrigins) {
      // Reflect request origin to support credentials with allow-all semantics
      return callback(null, true);
    }
    const allowed = isAllowedOrigin(origin);
    callback(null, allowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));
// Handle CORS preflight for all routes
app.options('*', cors(corsOptions));
app.use(express.json());

// Request/Response Logger (like FastAPI)
const { requestLogger, errorLogger } = require('./middleware/logger');
app.use(requestLogger);

// Swagger API Documentation
const { swaggerUi, specs } = require('./config/swagger');
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'FarmFresh BD API Documentation'
}));

// Serve static documentation files
app.use('/api-docs', express.static(path.join(__dirname, '../public')));

// Import API routes (local Express routers)
const coreRouter = require('./routes/core');
// Finance/management router (investments, expenses, expense types)
const managementRouter = require('./routes/management');
const commerceRouter = require('./routes/commerce');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const statsRouter = require('./routes/stats');
const farmsRouter = require('./routes/farms');
const productsRouter = require('./routes/products');
const storeProductsRouter = require('./routes/store_products');
const productCategoriesRouter = require('./routes/product_categories');
const reviewsRouter = require('./routes/reviews');
const reportsRouter = require('./routes/reports');

// Mount routes
// app.use('/', indexRouter); // Commented out - this is a serverless function, not an Express router

// Mount routes WITH /api prefix (new style)
// Prioritize specific modern routers before legacy core to prevent field mismatches
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/stats', statsRouter);
app.use('/api/farms', farmsRouter);
app.use('/api/products', productsRouter);
app.use('/api/store_products', storeProductsRouter);
app.use('/api/product_categories', productCategoriesRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/reports', reportsRouter);
// Mount management routes to expose finance endpoints (expenses, expense_types, investments)
app.use('/api', managementRouter);
// Mount consolidated commerce router to enable cart, orders, sales under /api
app.use('/api', commerceRouter);
// Mount legacy core router last so it cannot override specific modern routes
app.use('/api', coreRouter);

// Mount routes WITHOUT /api prefix for frontend compatibility
// Ensure modern store_products routes take precedence over legacy core
app.use('/auth', authRouter);
// app.use('/admin', adminRouter);
app.use('/users', authRouter); // For frontend compatibility (/users/login, /users/register)
app.use('/farms', farmsRouter); // For frontend compatibility
app.use('/stats', statsRouter); // For frontend compatibility (e.g., /stats/farm/:farmId/profit_over_time)
app.use('/store_products', storeProductsRouter); // For frontend compatibility
app.use('/product_categories', productCategoriesRouter);
app.use('/reports', reportsRouter);
// Mount consolidated commerce router for frontend compatibility without /api prefix
app.use('/', commerceRouter);
// Mount management routes without /api prefix for legacy frontend compatibility
app.use('/', managementRouter);
// Mount legacy core compatibility last to avoid overriding
app.use('/', coreRouter);

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
  const { testConnection, ensureBaseSchema, ensureSchemaUpgrades } = require('./config/database');
  const DatabaseService = require('./services/database.service');
  // const { initializeAdmin } = require('./scripts/init-admin');
  
  // Test database connection before starting server
  testConnection()
    .then(async (connected) => {
      if (!connected) {
        console.error('❌ Failed to connect to database. Please check your DATABASE_URL in .env file');
        console.error('💡 Tip: Make sure PostgreSQL is running or your connection string is correct');
        process.exit(1);
      }
      
      // Initialize admin account after database connection is confirmed
      // Temporarily commented out until admin migration is complete
      // try {
      //   await initializeAdmin();
      // } catch (error) {
      //   console.error('⚠️  Admin initialization failed, but server will continue:', error.message);
      // }
      
      // Ensure base schema exists for fresh databases
      try {
        await ensureBaseSchema();
      } catch (e) {
        console.warn('⚠️ Base schema initialization skipped:', e.message);
      }

      // Apply schema upgrades safely after base schema is verified
      try {
        await ensureSchemaUpgrades();
      } catch (e) {
        console.warn('⚠️ Schema upgrade skipped:', e.message);
      }

      // Ensure default expense types exist for finance page compatibility
      try {
        const inserted = await DatabaseService.ensureDefaultExpenseTypes();
        if (inserted) {
          console.log('✅ Default expense types seeded (Feed, Medicine, Vaccine, Other)');
        } else {
          console.log('ℹ️ Default expense types already present');
        }
      } catch (seedErr) {
        console.warn('⚠️ Failed to ensure default expense types:', seedErr?.message || seedErr);
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
        console.log(`🗄️  Database: PostgreSQL Connected ✅`);
        console.log(`👤 Admin: Migration in progress...`);
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
