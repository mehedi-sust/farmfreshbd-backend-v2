# Vercel Deployment Guide

## 🚀 FarmFreshBD Backend - Serverless Deployment

This guide will help you deploy the FarmFreshBD backend to Vercel as serverless functions.

## ✅ Pre-deployment Checklist

All the following items have been completed and validated:

- [x] **Serverless Functions Created**: All API endpoints converted to Vercel-compatible serverless functions
- [x] **Database Configuration**: Optimized for serverless environment with connection pooling
- [x] **Package.json Updated**: Configured for Vercel deployment
- [x] **Vercel.json Configured**: Proper routing and function configuration
- [x] **Middleware Updated**: Authentication and logging middleware compatible with serverless
- [x] **Validation Passed**: All functions import successfully and configuration is valid

## 📁 Project Structure

```
farmfreshbd-backend-v2/
├── api/                          # Serverless functions
│   ├── index.js                  # Main API handler & health check
│   ├── auth.js                   # Authentication endpoints
│   ├── products.js               # Product CRUD operations
│   ├── store_products.js         # Store product operations
│   ├── farms.js                  # Farm management
│   ├── stats.js                  # Statistics and analytics
│   └── admin.js                  # Admin operations
├── src/                          # Shared utilities and config
│   ├── config/
│   │   ├── database.js           # Database connection (serverless optimized)
│   │   └── auth.js               # JWT and authentication utilities
│   ├── middleware/
│   │   └── logger.js             # Request/response logging
│   └── utils/
│       └── helpers.js            # Utility functions
├── vercel.json                   # Vercel configuration
├── package.json                  # Dependencies and scripts
└── validate-serverless.js        # Validation script
```

## 🔧 Environment Variables

Before deploying, set up these environment variables in your Vercel dashboard:

### Required Variables:
```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/farmfreshbd
MONGODB_DB_NAME=farmfreshbd

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Environment
NODE_ENV=production
```

### Optional Variables:
```bash
# For local development
MONGODB_LOCAL_URI=mongodb://localhost:27017/farmfreshbd
```

## 🚀 Deployment Steps

### 1. Install Vercel CLI (if not already installed)
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy to Vercel
```bash
# For production deployment
vercel --prod

# For preview deployment
vercel
```

### 4. Set Environment Variables
After deployment, go to your Vercel dashboard:
1. Navigate to your project
2. Go to Settings → Environment Variables
3. Add all required environment variables listed above

### 5. Redeploy with Environment Variables
```bash
vercel --prod
```

## 📋 API Endpoints

After deployment, your API will be available at `https://your-project.vercel.app/api/`

### Available Endpoints:

#### Main API
- `GET /api/` - API documentation and health check
- `GET /api/health` - Health check endpoint

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

#### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create product
- `GET /api/products/:id` - Get product by ID
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

#### Store Products
- `GET /api/store_products` - Get store products with filtering
- `POST /api/store_products` - Create store product
- `GET /api/store_products/:id` - Get store product by ID
- `PUT /api/store_products/:id` - Update store product
- `DELETE /api/store_products/:id` - Delete store product

#### Farms
- `GET /api/farms` - Get all farms
- `POST /api/farms` - Create farm
- `GET /api/farms/:id` - Get farm by ID
- `PUT /api/farms/:id` - Update farm
- `DELETE /api/farms/:id` - Delete farm

#### Statistics
- `GET /api/stats/overall` - Overall statistics
- `GET /api/stats/dashboard` - Dashboard statistics
- `GET /api/stats/users` - User statistics
- `GET /api/stats/farms` - Farm statistics
- `GET /api/stats/products` - Product statistics
- `GET /api/stats/orders` - Order statistics

#### Admin (Requires admin authentication)
- `GET /api/admin/users` - Manage users
- `GET /api/admin/farms` - Manage farms
- `GET /api/admin/products` - Manage products
- `GET /api/admin/dashboard` - Admin dashboard stats

## 🔍 Testing Deployment

### 1. Run Local Validation
```bash
node validate-serverless.js
```

### 2. Test API Endpoints
After deployment, test your endpoints:

```bash
# Health check
curl https://your-project.vercel.app/api/health

# API documentation
curl https://your-project.vercel.app/api/

# Test authentication
curl -X POST https://your-project.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","role":"farmer"}'
```

## 🐛 Troubleshooting

### Common Issues:

1. **"The `functions` property cannot be used in conjunction with the `builds` property" Error**
   - ✅ **FIXED**: Removed conflicting `builds` property from vercel.json
   - Modern Vercel automatically detects Node.js functions in `api/` directory

2. **Database Connection Errors**
   - Ensure `MONGODB_URI` is correctly set in Vercel environment variables
   - Check that your MongoDB cluster allows connections from all IPs (0.0.0.0/0)

2. **Function Timeout**
   - Vercel has a 10-second timeout for Hobby plans, 60 seconds for Pro
   - Database operations are optimized for serverless with connection pooling

3. **CORS Issues**
   - All functions include proper CORS headers
   - Preflight requests (OPTIONS) are handled automatically

4. **Authentication Issues**
   - Ensure `JWT_SECRET` is set in environment variables
   - Check that the secret is the same across all function instances

### Debugging:
- Check Vercel function logs in the dashboard
- Use the validation script to test locally
- Test individual functions before full deployment

## 📊 Performance Optimization

The serverless functions are optimized for:
- **Cold Start Performance**: Minimal imports and efficient initialization
- **Database Connections**: Connection pooling and reuse
- **Memory Usage**: Efficient data processing and cleanup
- **Response Times**: Optimized queries and caching strategies

## 🔄 Continuous Deployment

To set up automatic deployments:
1. Connect your GitHub repository to Vercel
2. Enable automatic deployments for the main branch
3. Set up preview deployments for pull requests

## 📝 Notes

- All functions are stateless and serverless-compatible
- Database connections are pooled and reused efficiently
- Authentication middleware works across all protected endpoints
- Logging is optimized for serverless environments
- Error handling includes proper HTTP status codes and messages

## 🎉 Success!

If all steps are completed successfully, your FarmFreshBD backend will be running on Vercel with:
- ✅ Serverless functions for all API endpoints
- ✅ Optimized database connections
- ✅ Proper authentication and authorization
- ✅ CORS support for frontend integration
- ✅ Error handling and logging
- ✅ Production-ready configuration

Your API will be accessible at: `https://your-project.vercel.app/api/`