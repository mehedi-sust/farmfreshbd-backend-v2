# FarmFresh BD API - Express.js Backend

Modern, serverless-ready Express.js API for FarmFresh BD platform, optimized for Vercel deployment.

## 🚀 Features

- **Serverless Architecture**: Optimized for Vercel with <10 serverless functions
- **MongoDB Integration**: Same database as FastAPI version
- **JWT Authentication**: Secure token-based auth
- **Comprehensive Testing**: Jest with MongoDB Memory Server
- **API Documentation**: ApiDoc compatible documentation
- **Production Ready**: Error handling, validation, CORS support

## 📋 API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Farms (`/api/farms`)
- `POST /api/farms` - Create farm
- `GET /api/farms` - Get all public farms
- `GET /api/farms/:farmId` - Get farm by ID
- `PUT /api/farms/:farmId` - Update farm
- `DELETE /api/farms/:farmId` - Delete farm

### Products (`/api/products`)
- `POST /api/products` - Create product
- `GET /api/products` - Get products (with filters)
- `GET /api/products/:productId` - Get product by ID
- `PUT /api/products/:productId` - Update product
- `DELETE /api/products/:productId` - Delete product

### Store (`/api/store_products`)
- `GET /api/store_products` - Get all store products (public)
- `GET /api/store_products/:productId` - Get store product details
- `POST /api/store_products` - Add product to store
- `PUT /api/store_products/:productId` - Update store product
- `DELETE /api/store_products/:productId` - Remove from store

### Cart (`/api/cart`)
- `POST /api/cart` - Add item to cart
- `GET /api/cart` - Get cart items
- `PUT /api/cart/:cartItemId` - Update cart item
- `DELETE /api/cart/:cartItemId` - Remove cart item
- `DELETE /api/cart` - Clear cart

### Orders (`/api/orders`)
- `POST /api/orders` - Create order
- `GET /api/orders` - Get orders (customer or farm)
- `GET /api/orders/:orderId` - Get order details
- `PUT /api/orders/:orderId/status` - Update order status
- `POST /api/orders/:orderId/cancel` - Cancel order

### Management (`/api/management`)
- `POST /api/management/batches` - Create product batch
- `GET /api/management/batches` - Get batches
- `POST /api/management/expenses` - Create expense
- `GET /api/management/expenses` - Get expenses
- `POST /api/management/investments` - Create investment
- `GET /api/management/investments` - Get investments
- `POST /api/management/sales` - Record sale
- `GET /api/management/sales` - Get sales
- `GET /api/management/expense-types` - Get expense types

### Statistics (`/api/stats`)
- `GET /api/stats` - Get farm statistics
- `GET /api/stats/dashboard` - Get dashboard summary

## 🛠️ Setup

### Two Ways to Run

You can run the API in **two ways**:

1. **Directly on your machine** (No Docker needed) - Faster, easier debugging
2. **With Docker** (Isolated environment) - Consistent, production-like

Choose what suits you best! Both work perfectly.

---

### Option 1: Direct Local Execution (Recommended for Development)

#### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

#### Quick Start

```bash
cd farmfreshbd-backend-v2

# Install dependencies
npm install

# Setup environment
copy .env.example .env
# Edit .env with your MongoDB URI

# Run development server
npm run dev
```

Or use the batch file:
```bash
run-dev.bat
```

Server runs at: http://localhost:8000

#### Run Tests
```bash
npm test
```

Or:
```bash
run-tests.bat
```

---

### Option 2: Docker Execution

#### Prerequisites
- Docker Desktop

#### Quick Start

```bash
cd farmfreshbd-backend-v2

# Start everything (MongoDB + API)
docker-compose up
```

Or use the batch file:
```bash
docker-dev.bat
```

Server runs at: http://localhost:8000

#### Run Tests in Docker
```bash
docker-test.bat
```

---

### Detailed Instructions

See **[DOCKER_GUIDE.md](DOCKER_GUIDE.md)** for complete setup instructions for both methods.

### Environment Variables

```env
MONGODB_URI=mongodb://localhost:27017/farmfreshbd
JWT_SECRET=your-secret-key-change-this-in-production
PORT=8000
NODE_ENV=development
```

## 🧪 Testing

### Direct Local Testing

```bash
# Run all tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm run test:watch

# Specific test
npm test tests/auth.test.js
```

Or use batch file:
```bash
run-tests.bat
```

### Docker Testing

```bash
# Run tests in Docker
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

Or use batch file:
```bash
docker-test.bat
```

**Both methods use the same test suite - choose what works for you!**

### Test Structure
- `tests/setup.js` - Test configuration with MongoDB Memory Server
- `tests/auth.test.js` - Authentication tests
- `tests/farms.test.js` - Farms API tests
- `tests/store.test.js` - Store products tests

## 📚 API Documentation

### Generate Documentation
```bash
npm run docs
```

Documentation will be generated in the `docs/` folder. Open `docs/index.html` in your browser.

### Example API Call

**Register User:**
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "farmer@example.com",
    "password": "password123",
    "role": "farm_manager"
  }'
```

**Get Store Products:**
```bash
curl http://localhost:8000/api/store_products
```

**Create Farm (requires auth):**
```bash
curl -X POST http://localhost:8000/api/farms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Green Valley Farm",
    "type": "dairy",
    "location": "Dhaka"
  }'
```

## 🚀 Deployment

### Deploy to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Set environment variables in Vercel dashboard:
   - `MONGODB_URI`
   - `JWT_SECRET`

### Production Deployment
```bash
vercel --prod
```

## 🔄 Migration from FastAPI

The Express.js API maintains the same:
- **Endpoints**: All paths match FastAPI version
- **Request/Response formats**: Compatible with existing frontend
- **Database schema**: Uses same MongoDB collections
- **Authentication**: JWT tokens work the same way

### Key Differences
- Base URL: `/api/` prefix for all routes
- Error responses: Consistent JSON format `{ error: "message" }`
- Better performance on serverless platforms

## 📊 Project Structure

```
farmfreshbd-backend-v2/
├── api/                    # Serverless functions
│   ├── index.js           # Health check
│   ├── auth.js            # Authentication
│   ├── farms.js           # Farms management
│   ├── products.js        # Products
│   ├── store.js           # Store products
│   ├── cart.js            # Shopping cart
│   ├── orders.js          # Orders
│   ├── management.js      # Farm management
│   └── stats.js           # Statistics
├── src/
│   ├── config/
│   │   ├── auth.js        # JWT & auth middleware
│   │   └── database.js    # MongoDB connection
│   ├── utils/
│   │   └── helpers.js     # Utility functions
│   └── index.js           # Local dev server
├── tests/                 # Test files
│   ├── setup.js
│   ├── auth.test.js
│   ├── farms.test.js
│   └── store.test.js
├── package.json
├── vercel.json           # Vercel config
└── README.md
```

## 🔒 Security

- Passwords hashed with bcrypt
- JWT tokens for authentication
- Input validation on all endpoints
- MongoDB injection protection
- CORS enabled with proper configuration

## 🤝 Contributing

1. Write tests for new features
2. Ensure all tests pass: `npm test`
3. Follow existing code style
4. Update API documentation

## 📝 License

MIT
