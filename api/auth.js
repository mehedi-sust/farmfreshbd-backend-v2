/**
 * Authentication API Routes
 * Handles user registration, login, and authentication
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { generateToken, hashPassword, comparePassword, authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, toObjectId } = require('../src/utils/helpers');

const router = express.Router();

// User Registration - POST /auth/register
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, role = 'customer', farm_name, contact_number, address } = req.body;

  // Validate required fields
  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email and password are required' 
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      error: 'Invalid email format' 
    });
  }

  // Validate password length
  if (password.length < 6) {
    return res.status(400).json({ 
      error: 'Password must be at least 6 characters long' 
    });
  }

  const { db } = await connectToDatabase();
  const { users } = await getCollections(db);

  // Check if user already exists
  const existingUser = await users.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return res.status(400).json({ 
      error: 'User with this email already registered' 
    });
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user object
  const userData = {
    email: email.toLowerCase(),
    password: hashedPassword,
    role,
    created_at: new Date(),
    updated_at: new Date()
  };

  // Add optional fields based on role
  if (role === 'farmer' || role === 'farm_manager') {
    if (farm_name) userData.farm_name = farm_name;
    if (contact_number) userData.contact_number = contact_number;
    if (address) userData.address = address;
  }

  // Insert user
  const result = await users.insertOne(userData);
  
  // Generate token
  const token = generateToken({ 
    userId: result.insertedId.toString(), 
    email: userData.email,
    role: userData.role 
  });

  // Return user data (without password) and token
  const userResponse = {
    _id: result.insertedId.toString(),
    email: userData.email,
    role: userData.role,
    created_at: userData.created_at
  };

  // Add optional fields to response
  if (userData.farm_name) userResponse.farm_name = userData.farm_name;
  if (userData.contact_number) userResponse.contact_number = userData.contact_number;
  if (userData.address) userResponse.address = userData.address;

  res.status(201).json({
    ...userResponse,
    token,
    access_token: token,
    token_type: 'bearer'
  });
}));

// User Login - POST /auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email and password are required' 
    });
  }

  const { db } = await connectToDatabase();
  const { users } = await getCollections(db);

  // Find user by email
  const user = await users.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ 
      error: 'Incorrect email or password' 
    });
  }

  // Check if password field exists
  if (!user.password) {
    return res.status(500).json({ 
      error: 'User account is corrupted. Please contact support.' 
    });
  }

  // Verify password
  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ 
      error: 'Incorrect email or password' 
    });
  }

  // Generate token
  const token = generateToken({ 
    userId: user._id.toString(), 
    email: user.email,
    role: user.role 
  });

  // Prepare user response (without password)
  const userResponse = serializeDoc(user);
  delete userResponse.password;

  res.json({
    access_token: token,
    token: token,
    token_type: 'bearer',
    user: userResponse,
    success: true
  });
}));

// Get Current User - GET /auth/me
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const { db } = await connectToDatabase();
  const { users } = await getCollections(db);

  // Get user from database (req.user is set by authenticate middleware)
  // Handle both userId and direct user ID from token
  // The JWT token has a nested structure where userId is an object containing the actual userId
  let userId;
  if (req.user.userId && typeof req.user.userId === 'object' && req.user.userId.userId) {
    userId = req.user.userId.userId;
  } else {
    userId = req.user.userId || req.user.id || req.user._id;
  };
  
  if (!userId) {
    return res.status(400).json({ 
      error: 'Invalid token: no user ID found',
      tokenPayload: req.user
    });
  }

  const user = await users.findOne({ _id: toObjectId(userId) });
  
  if (!user) {
    return res.status(404).json({ 
      error: 'User not found' 
    });
  }

  // Return user data (without password)
  const userResponse = serializeDoc(user);
  delete userResponse.password;

  res.json(userResponse);
}));

// Create farm (for new farmers/farm managers after registration)
router.post('/create-farm', asyncHandler(async (req, res) => {
  const { farm_name, farm_type, contact_number, address, location, bio, build_year, banner_image, user_id } = req.body;

  if (!farm_name || !farm_type || !user_id) {
    return res.status(400).json({ error: 'Farm name, type, and user_id are required' });
  }

  const validTypes = ['dairy', 'egg', 'multi_purpose', 'vegetable', 'livestock'];
  if (!validTypes.includes(farm_type)) {
    return res.status(400).json({ error: 'Invalid farm type' });
  }

  const { db } = await connectToDatabase();
  const { farms, users } = await getCollections(db);

  const user = await users.findOne({ _id: toObjectId(user_id) });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check if user already has a farm
  if (user.farm_id) {
    const existingFarm = await farms.findOne({ _id: user.farm_id });
    if (existingFarm) {
      return res.json({
        message: 'User already has a farm',
        farm_id: existingFarm._id.toString(),
        farm: serializeDoc(existingFarm)
      });
    } else {
      // Farm ID exists but farm not found, clear it
      await users.updateOne(
        { _id: toObjectId(user_id) },
        { $set: { farm_id: null, updated_at: new Date() } }
      );
    }
  }

  const farmDoc = {
    name: farm_name,
    type: farm_type,
    owner_id: toObjectId(user_id),
    address: address || null,
    phone: contact_number || null,
    location: location || null,
    bio: bio || null,
    office_hour: null,
    build_year: build_year ? parseInt(build_year) : null,
    banner_image: banner_image || null,
    profile_image: null,
    is_public: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const result = await farms.insertOne(farmDoc);
  const farmId = result.insertedId;

  // Update user with farm_id
  await users.updateOne(
    { _id: toObjectId(user_id) },
    { 
      $set: { 
        farm_id: farmId,
        is_main_manager: true,
        updated_at: new Date()
      } 
    }
  );

  const createdFarm = await farms.findOne({ _id: farmId });

  res.status(201).json({
    message: 'Farm created successfully',
    farm_id: farmId.toString(),
    farm: serializeDoc(createdFarm)
  });
}));

// Health check for auth routes
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Authentication API is running',
    endpoints: ['register', 'login', 'me', 'create-farm']
  });
});

module.exports = router;