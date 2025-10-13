/**
 * @api {post} /api/auth/register Register User
 * @apiName RegisterUser
 * @apiGroup Authentication
 * @apiVersion 1.0.0
 * 
 * @apiBody {String} email User email
 * @apiBody {String} password User password
 * @apiBody {String="admin","farmer","farm_manager","customer"} role User role
 * 
 * @apiSuccess {String} message Success message
 * @apiSuccess {String} userId Created user ID
 * @apiSuccess {String} token JWT token
 * 
 * @apiError (400) EmailExists Email already registered
 */

const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { generateToken, hashPassword, comparePassword } = require('../src/config/auth');
const { asyncHandler, serializeDoc } = require('../src/utils/helpers');

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Auth router is working!' });
});

// Register
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;

  console.log('📝 Registration attempt for:', email, 'Role:', role);

  if (!email || !password || !role) {
    console.log('❌ Missing required fields');
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }

  const validRoles = ['admin', 'farmer', 'farm_manager', 'customer', 'service_provider'];
  if (!validRoles.includes(role)) {
    console.log('❌ Invalid role:', role);
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const { db } = await connectToDatabase();
    const { users } = await getCollections(db);

    console.log('🔍 Checking if email exists...');
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      console.log('❌ Email already registered:', email);
      return res.status(400).json({ error: 'Email already registered' });
    }

    console.log('🔐 Hashing password...');
    const hashedPassword = await hashPassword(password);

    const userDoc = {
      email,
      hashed_password: hashedPassword,
      role,
      farm_id: null,
      is_main_manager: false,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    console.log('💾 Inserting user into database...');
    const result = await users.insertOne(userDoc);
    const userId = result.insertedId.toString();

    console.log('🎫 Generating token...');
    const token = generateToken(userId, email, role);

    console.log('✅ Registration successful for:', email);

    res.status(201).json({
      message: 'User registered successfully',
      userId,
      token,
      user: {
        _id: userId,
        email,
        role,
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    throw error;
  }
}));

// Login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  console.log('🔐 Login attempt for:', email);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { db } = await connectToDatabase();
    const { users } = await getCollections(db);

    const user = await users.findOne({ email });
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('✅ User found:', email);

    const isValidPassword = await comparePassword(password, user.password || user.hashed_password);
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('✅ Password valid for:', email);

    const token = generateToken(user._id.toString(), user.email, user.role);

    console.log('✅ Login successful for:', email);
    console.log('   Farm ID:', user.farm_id);

    // Return both token and user info with farm_id at root level for compatibility
    res.json({
      message: 'Login successful',
      access_token: token, // FastAPI compatibility
      token, // Express.js style
      farm_id: user.farm_id ? user.farm_id.toString() : null,
      user: serializeDoc({
        _id: user._id,
        email: user.email,
        role: user.role,
        farm_id: user.farm_id,
      })
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    throw error;
  }
}));

// Get current user
router.get('/me', asyncHandler(async (req, res) => {
  console.log('🔍 /me endpoint called');
  const authHeader = req.headers.authorization;
  console.log('🔍 Auth header:', authHeader);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ No token provided or invalid format');
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  console.log('🔍 Extracted token:', token);
  const { verifyToken } = require('../src/config/auth');
  const decoded = verifyToken(token);
  console.log('🔍 Decoded token:', decoded);

  if (!decoded) {
    console.log('❌ Token verification failed');
    return res.status(401).json({ error: 'Invalid token' });
  }

  console.log('✅ Token verified, looking up user:', decoded.userId);
  const { db } = await connectToDatabase();
  const { users } = await getCollections(db);
  const { toObjectId } = require('../src/utils/helpers');

  const user = await users.findOne({ _id: toObjectId(decoded.userId) });
  console.log('🔍 User found:', user ? 'Yes' : 'No');
  
  if (!user) {
    console.log('❌ User not found in database');
    return res.status(404).json({ error: 'User not found' });
  }

  console.log('✅ Returning user data');
  res.json(serializeDoc({
    _id: user._id,
    email: user.email,
    role: user.role,
    farm_id: user.farm_id,
    is_active: user.is_active,
  }));
}));

// Create farm (for new farmers/farm managers after registration)
router.post('/create-farm', asyncHandler(async (req, res) => {
  const { farm_name, farm_type, contact_number, address, location, bio, build_year, banner_image, user_id } = req.body;

  console.log('🏡 Farm creation attempt');
  console.log('   Farm name:', farm_name);
  console.log('   Farm type:', farm_type);
  console.log('   User ID:', user_id);

  if (!farm_name || !farm_type || !user_id) {
    console.log('❌ Missing required fields');
    return res.status(400).json({ error: 'Farm name, type, and user_id are required' });
  }

  const validTypes = ['dairy', 'egg', 'multi_purpose', 'vegetable', 'livestock'];
  if (!validTypes.includes(farm_type)) {
    console.log('❌ Invalid farm type:', farm_type);
    return res.status(400).json({ error: 'Invalid farm type' });
  }

  try {
    const { db } = await connectToDatabase();
    const { farms, users } = await getCollections(db);
    const { toObjectId } = require('../src/utils/helpers');

    console.log('🔍 Checking if user exists...');
    const user = await users.findOne({ _id: toObjectId(user_id) });
    if (!user) {
      console.log('❌ User not found:', user_id);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ User found:', user.email);

    // Check if user already has a farm
    if (user.farm_id) {
      console.log('⚠️ User already has a farm:', user.farm_id);
      const existingFarm = await farms.findOne({ _id: user.farm_id });
      if (existingFarm) {
        console.log('✅ Returning existing farm:', existingFarm.name);
        return res.json({
          message: 'User already has a farm',
          farm_id: existingFarm._id.toString(),
          farm: serializeDoc(existingFarm)
        });
      } else {
        // Farm ID exists but farm not found, clear it
        console.log('⚠️ Farm ID exists but farm not found, clearing...');
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

    console.log('💾 Creating farm...');
    const result = await farms.insertOne(farmDoc);
    const farmId = result.insertedId;

    console.log('🔄 Updating user with farm_id...');
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
    console.log('✅ Farm created successfully:', farm_name);

    res.status(201).json({
      message: 'Farm created successfully',
      farm_id: farmId.toString(),
      farm: serializeDoc(createdFarm)
    });
  } catch (error) {
    console.error('❌ Farm creation error:', error);
    throw error;
  }
}));

module.exports = router;