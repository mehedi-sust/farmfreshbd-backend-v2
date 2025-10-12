# Deployment Options - FarmFresh BD API

Complete guide for all deployment and execution options.

## 🎯 Overview

The FarmFresh BD API can be run in **three ways**:

1. **Direct Local** - Development on your machine
2. **Docker** - Containerized local development
3. **Vercel** - Production serverless deployment

---

## 1️⃣ Direct Local Execution

### Best For
- Active development
- Fast iteration
- Debugging
- Learning the codebase

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### Setup

```bash
cd farmfreshbd-backend-v2

# Install
npm install

# Configure
copy .env.example .env
# Edit .env with MongoDB URI

# Run
npm run dev
```

Or use batch files:
```bash
setup.bat      # One-time setup
run-dev.bat    # Start server
run-tests.bat  # Run tests
```

### Advantages
- ✅ Fastest startup
- ✅ Easy debugging
- ✅ Direct code access
- ✅ No Docker needed
- ✅ Native performance

### Environment Variables (.env)

```env
MONGODB_URI=mongodb://localhost:27017/farmfreshbd
JWT_SECRET=your-secret-key
PORT=8000
NODE_ENV=development
```

---

## 2️⃣ Docker Execution

### Best For
- Team collaboration
- Consistent environment
- Testing deployment
- No local MongoDB

### Prerequisites
- Docker Desktop

### Setup

```bash
cd farmfreshbd-backend-v2

# Start services
docker-compose up
```

Or use batch files:
```bash
docker-dev.bat   # Start services
docker-test.bat  # Run tests
```

### Advantages
- ✅ Isolated environment
- ✅ No MongoDB setup needed
- ✅ Consistent across machines
- ✅ Production-like
- ✅ Easy cleanup

### Services Started
- MongoDB on port 27017
- API on port 8000

### Docker Commands

```bash
# Start
docker-compose up              # Foreground
docker-compose up -d           # Background

# Stop
docker-compose down            # Stop services
docker-compose down -v         # Stop and remove data

# Logs
docker-compose logs            # View logs
docker-compose logs -f         # Follow logs

# Tests
docker-compose -f docker-compose.test.yml up --abort-on-container-exit

# Rebuild
docker-compose build           # Rebuild images
docker-compose up --build      # Rebuild and start
```

---

## 3️⃣ Vercel Deployment (Production)

### Best For
- Production deployment
- Serverless architecture
- Automatic scaling
- Global CDN

### Prerequisites
- Vercel account (free)
- MongoDB Atlas (or accessible MongoDB)

### Setup

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel
```

### First Deployment

1. **Deploy to Vercel**
   ```bash
   cd farmfreshbd-backend-v2
   vercel
   ```

2. **Set Environment Variables**
   
   In Vercel Dashboard:
   - Go to Project Settings
   - Navigate to Environment Variables
   - Add:
     - `MONGODB_URI` - Your MongoDB connection string
     - `JWT_SECRET` - Your JWT secret key

3. **Deploy to Production**
   ```bash
   vercel --prod
   ```

### Advantages
- ✅ Automatic scaling
- ✅ Global CDN
- ✅ Zero-downtime deploys
- ✅ Free tier available
- ✅ HTTPS included
- ✅ Fast cold starts

### Vercel Configuration

Already configured in `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ]
}
```

---

## 📊 Comparison

| Feature | Direct Local | Docker | Vercel |
|---------|-------------|--------|--------|
| **Setup Time** | 5 min | 10 min | 15 min |
| **Startup Speed** | Fast (1-2s) | Medium (5-10s) | Fast (1-2s) |
| **Isolation** | No | Yes | Yes |
| **MongoDB** | Manual | Automatic | External |
| **Scaling** | Manual | Manual | Automatic |
| **Cost** | Free | Free | Free tier |
| **Best For** | Development | Testing | Production |

---

## 🎯 Recommended Workflow

### Development Phase

```bash
# Use Direct Local for fast iteration
npm run dev
```

### Testing Phase

```bash
# Use Docker for consistent testing
docker-compose up
```

### Production Phase

```bash
# Deploy to Vercel
vercel --prod
```

---

## 🔄 Switching Between Methods

### From Direct to Docker

```bash
# Stop local server (Ctrl+C)
docker-compose up
```

### From Docker to Direct

```bash
# Stop Docker
docker-compose down

# Start local
npm run dev
```

### From Local/Docker to Vercel

```bash
# Just deploy
vercel
```

**All methods use the same code - no changes needed!**

---

## 🧪 Testing in Each Environment

### Direct Local

```bash
npm test
# Or
run-tests.bat
```

### Docker

```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
# Or
docker-test.bat
```

### Vercel

```bash
# Test locally first
npm test

# Then deploy
vercel

# Test deployed API
curl https://your-api.vercel.app/health
```

---

## 🔒 Environment Variables

### Direct Local (.env)

```env
MONGODB_URI=mongodb://localhost:27017/farmfreshbd
JWT_SECRET=your-secret-key
PORT=8000
NODE_ENV=development
```

### Docker (docker-compose.yml)

```yaml
environment:
  - MONGODB_URI=mongodb://mongodb:27017/farmfreshbd
  - JWT_SECRET=your-secret-key
  - PORT=8000
  - NODE_ENV=development
```

### Vercel (Dashboard)

Set in Vercel Dashboard:
- `MONGODB_URI` - MongoDB Atlas connection string
- `JWT_SECRET` - Production secret key

---

## 🐛 Troubleshooting

### Direct Local Issues

**MongoDB Connection Failed**
```bash
# Check MongoDB is running
services.msc  # Windows

# Or use MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/farmfreshbd
```

**Port Already in Use**
```bash
# Change port in .env
PORT=8001
```

### Docker Issues

**Container Won't Start**
```bash
# View logs
docker-compose logs

# Rebuild
docker-compose build --no-cache
docker-compose up
```

**Port Conflict**
```bash
# Stop other services
docker-compose down

# Or change port in docker-compose.yml
```

### Vercel Issues

**Deployment Failed**
```bash
# Check logs
vercel logs

# Redeploy
vercel --prod
```

**Environment Variables Missing**
- Set in Vercel Dashboard
- Redeploy after setting

---

## 📚 Quick Reference

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

### Vercel

```bash
# Setup
npm i -g vercel
vercel login

# Deploy
vercel

# Production
vercel --prod
```

---

## 🎓 Best Practices

### Development
1. Use **Direct Local** for active development
2. Use **Docker** for testing before commits
3. Run tests before pushing code

### Production
1. Use **Vercel** for production deployment
2. Use MongoDB Atlas for database
3. Set strong JWT_SECRET
4. Monitor logs regularly

### Team Collaboration
1. Use **Docker** for consistent environment
2. Document environment variables
3. Use .env.example as template
4. Never commit .env file

---

## ✅ Summary

### Choose Your Method

**Direct Local** → Fast development
**Docker** → Consistent testing
**Vercel** → Production deployment

**All methods work with the same code!**

---

## 📞 Need Help?

- **Setup Issues**: See [DOCKER_GUIDE.md](DOCKER_GUIDE.md)
- **Testing**: See [TESTING_GUIDE.md](TESTING_GUIDE.md)
- **Migration**: See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)
- **API Reference**: Run `npm run docs`

---

**You have complete flexibility - choose what works best for your workflow!**
