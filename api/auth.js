/**
 * Authentication API endpoints for Vercel serverless deployment
 * Handles user registration, login, and authentication
 */

const { connectToDatabase, getCollections } = require('../src/config/database');
const { generateToken, hashPassword, comparePassword } = require('../src/config/auth');
const { asyncHandler, serializeDoc } = require('../src/utils/helpers');

// Serverless function handler
module.exports = async (req, res) => {
  // Set CORS headers - allow all origins for development
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Connect to database
    await connectToDatabase();
    const { users } = await getCollections();

    const { method, url } = req;
    const path = url.replace('/api/auth', '').replace('/auth', '');

    // Route handling
    if (method === 'POST' && (path === '/register' || path === '')) {
      return await handleRegister(req, res, users);
    }
    
    if (method === 'POST' && path === '/login') {
      return await handleLogin(req, res, users);
    }

    if (method === 'GET' && path === '/users') {
      return await handleGetUsers(req, res, users);
    }

    if (method === 'GET' && path === '/me') {
      return await handleGetCurrentUser(req, res, users);
    }

    // If no route matches
    return res.status(404).json({ 
      error: 'Auth endpoint not found',
      path: path,
      method: method
    });

  } catch (error) {
    console.error('Auth API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Register handler
async function handleRegister(req, res, users) {
  const { email, password, role = 'customer' } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Check if user already exists
  const existingUser = await users.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  // Hash password and create user
  const hashedPassword = await hashPassword(password);
  const newUser = {
    email,
    password: hashedPassword,
    role,
    created_at: new Date(),
    updated_at: new Date()
  };

  const result = await users.insertOne(newUser);
  const token = generateToken(result.insertedId, email, role);

  return res.status(201).json({
    message: 'User registered successfully',
    userId: result.insertedId,
    token,
    user: {
      id: result.insertedId,
      email,
      role
    }
  });
}

// Login handler
async function handleLogin(req, res, users) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Find user
  const user = await users.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Check password
  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate token
  const token = generateToken(user._id, user.email, user.role);

  return res.status(200).json({
    message: 'Login successful',
    token,
    user: serializeDoc({
      _id: user._id,
      email: user.email,
      role: user.role
    })
  });
}

// Get users handler (admin only)
async function handleGetUsers(req, res, users) {
  // This would need authentication middleware in a full implementation
  const { page = 1, limit = 10, search = '' } = req.query;
  
  const query = search ? { 
    $or: [
      { email: { $regex: search, $options: 'i' } },
      { role: { $regex: search, $options: 'i' } }
    ]
  } : {};

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const usersList = await users.find(query)
    .skip(skip)
    .limit(parseInt(limit))
    .project({ password: 0 }) // Exclude password
    .toArray();

  const total = await users.countDocuments(query);

  return res.status(200).json({
    users: usersList.map(serializeDoc),
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalUsers: total,
      usersPerPage: parseInt(limit)
    }
  });
}

// Get current user handler
async function handleGetCurrentUser(req, res, users) {
  // This would need authentication middleware to get user from token
  return res.status(200).json({
    message: 'Current user endpoint - requires authentication implementation'
  });
}