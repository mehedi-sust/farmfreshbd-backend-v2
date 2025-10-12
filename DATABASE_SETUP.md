# Database Setup Guide

## 🗄️ MongoDB Configuration

The Express.js backend supports both **local MongoDB** and **MongoDB Atlas** (cloud).

---

## 🚀 Quick Setup

### Option 1: MongoDB Atlas (Recommended)

1. **Get your connection string** from MongoDB Atlas
2. **Update `.env` file**:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/farmfreshbd?retryWrites=true&w=majority
   ```
3. **Test connection**:
   ```bash
   npm run test:db
   ```

### Option 2: Local MongoDB

1. **Install MongoDB** locally
2. **Start MongoDB**:
   ```bash
   mongod
   ```
3. **Update `.env` file**:
   ```env
   MONGODB_URI=mongodb://localhost:27017/farmfreshbd
   ```
4. **Test connection**:
   ```bash
   npm run test:db
   ```

---

## 📋 Detailed Setup

### MongoDB Atlas Setup

#### Step 1: Create MongoDB Atlas Account

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up for free account
3. Create a new cluster (free tier available)

#### Step 2: Create Database User

1. Go to **Database Access**
2. Click **Add New Database User**
3. Choose **Password** authentication
4. Set username and password
5. Grant **Read and write to any database** role
6. Click **Add User**

#### Step 3: Whitelist IP Address

1. Go to **Network Access**
2. Click **Add IP Address**
3. Choose **Allow Access from Anywhere** (0.0.0.0/0) for development
4. Or add your specific IP address
5. Click **Confirm**

#### Step 4: Get Connection String

1. Go to **Database** → **Connect**
2. Choose **Connect your application**
3. Select **Node.js** driver
4. Copy the connection string
5. Replace `<password>` with your actual password
6. Replace `<dbname>` with `farmfreshbd` (or your preferred name)

Example:
```
mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/farmfreshbd?retryWrites=true&w=majority
```

#### Step 5: Update .env File

```env
MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/farmfreshbd?retryWrites=true&w=majority
JWT_SECRET=your-secret-key-here
PORT=8000
NODE_ENV=development
```

**Important**: Replace `myuser` and `mypassword` with your actual credentials!

---

### Local MongoDB Setup

#### Step 1: Install MongoDB

**Windows:**
1. Download from https://www.mongodb.com/try/download/community
2. Run installer
3. Choose "Complete" installation
4. Install as Windows Service (recommended)

**Mac:**
```bash
brew tap mongodb/brew
brew install mongodb-community
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get install mongodb

# Or follow official guide
```

#### Step 2: Start MongoDB

**Windows (if installed as service):**
- MongoDB starts automatically
- Or run: `net start MongoDB`

**Mac:**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
```

#### Step 3: Verify MongoDB is Running

```bash
# Check if MongoDB is listening on port 27017
netstat -an | findstr 27017

# Or connect with mongo shell
mongosh
```

#### Step 4: Update .env File

```env
MONGODB_URI=mongodb://localhost:27017/farmfreshbd
JWT_SECRET=your-secret-key-here
PORT=8000
NODE_ENV=development
```

---

## 🧪 Test Database Connection

### Quick Test

```bash
# Run test script
npm run test:db

# Or use batch file
test-db.bat
```

### Manual Test

```bash
node test-db-connection.js
```

### Expected Output

```
========================================
🧪 Testing MongoDB Connection
========================================

📍 Connection Type: MongoDB Atlas
🔗 URI: mongodb+srv://...

🔌 Connecting to MongoDB...
✅ Connected successfully!

🏓 Pinging database...
✅ Ping successful!

📦 Database: farmfreshbd
📚 Collections found: 5
   Collections: users, farms, products, orders, cart_items

👥 Users in database: 3

========================================
✅ Database Connection Test PASSED!
========================================

💡 You can now start the server with: npm run dev
```

---

## 🔧 Troubleshooting

### Issue: Authentication Failed

**Error**: `MongoServerError: bad auth : authentication failed`

**Solutions**:
1. Check username and password are correct
2. Ensure password is URL-encoded (replace special characters)
3. Verify user has correct permissions in Atlas
4. Make sure you're using the correct database name

