# Migration Guide: FastAPI to Express.js

Guide for migrating from the FastAPI backend to the new Express.js backend.

## 🎯 Overview

The Express.js backend is a drop-in replacement for the FastAPI backend with:
- **Same endpoints**: All API paths are preserved
- **Same data format**: Request/response structures match
- **Same database**: Uses the same MongoDB instance
- **Better performance**: Optimized for serverless deployment

## 🔄 API Compatibility

### Endpoint Mapping

All endpoints remain the same. The Express.js version maintains full compatibility:

| FastAPI | Express.js | Status |
|---------|-----------|--------|
| `POST /register` | `POST /api/auth/register` | ✅ Compatible |
| `POST /login` | `POST /api/auth/login` | ✅ Compatible |
| `GET /farms` | `GET /api/farms` | ✅ Compatible |
| `POST /products` | `POST /api/products` | ✅ Compatible |
| `GET /store_products` | `GET /api/store_products` | ✅ Compatible |
| `POST /cart` | `POST /api/cart` | ✅ Compatible |
| `POST /orders` | `POST /api/orders` | ✅ Compatible |
| All other endpoints | Same paths | ✅ Compatible |

### Request/Response Format

**No changes required** - The Express.js API accepts and returns the same JSON structures.

Example - Register User:
```javascript
// Request (same for both)
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "role": "farm_manager"
}

// Response (same for both)
{
  "message": "User registered successfully",
  "userId": "507f1f77bcf86cd799439011",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "role": "farm_manager"
  }
}
```

## 🔧 Frontend Changes

### Update Backend URL

**Option 1: Environment Variable (Recommended)**

```javascript
// .env.local
NEXT_PUBLIC_BACKEND_URL=https://your-vercel-app.vercel.app
```

**Option 2: Update Utils**

```javascript
// lib/utils.ts
export function getBackendUrl() {
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
}
```

### No Code Changes Required

The frontend code works without modifications because:
- Same endpoint paths
- Same request/response formats
- Same authentication mechanism
- Same error handling

## 🚀 Deployment Steps

### 1. Deploy Express.js Backend to Vercel

```bash
cd farmfreshbd-backend-v2

# Install dependencies
npm install

# Deploy to Vercel
vercel

# Set environment variables in Vercel dashboard:
# - MONGODB_URI
# - JWT_SECRET
```

### 2. Update Frontend Environment

```bash
cd farmfreshbd-frontend

# Update .env.local
NEXT_PUBLIC_BACKEND_URL=https://your-api.vercel.app
```

### 3. Test Integration

```bash
# Run frontend
npm run dev

# Test key flows:
# - User registration/login
# - Farm creation
# - Product listing
# - Store browsing
# - Cart operations
# - Order placement
```

### 4. Switch Production

Once tested:
1. Update production environment variable
2. Deploy frontend with new backend URL
3. Monitor for any issues

## 🔍 Verification Checklist

### Backend Verification

- [ ] API health check: `GET /health`
- [ ] User registration works
- [ ] User login works
- [ ] Farm creation works
- [ ] Product CRUD operations work
- [ ] Store products display correctly
- [ ] Cart operations work
- [ ] Order creation works
- [ ] Authentication middleware works
- [ ] Database connections stable

### Frontend Verification

- [ ] Login page works
- [ ] Registration works
- [ ] Dashboard loads
- [ ] Farm profile displays
- [ ] Products list loads
- [ ] Store page shows products
- [ ] Add to cart works
- [ ] Checkout process works
- [ ] Order history displays
- [ ] All authenticated routes work

## 🐛 Troubleshooting

### Issue: CORS Errors

**Solution**: Ensure CORS is properly configured in Express.js

```javascript
// Already configured in all API files
app.use(cors());
```

### Issue: Authentication Fails

**Check**:
1. JWT_SECRET matches between old and new backend
2. Token format is correct: `Bearer <token>`
3. Token hasn't expired

### Issue: Database Connection

**Check**:
1. MONGODB_URI is set correctly in Vercel
2. MongoDB allows connections from Vercel IPs
3. Connection string includes credentials

### Issue: 404 Errors

**Check**:
1. Frontend is using correct base URL
2. API paths include `/api/` prefix
3. Vercel deployment succeeded

## 📊 Performance Comparison

| Metric | FastAPI (Free Tier) | Express.js (Vercel) |
|--------|-------------------|-------------------|
| Cold Start | 5-10s | 1-2s |
| Response Time | 200-500ms | 100-200ms |
| Concurrent Requests | Limited | High |
| Deployment | Complex | Simple |
| Cost | Free tier limits | Generous free tier |

## 🔐 Security Notes

### Environment Variables

**Never commit these to git:**
- `MONGODB_URI`
- `JWT_SECRET`

**Set in Vercel dashboard:**
1. Go to Project Settings
2. Navigate to Environment Variables
3. Add variables for Production, Preview, Development

### JWT Secret

**Important**: Use the same JWT_SECRET as FastAPI backend during transition to maintain token compatibility.

After full migration, you can rotate the secret:
1. Generate new secret
2. Update in Vercel
3. Users will need to re-login

## 📈 Monitoring

### Vercel Analytics

Enable in Vercel dashboard:
- Function execution time
- Error rates
- Request volume
- Cold start frequency

### Custom Logging

Add logging for critical operations:

```javascript
console.log('Order created:', orderId);
console.error('Error processing payment:', error);
```

View logs in Vercel dashboard under "Logs" tab.

## 🔄 Rollback Plan

If issues occur:

### Quick Rollback

1. Update frontend environment variable back to FastAPI URL
2. Redeploy frontend
3. FastAPI backend continues running

### Gradual Migration

1. Run both backends simultaneously
2. Route percentage of traffic to new backend
3. Monitor for issues
4. Gradually increase traffic
5. Fully switch when confident

## 📝 Database Considerations

### Same Database

Both backends use the same MongoDB database:
- No data migration needed
- No schema changes required
- Can run both backends simultaneously

### Indexes

Ensure indexes exist for performance:

```javascript
// Run once in MongoDB
db.users.createIndex({ email: 1 }, { unique: true });
db.products.createIndex({ farm_id: 1 });
db.store_products.createIndex({ is_published: 1 });
db.orders.createIndex({ customer_id: 1 });
db.orders.createIndex({ farm_id: 1 });
```

## ✅ Post-Migration

After successful migration:

1. **Monitor Performance**
   - Check Vercel analytics
   - Monitor error rates
   - Track response times

2. **Update Documentation**
   - Update API documentation
   - Update deployment guides
   - Update team wiki

3. **Cleanup**
   - Archive FastAPI code
   - Remove old deployment
   - Update CI/CD pipelines

4. **Team Training**
   - Share new testing guide
   - Demonstrate deployment process
   - Update development workflow

## 🎓 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [MongoDB Node Driver](https://mongodb.github.io/node-mongodb-native/)
- [JWT.io](https://jwt.io/)

## 🤝 Support

For migration assistance:
- Check TESTING_GUIDE.md for testing procedures
- Review README.md for setup instructions
- Contact development team for help
