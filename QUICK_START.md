# Quick Start Guide

Get the FarmFresh BD API running in 5 minutes.

## 🎯 Two Ways to Run

Choose your preferred method:

1. **Direct Local** - Faster, easier debugging (Recommended for development)
2. **Docker** - Isolated, consistent environment (Recommended for teams)

---

## 🚀 Option 1: Direct Local (No Docker)

### Quick Setup (Windows)

```bash
# Run automated setup
setup.bat
```

This will:
1. Install dependencies
2. Create .env file
3. Run tests
4. Generate documentation

### Manual Setup

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Configure Environment

```bash
# Copy example environment file
copy .env.example .env

# Edit .env with your settings
notepad .env
```

Required variables:
```env
MONGODB_URI=mongodb://localhost:27017/farmfreshbd
JWT_SECRET=your-secret-key-here
PORT=8000
NODE_ENV=development
```

#### 3. Run Tests

```bash
npm test
```

Or:
```bash
run-tests.bat
```

#### 4. Start Development Server

```bash
npm run dev
```

Or:
```bash
run-dev.bat
```

---

## 🐳 Option 2: Docker

### Quick Setup

```bash
# Start everything (MongoDB + API)
docker-compose up
```

Or use batch file:
```bash
docker-dev.bat
```

This will:
1. Start MongoDB container
2. Start API container
3. Connect them together
4. Expose API on http://localhost:8000

### Run Tests in Docker

```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

Or:
```bash
docker-test.bat
```

### Stop Services

```bash
docker-compose down
```

---

## 📚 Detailed Instructions

For complete setup instructions for both methods, see:
- **[DOCKER_GUIDE.md](DOCKER_GUIDE.md)** - Complete guide for both methods

---

## 🧪 Run Tests (Both Methods)

### Direct Local

```bash
npm run dev
```

Server runs at: `http://localhost:8000`

## ✅ Verify Installation

### Test API Health

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Test Registration

```bash
curl -X POST http://localhost:8000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"password123\",\"role\":\"farmer\"}"
```

## 📚 Next Steps

1. **Read Documentation**
   - `README.md` - Complete guide
   - `TESTING_GUIDE.md` - Testing documentation
   - `MIGRATION_GUIDE.md` - Migration from FastAPI

2. **Explore API**
   - Open `docs/index.html` for API documentation
   - Test endpoints with Postman or curl

3. **Deploy to Vercel**
   ```bash
   npm i -g vercel
   vercel login
   vercel
   ```

## 🧪 Run Tests

### Direct Local

```bash
# All tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

Or:
```bash
run-tests.bat
```

### Docker

```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

Or:
```bash
docker-test.bat
```

## 📖 Generate Documentation

```bash
npm run docs
```

Open `docs/index.html` in browser.

## 🚀 Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Production
vercel --prod
```

Set environment variables in Vercel dashboard:
- `MONGODB_URI`
- `JWT_SECRET`

## 🔍 Troubleshooting

### Port Already in Use

```bash
# Change PORT in .env
PORT=8001
```

### MongoDB Connection Failed

Check:
1. MongoDB is running
2. Connection string is correct
3. Database exists

### Tests Failing

```bash
# Clear node_modules and reinstall
rmdir /s /q node_modules
npm install
npm test
```

## 📞 Get Help

- Check `README.md` for detailed documentation
- Review `TESTING_GUIDE.md` for testing help
- See `MIGRATION_GUIDE.md` for migration questions

## 🎯 Common Commands

```bash
# Development
npm run dev              # Start dev server
npm test                 # Run tests
npm run test:watch       # Watch mode

# Documentation
npm run docs             # Generate API docs

# Deployment
vercel                   # Deploy to Vercel
vercel --prod           # Production deployment

# Testing
npm test -- --coverage   # Coverage report
npm test auth.test.js    # Specific test
```

## ✨ Features

- ✅ 8 serverless functions
- ✅ JWT authentication
- ✅ MongoDB integration
- ✅ Comprehensive tests
- ✅ API documentation
- ✅ Vercel ready
- ✅ Frontend compatible

## 🎉 You're Ready!

The API is now running and ready for development or deployment.

Visit: `http://localhost:8000`