**URL Encoding**:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`

Example:
```
Password: my@pass#123
Encoded: my%40pass%23123
```

### Issue: Network Timeout

**Error**: `MongoServerError: connection timed out`

**Solutions**:
1. Check your internet connection
2. Verify IP is whitelisted in MongoDB Atlas
3. Try allowing access from anywhere (0.0.0.0/0)
4. Check firewall settings

### Issue: Connection Refused (Local)

**Error**: `MongoServerError: connect ECONNREFUSED`

**Solutions**:
1. Make sure MongoDB is running:
   ```bash
   # Windows
   net start MongoDB
   
   # Mac
   brew services start mongodb-community
   
   # Linux
   sudo systemctl start mongod
   ```

2. Check if MongoDB is listening:
   ```bash
   netstat -an | findstr 27017
   ```

3. Try connecting with mongo shell:
   ```bash
   mongosh
   ```

### Issue: Database Not Found

**Error**: Database exists but collections are empty

**Solution**: The database and collections are created automatically when you first insert data. Just start using the API!

---

## 🔐 Security Best Practices

### For Development

1. **Use strong passwords**
2. **Don't commit .env file** (already in .gitignore)
3. **Use different credentials for dev/prod**

### For Production

1. **Use MongoDB Atlas** (recommended)
2. **Whitelist specific IPs** (not 0.0.0.0/0)
3. **Use strong, unique passwords**
4. **Enable MongoDB encryption**
5. **Regular backups**
6. **Monitor access logs**

---

## 📊 Database Structure

### Collections

- `users` - User accounts
- `farms` - Farm information
- `products` - Farm products
- `product_batches` - Product batches
- `expenses` - Farm expenses
- `investments` - Farm investments
- `sales` - Product sales
- `store_products` - E-commerce products
- `cart_items` - Shopping cart
- `orders` - Customer orders

### Indexes (Auto-created)

- `users.email` - Unique index
- `products.farm_id` - For farm queries
- `orders.customer_id` - For customer queries
- `orders.farm_id` - For farm manager queries

---

## 🚀 Starting the Server

### With Database Check

The server automatically checks database connection on startup:

```bash
npm run dev
```

**Output**:
```
🔌 Connecting to MongoDB...
📍 Type: MongoDB Atlas
✅ Successfully connected to MongoDB!
📦 Using database: farmfreshbd

========================================
🚀 FarmFresh BD API Server Started!
========================================
📍 Server: http://localhost:8000
📚 API Docs: http://localhost:8000/docs
💚 Health: http://localhost:8000/health
🗄️  Database: Connected ✅
========================================
```

### If Connection Fails

```
❌ Failed to connect to database. Please check your MONGODB_URI in .env file
💡 Tip: Make sure MongoDB is running or your Atlas connection string is correct
```

**Action**: Run `npm run test:db` to diagnose the issue

---

## 📝 Environment Variables

### Required

```env
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-secret-key
```

### Optional

```env
PORT=8000
NODE_ENV=development
```

---

## ✅ Checklist

Before starting the server:

- [ ] MongoDB Atlas cluster created (or local MongoDB installed)
- [ ] Database user created with correct permissions
- [ ] IP address whitelisted (Atlas only)
- [ ] Connection string copied
- [ ] `.env` file created with MONGODB_URI
- [ ] Connection tested: `npm run test:db`
- [ ] Test passed ✅

---

## 🎯 Quick Commands

```bash
# Test database connection
npm run test:db

# Start server (with auto DB check)
npm run dev

# Test API health
curl http://localhost:8000/health
```

---

## 📞 Need Help?

### Common Issues

1. **Can't connect to Atlas**
   - Check IP whitelist
   - Verify credentials
   - Test with `npm run test:db`

2. **Local MongoDB not starting**
   - Check if service is running
   - Try manual start: `mongod`
   - Check port 27017 is free

3. **Login not working**
   - Verify database connection
   - Check if users exist
   - Test with `npm run test:db`

### Resources

- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com/)
- [MongoDB Node.js Driver](https://mongodb.github.io/node-mongodb-native/)
- [Connection String Format](https://docs.mongodb.com/manual/reference/connection-string/)

---

**Status**: Ready to connect! 🚀

Run `npm run test:db` to verify your setup.
