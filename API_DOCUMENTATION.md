# API Documentation Access

## 🌐 View Documentation

### Option 1: Built-in HTML Documentation (Instant)

Visit: **http://localhost:8000/docs**

This provides instant access to API documentation without any setup!

### Option 2: Generate Detailed ApiDoc Documentation

```bash
# Generate detailed documentation
npm run docs

# Open in browser
# Windows
start docs/index.html

# Or manually open
# docs/index.html
```

This generates comprehensive API documentation with examples and detailed descriptions.

---

## 📖 Documentation Endpoints

### Main Documentation
- **http://localhost:8000/docs** - HTML documentation (instant)
- **http://localhost:8000/api/docs** - JSON documentation info

### API Info
- **http://localhost:8000/** - API information and endpoints list
- **http://localhost:8000/health** - Health check

---

## 🚀 Quick Examples

### View Documentation
```bash
# Start the server
npm run dev

# Open in browser
http://localhost:8000/docs
```

### Test an Endpoint
```bash
# Register a user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "role": "farmer"
  }'

# Get store products (no auth needed)
curl http://localhost:8000/api/store_products
```

---

## 📚 Documentation Features

### Built-in HTML Documentation
- ✅ Instant access (no generation needed)
- ✅ All endpoints listed
- ✅ Request/response examples
- ✅ Authentication info
- ✅ Color-coded HTTP methods
- ✅ Mobile-friendly design

### Generated ApiDoc Documentation
- ✅ Detailed descriptions
- ✅ Parameter documentation
- ✅ Response schemas
- ✅ Error codes
- ✅ Interactive examples
- ✅ Search functionality

---

## 🎯 Accessing Documentation

### During Development

```bash
# Start server
npm run dev

# Visit documentation
http://localhost:8000/docs
```

### In Production (Vercel)

```bash
# After deployment
https://your-api.vercel.app/docs
```

---

## 📝 Documentation Structure

### Endpoint Categories

1. **Authentication** - User registration and login
2. **Farms** - Farm management (CRUD)
3. **Products** - Product management (CRUD)
4. **Store** - E-commerce store products
5. **Cart** - Shopping cart operations
6. **Orders** - Order management
7. **Management** - Batches, expenses, investments, sales
8. **Statistics** - Farm statistics and dashboard

---

## 💡 Tips

### Quick Access
Bookmark: `http://localhost:8000/docs`

### Testing Endpoints
Use the examples in the documentation to test endpoints with curl or Postman.

### Authentication
Most endpoints require a JWT token. Get one by:
1. Register: `POST /api/auth/register`
2. Login: `POST /api/auth/login`
3. Use the returned token in Authorization header

---

## 🔧 Troubleshooting

### Documentation Not Loading

**Issue**: http://localhost:8000/docs shows error

**Solution**:
1. Ensure server is running: `npm run dev`
2. Check port 8000 is not in use
3. Try: `http://localhost:8000/api-docs/docs.html`

### Want More Details

**Solution**: Generate full ApiDoc documentation
```bash
npm run docs
# Open docs/index.html
```

---

## ✅ Summary

- **Instant Docs**: http://localhost:8000/docs
- **Detailed Docs**: `npm run docs` → open docs/index.html
- **API Info**: http://localhost:8000/
- **Health Check**: http://localhost:8000/health

**Start here**: http://localhost:8000/docs
