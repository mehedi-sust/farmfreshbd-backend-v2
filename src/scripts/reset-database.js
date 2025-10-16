/**
 * PostgreSQL Database Reset Script
 *
 * Drops and recreates the public schema, then re-initializes base tables.
 * Use with caution — this deletes ALL data.
 */
require('dotenv').config();
const { connectToDatabase, query, closePool, initializeSchema } = require('../config/database');

async function resetDatabase() {
  console.log('🔄 Starting PostgreSQL database reset...');
  console.log('⚠️ WARNING: This will delete ALL data in the database!');

  try {
    await connectToDatabase();
    console.log('✅ Connected to PostgreSQL');

    // Drop and recreate public schema
    console.log('🗑️ Dropping public schema...');
    await query('DROP SCHEMA IF EXISTS public CASCADE;');
    console.log('🧱 Recreating public schema...');
    await query('CREATE SCHEMA public;');
    console.log('✅ Schema reset complete');

    // Re-initialize base schema from SQL files
    console.log('📦 Re-initializing base schema...');
    await initializeSchema();
    console.log('🎉 Base schema re-initialized');
  } catch (error) {
    console.error('❌ Error resetting database:', error?.message || error);
    process.exitCode = 1;
  } finally {
    await closePool();
    console.log('🔌 PostgreSQL connection closed');
  }
}

// Run the reset function
resetDatabase();