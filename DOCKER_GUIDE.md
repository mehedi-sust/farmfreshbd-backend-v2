# Docker Guide - FarmFresh BD API

Complete guide for running the API with Docker or directly on your machine.

## 🎯 Two Ways to Run

You can run the API in **two ways**:

1. **Directly on your machine** (No Docker needed)
2. **With Docker** (Isolated environment)

Both methods work perfectly - choose what suits you best!

---

## 🚀 Option 1: Direct Local Execution (No Docker)

### Prerequisites
- Node.js 18+ installed
- MongoDB installed and running locally

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
copy .env.example .env
# Edit .env with your MongoDB URI

# 3. Start MongoDB (if not running)
# Windows: MongoDB should be running as a service
# Or start manually: mongod

# 4. Run development server
npm run dev
```

Or use the batch file:
```bash
run-dev.bat
```

### Run Tests Directly

```bash
# Run all tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

Or use the batch file:
```bash
run-tests.bat
```

### Advantages
- ✅ Faster startup (no container overhead)
- ✅ Direct access to code
- ✅ Easy debugging
- ✅ No Docker installation needed
- ✅ Native performance

### Requirements
- Node.js 18+
- MongoDB running locally
- Port 8000 available

---

## 🐳 Option 2: Docker Execution

### Prerequisites
- Docker Desktop installed
- Docker Compose installed (included with Docker Desktop)

### Quick Start

```bash
# Start everything with one command
docker-compose up
```

Or use the batch file:
```bash
docker-dev.bat
```

This will:
- Start MongoDB in a container
- Start the API in a container
- Connect them together
- Expose API on http://localhost:8000

### Run Tests with Docker

```bash
# Run tests in Docker
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

Or use the batch file:
```bash
docker-test.bat
```

### Advantages
- ✅ Isolated environment
- ✅ No local MongoDB needed
- ✅ Consistent across machines
- ✅ Easy cleanup
- ✅ Production-like environment

### Requirements
- Docker Desktop
- 2GB+ RAM available
- Ports 8000 and 27017 available

---

## 📋 Detailed Instructions

### Direct Local Setup

#### Step 1: Install Node.js

Download from: https://nodejs.org/ (LTS version)

Verify installation:
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

#### Step 2: Install MongoDB

**Windows:**
1. Download from: https://www.mongodb.com/try/download/community
2. Install MongoDB Community Server
3. MongoDB runs as a Windows service automatically

**Or use MongoDB Atlas (cloud):**
- Free tier available
- No local installation needed
- Get connection string from Atlas dashboard

#### Step 3: Setup Project

```bash
cd farmfreshbd-backend-v2

# Install dependencies
npm install

# Create environment file
copy .env.example .env

# Edit .env
notepad .env
```

Set your MongoDB URI:
```env
# For local MongoDB
MONGODB_URI=mongodb://localhost:27017/farmfreshbd

# Or for MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/farmfreshbd

JWT_SECRET=your-secret-key-here
PORT=8000
NODE_ENV=development
```

#### Step 4: Run Development Server

```bash
npm run dev
```

Or:
```bash
run-dev.bat
```

Server runs at: http://localhost:8000

#### Step 5: Run Tests

```bash
npm test
```

Or:
```bash
run-tests.bat
```

---

### Docker Setup

#### Step 1: Install Docker Desktop

Download from: https://www.docker.com/products/docker-desktop

**Windows:**
1. Download Docker Desktop for Windows
2. Install and restart
3. Ensure WSL 2 is enabled (Docker will prompt)

Verify installation:
```bash
docker --version
docker-compose --version
```

#### Step 2: Start Services

```bash
cd farmfreshbd-backend-v2

# Start all services
docker-compose up
```

Or use batch file:
```bash
docker-dev.bat
```

This starts:
- MongoDB on port 27017
- API on port 8000

#### Step 3: Verify Services

```bash
# Check running containers
docker ps

# Should see:
# - farmfresh-mongodb
# - farmfresh-api
```

Test API:
```bash
curl http://localhost:8000/health
```

#### Step 4: Run Tests in Docker

```bash
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

Or:
```bash
docker-test.bat
```

#### Step 5: Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

---

## 🔧 Common Commands

### Direct Local Execution

```bash
# Development
npm run dev              # Start dev server
npm test                 # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage

# Utilities
npm run docs             # Generate API docs
npm install              # Install dependencies
npm update               # Update dependencies
```

### Docker Execution

```bash
# Start services
docker-compose up                    # Start in foreground
docker-compose up -d                 # Start in background
docker-compose up --build            # Rebuild and start

# Stop services
docker-compose down                  # Stop services
docker-compose down -v               # Stop and remove volumes

# View logs
docker-compose logs                  # All logs
docker-compose logs api              # API logs only
docker-compose logs -f               # Follow logs

# Run tests
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit

# Execute commands in container
docker-compose exec api npm test     # Run tests
docker-compose exec api npm run docs # Generate docs
docker-compose exec api sh           # Shell access

# Rebuild
docker-compose build                 # Rebuild images
docker-compose build --no-cache      # Clean rebuild
```

