/**
 * Authentication API Routes
 * Handles user registration, login, and authentication
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectToDatabase } = require('../src/config/database');
const { generateToken, hashPassword, comparePassword, authenticate, optionalAuth, requireAdmin, authenticateAdmin } = require('../src/config/auth');
const { asyncHandler } = require('../src/utils/helpers');
const DatabaseService = require('../src/services/database.service');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Auth API is running',
    endpoints: ['register', 'login', 'logout', 'profile', 'create-farm']
  });
});

// User Registration - POST /register
router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required' });
  }

  // Prevent admin role creation via API registration
  if (role === 'admin') {
    return res.status(403).json({ error: 'Admin accounts cannot be created via registration. Please contact system administrator.' });
  }

  // Validate role
  const validRoles = ['farmer', 'farm_manager', 'customer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Valid roles are: farmer, farm_manager, customer' });
  }

  // Check if user already exists
  const existingUser = await DatabaseService.getUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }

  const hashedPassword = await hashPassword(password);

  const userData = {
    name,
    email,
    password_hash: hashedPassword,
    role,
    phone: phone || null
  };

  const createdUser = await DatabaseService.createUser(userData);

  // Remove password_hash from response and add name field for frontend compatibility
  const { password_hash, first_name, last_name, ...userResponse } = createdUser;
  const fullName = `${first_name || ''} ${last_name || ''}`.trim();

  res.status(201).json({
    ...userResponse,
    name: fullName,
    first_name,
    last_name
  });
}));

// User Login - POST /login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await DatabaseService.getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user.id.toString(), user.email, user.role);

  // Get user's farm if they have one
  let farm_id = null;
  try {
    const userFarm = await DatabaseService.getFarmByOwnerId(user.id);
    if (userFarm) {
      farm_id = userFarm.id;
    }
  } catch (error) {
    console.log('Error fetching user farm:', error);
    // Continue without farm_id if there's an error
  }

  // Remove password_hash from response and add name field for frontend compatibility
  const { password_hash, first_name, last_name, ...userResponse } = user;
  const fullName = `${first_name || ''} ${last_name || ''}`.trim();

  res.json({ 
    token, 
    user: {
      ...userResponse,
      name: fullName,
      first_name,
      last_name,
      farm_id
    }
  });
}));

// User Logout - POST /logout
router.post('/logout', (req, res) => {
  // On the client-side, the token should be discarded.
  // Server-side logout for JWT is typically handled by token expiration.
  res.json({ message: 'Logout successful' });
});

// Redirect create-farm requests to proper endpoint
router.post('/create-farm', (req, res) => {
  res.status(301).json({
    error: 'Endpoint moved',
    message: 'The create-farm endpoint has been moved to /api/farms/create-farm or /farms/create-farm',
    correct_endpoints: [
      '/api/farms/create-farm',
      '/farms/create-farm'
    ],
    request_body: req.body
  });
});

// TEMPORARY: Create admin user for development
router.post('/create-admin-dev', asyncHandler(async (req, res) => {
  // Only allow in development environment
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Admin creation not allowed in production' });
  }

  const { email = 'admin@farmfreshbd.com', password = 'admin123', name = 'System Administrator' } = req.body;

  // Check if admin already exists
  const existingAdmin = await DatabaseService.getUserByEmail(email);
  if (existingAdmin) {
    return res.status(409).json({ error: 'Admin user already exists', admin: { email: existingAdmin.email, role: existingAdmin.role } });
  }

  const hashedPassword = await hashPassword(password);

  const adminData = {
    first_name: 'System',
    last_name: 'Administrator',
    email: email,
    password_hash: hashedPassword,
    role: 'admin',
    is_active: true,
    email_verified: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  const adminUser = await DatabaseService.createUser(adminData);

  res.status(201).json({
    message: 'Admin user created successfully',
    admin: {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      name: `${adminUser.first_name} ${adminUser.last_name}`
    }
  });
}));

// TEMPORARY: Reset admin password for development
router.post('/reset-admin-password-dev', asyncHandler(async (req, res) => {
  // Only allow in development environment
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Password reset not allowed in production' });
  }

  const { email = 'admin@farmfreshbd.com', password = 'admin123' } = req.body;

  // Check if admin exists
  const existingAdmin = await DatabaseService.getUserByEmail(email);
  if (!existingAdmin) {
    return res.status(404).json({ error: 'Admin user not found' });
  }

  if (existingAdmin.role !== 'admin') {
    return res.status(403).json({ error: 'User is not an admin' });
  }

  const hashedPassword = await hashPassword(password);

  // Update password
  await DatabaseService.updateUser(existingAdmin.id, {
    password_hash: hashedPassword,
    updated_at: new Date()
  });

  res.json({
    message: 'Admin password reset successfully',
    admin: {
      id: existingAdmin.id,
      email: existingAdmin.email,
      role: existingAdmin.role
    }
  });
}));

// Temporary endpoint to run expense types migration (development only)
router.post('/run-expense-types-migration-dev', asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Migration endpoint not available in production' });
  }

  const { query } = require('../src/config/database');

  try {
    console.log('🔧 Running expense types migration via API...');
    
    // Step 1: Check if new columns already exist
    const columnsCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'expense_types' 
      AND column_name IN ('is_default', 'is_global', 'created_by', 'updated_at')
    `);
    
    const existingColumns = columnsCheck.rows.map(row => row.column_name);
    console.log('Existing new columns:', existingColumns);
    
    // Step 2: Add new columns if they don't exist
    if (!existingColumns.includes('is_default')) {
      await query('ALTER TABLE expense_types ADD COLUMN is_default BOOLEAN DEFAULT false');
      console.log('✅ Added is_default column');
    }
    
    if (!existingColumns.includes('is_global')) {
      await query('ALTER TABLE expense_types ADD COLUMN is_global BOOLEAN DEFAULT true');
      console.log('✅ Added is_global column');
    }
    
    if (!existingColumns.includes('created_by')) {
      await query('ALTER TABLE expense_types ADD COLUMN created_by INTEGER REFERENCES users(id)');
      console.log('✅ Added created_by column');
    }
    
    if (!existingColumns.includes('updated_at')) {
      await query('ALTER TABLE expense_types ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      console.log('✅ Added updated_at column');
    }
    
    // Step 3: Check if category column exists and has constraints
    const categoryCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'expense_types' AND column_name = 'category'
    `);
    
    if (categoryCheck.rows.length > 0) {
      // Step 4: Drop the view that depends on category column
      try {
        await query('DROP VIEW IF EXISTS farm_expenses_summary');
        console.log('✅ Dropped farm_expenses_summary view');
      } catch (e) {
        console.log('ℹ️ No farm_expenses_summary view to drop');
      }
      
      // Step 5: Drop constraints on category column
      try {
        await query(`
          ALTER TABLE expense_types 
          DROP CONSTRAINT IF EXISTS expense_types_category_check
        `);
        console.log('✅ Dropped category check constraint');
      } catch (e) {
        console.log('ℹ️ No category check constraint to drop');
      }
      
      // Step 6: Now drop the category column
      await query('ALTER TABLE expense_types DROP COLUMN category');
      console.log('✅ Dropped category column');
      
      // Step 7: Recreate the view without category column
      await query(`
        CREATE VIEW farm_expenses_summary AS
        SELECT 
          f.id AS farm_id,
          f.name AS farm_name,
          et.name AS expense_type_name,
          date_trunc('month', e.expense_date::timestamp with time zone) AS month,
          count(e.id) AS total_expenses,
          sum(e.amount) AS total_amount
        FROM farms f
        LEFT JOIN expenses e ON f.id = e.farm_id
        LEFT JOIN expense_types et ON e.expense_type_id = et.id
        GROUP BY f.id, f.name, et.name, date_trunc('month', e.expense_date::timestamp with time zone)
      `);
      console.log('✅ Recreated farm_expenses_summary view without category');
    }
    
    // Step 6: Clear existing data and insert default expense types
    await query('DELETE FROM expense_types');
    console.log('✅ Cleared existing expense types');
    
    await query(`
      INSERT INTO expense_types (name, description, is_default, is_global) VALUES
      ('Feed', 'Animal feed and nutrition costs', true, true),
      ('Medicine', 'Veterinary medicines and treatments', true, true),
      ('Vaccine', 'Vaccination and immunization costs', true, true),
      ('Other', 'Other miscellaneous expenses', true, true)
    `);
    console.log('✅ Inserted default expense types');
    
    // Step 7: Verify the results
    const result = await query('SELECT * FROM expense_types ORDER BY name');
    
    res.json({
      message: 'Expense types migration completed successfully',
      expenseTypesCount: result.rows.length,
      expenseTypes: result.rows.map(type => ({
        id: type.id,
        name: type.name,
        description: type.description,
        is_default: type.is_default,
        is_global: type.is_global
      }))
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({ 
      error: 'Migration failed', 
      message: error.message,
      stack: error.stack 
    });
  }
}));

// Debug endpoint to check category column dependencies
router.get('/debug-category-deps-dev', asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Debug endpoint not available in production' });
  }

  const { query } = require('../src/config/database');

  try {
    // Check constraints
    const constraints = await query(`
      SELECT 
        tc.constraint_name, 
        tc.constraint_type,
        kcu.column_name,
        tc.table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'expense_types' 
        AND kcu.column_name = 'category'
    `);

    // Check views that might depend on it
    const views = await query(`
      SELECT 
        schemaname,
        viewname,
        definition
      FROM pg_views 
      WHERE definition ILIKE '%expense_types%' 
        AND definition ILIKE '%category%'
    `);

    // Check functions/procedures
    const functions = await query(`
      SELECT 
        routine_name,
        routine_definition
      FROM information_schema.routines 
      WHERE routine_definition ILIKE '%expense_types%' 
        AND routine_definition ILIKE '%category%'
    `);

    res.json({
      constraints: constraints.rows,
      views: views.rows,
      functions: functions.rows
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Debug failed', 
      message: error.message 
    });
  }
}));

module.exports = router;