---

## 🐛 Troubleshooting

### Direct Local Execution

#### Issue: MongoDB Connection Failed

**Solution 1: Check MongoDB is running**
```bash
# Windows - Check service
services.msc
# Look for "MongoDB Server"

# Or check if port is listening
netstat -an | findstr 27017
```

**Solution 2: Use MongoDB Atlas**
```env
# In .env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/farmfreshbd
```

#### Issue: Port 8000 Already in Use

**Solution:**
```bash
# Change port in .env
PORT=8001

# Or kill process using port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

#### Issue: Module Not Found

**Solution:**
```bash
# Reinstall dependencies
rmdir /s /q node_modules
npm install
```

### Docker Execution

#### Issue: Docker Not Running

**Solution:**
```bash
# Start Docker Desktop
# Wait for it to fully start (whale icon in system tray)
```

#### Issue: Port Already in Use

**Solution:**
```bash
# Stop conflicting services
docker-compose down

# Or change ports in docker-compose.yml
ports:
  - "8001:8000"  # Use 8001 instead of 8000
```

#### Issue: Container Won't Start

**Solution:**
```bash
# View logs
docker-compose logs api

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

#### Issue: MongoDB Connection Failed in Docker

**Solution:**
```bash
# Check MongoDB container is running
docker ps

# Check MongoDB logs
docker-compose logs mongodb

# Restart services
docker-compose restart
```

---

## 📊 Comparison

| Feature | Direct Local | Docker |
|---------|-------------|--------|
| **Setup Time** | 5-10 min | 10-15 min |
| **Startup Speed** | Fast (1-2s) | Slower (5-10s) |
| **Resource Usage** | Low | Medium |
| **Isolation** | No | Yes |
| **MongoDB Setup** | Manual | Automatic |
| **Debugging** | Easy | Moderate |
| **Consistency** | Varies | Consistent |
| **Production-like** | No | Yes |

---

## 🎯 Recommendations

### Use Direct Local When:
- ✅ Developing actively
- ✅ Need fast iteration
- ✅ Debugging code
- ✅ Have MongoDB installed
- ✅ Working alone

### Use Docker When:
- ✅ Team collaboration
- ✅ Testing deployment
- ✅ Need isolation
- ✅ Don't want to install MongoDB
- ✅ Want consistent environment

---

## 🚀 Quick Reference

### Direct Local

```bash
# Setup
npm install
copy .env.example .env
npm run dev

# Test
npm test

# Stop
Ctrl+C
```

### Docker

```bash
# Setup
docker-compose up

# Test
docker-compose -f docker-compose.test.yml up --abort-on-container-exit

# Stop
docker-compose down
```

---

## 📝 Environment Variables

### For Direct Local (.env)

```env
MONGODB_URI=mongodb://localhost:27017/farmfreshbd
JWT_SECRET=your-secret-key-change-this
PORT=8000
NODE_ENV=development
```

### For Docker (docker-compose.yml)

Already configured in `docker-compose.yml`:
```yaml
environment:
  - MONGODB_URI=mongodb://mongodb:27017/farmfreshbd
  - JWT_SECRET=your-secret-key-change-this
  - PORT=8000
  - NODE_ENV=development
```

---

## 🎓 Best Practices

### Direct Local Development

1. **Use nodemon** (already configured)
   - Auto-restarts on file changes
   - Fast development cycle

2. **Use local MongoDB**
   - Faster than cloud
   - No internet needed

3. **Use .env file**
   - Never commit secrets
   - Easy configuration

### Docker Development

1. **Use volumes** (already configured)
   - Code changes reflect immediately
   - No rebuild needed

2. **Use docker-compose**
   - Easy multi-service management
   - Consistent networking

3. **Clean up regularly**
   ```bash
   docker-compose down -v
   docker system prune
   ```

---

## 🔄 Switching Between Methods

You can easily switch between direct and Docker execution:

### From Direct to Docker

```bash
# Stop local server (Ctrl+C)

# Start Docker
docker-compose up
```

### From Docker to Direct

```bash
# Stop Docker
docker-compose down

# Start local
npm run dev
```

**Note:** Both use the same code, so no changes needed!

---

## 📚 Additional Resources

- [Node.js Documentation](https://nodejs.org/docs)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

---

## ✅ Summary

### Direct Local Execution
- **Command**: `npm run dev` or `run-dev.bat`
- **Tests**: `npm test` or `run-tests.bat`
- **Best for**: Active development

### Docker Execution
- **Command**: `docker-compose up` or `docker-dev.bat`
- **Tests**: `docker-test.bat`
- **Best for**: Consistent environment

**Both methods work perfectly - choose what suits your workflow!**
