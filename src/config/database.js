const { Pool } = require('pg');

let pool = null;
let hasLoggedConnected = false; // throttle noisy connection logs
let hasLoggedTestSuccess = false; // throttle testConnection success logs

/**
 * Create PostgreSQL connection pool
 * Supports both connection string and individual parameters
 */
function createPool() {
  if (pool) {
    return pool;
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Use test database for testing environment
  const isTest = nodeEnv === 'test';
  const connectionString = isTest ? process.env.DATABASE_TEST_URL : process.env.DATABASE_URL;
  
  let poolConfig;
  
  if (connectionString) {
    // Use connection string if available
    poolConfig = {
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  } else {
    // Use individual parameters
    poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: isTest ? (process.env.DB_TEST_NAME || 'farmfreshbd_test') : (process.env.DB_NAME || 'farmfreshbd'),
      user: process.env.DB_USER || 'farmfresh_user',
      password: process.env.DB_PASSWORD || 'farmfresh_password',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  }

  // Pool configuration
  poolConfig.max = 20; // Maximum number of clients in the pool
  poolConfig.min = 2;  // Minimum number of clients in the pool
  poolConfig.idleTimeoutMillis = 30000; // Close idle clients after 30 seconds
  poolConfig.connectionTimeoutMillis = 10000; // Return an error after 10 seconds if connection could not be established

  pool = new Pool(poolConfig);

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
  });

  console.log('🔌 PostgreSQL connection pool created');
  console.log(`📦 Database: ${poolConfig.database || 'from connection string'}`);
  console.log(`🌍 Environment: ${nodeEnv}`);

  return pool;
}

/**
 * Connect to PostgreSQL database
 * Returns the connection pool for executing queries
 */
async function connectToDatabase() {
  try {
    if (!pool) {
      pool = createPool();
    }

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    // Log once per process to avoid spamming logs on every query
    if (!hasLoggedConnected) {
      console.log('✅ Successfully connected to PostgreSQL!');
      hasLoggedConnected = true;
    }
    return pool;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    throw new Error(`Failed to connect to PostgreSQL: ${error.message}`);
  }
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const pool = await connectToDatabase();
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    if (!hasLoggedTestSuccess) {
      console.log('✅ Database connection test successful');
      hasLoggedTestSuccess = true;
    }
    console.log(`🕐 Current time: ${result.rows[0].current_time}`);
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
}

/**
 * Execute a query with parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params = []) {
  const pool = await connectToDatabase();
  const client = await pool.connect();
  
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('❌ Database query error:', error.message);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a transaction
 * @param {Function} callback - Function that receives the client and executes queries
 * @returns {Promise<any>} Transaction result
 */
async function transaction(callback) {
  const pool = await connectToDatabase();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Transaction error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the database connection pool
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🔌 PostgreSQL connection pool closed');
  }
}

/**
 * Initialize database schema (for development/testing)
 */
async function initializeSchema() {
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Ensure required extension is available before creating tables
    try {
      await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    } catch (e) {
      console.warn('⚠️  Could not ensure uuid-ossp extension (may already exist or insufficient permissions):', e.message);
    }

    const schemaPath = path.join(__dirname, '../../database/init/01-schema.sql');
    const triggersPath = path.join(__dirname, '../../database/init/02-triggers-and-data.sql');
    
    if (fs.existsSync(schemaPath)) {
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      await query(schemaSQL);
      console.log('✅ Database schema initialized');
    }
    
    if (fs.existsSync(triggersPath)) {
      const triggersSQL = fs.readFileSync(triggersPath, 'utf8');
      await query(triggersSQL);
      console.log('✅ Database triggers and initial data loaded');
    }
  } catch (error) {
    console.error('❌ Schema initialization failed:', error.message);
    throw error;
  }
}

/**
 * Ensure base schema exists when switching to a fresh database.
 * If key tables are missing, run initializeSchema() to create them.
 */
async function ensureBaseSchema() {
  try {
    const res = await query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND table_name IN (
         'users','farms','products','product_categories','product_batches','store_products','orders','order_items','shopping_cart','wishlist','product_reviews','expense_types','investments'
       )`
    );

    const existing = new Set(res.rows.map(r => r.table_name));
    const required = ['users','farms','products','product_categories','product_batches','store_products','orders','order_items','expense_types','investments'];
    const missing = required.filter(t => !existing.has(t));

    if (missing.length > 0) {
      console.log('⚠️  Missing base tables detected:', missing.join(', '));
      console.log('🔧 Running schema initializer to create base tables...');
      await initializeSchema();
    } else {
      console.log('✅ Base schema verified');
    }
  } catch (error) {
    console.error('❌ ensureBaseSchema failed:', error.message);
    throw error;
  }
}

/**
 * Ensure schema upgrades are applied safely at startup
 * - Adds optional discount_description to store_products if missing
 */
async function ensureSchemaUpgrades() {
  try {
    // Farms table optional columns
    const farmsTable = await query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'farms'`
    );

    if (farmsTable.rowCount > 0) {
      const bannerCol = await query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'farms' AND column_name = 'banner_image'`
      );
      if (bannerCol.rowCount === 0) {
        await query(`ALTER TABLE farms ADD COLUMN banner_image TEXT`);
        console.log('✅ Added banner_image column to farms');
      } else {
        console.log('ℹ️ farms.banner_image column already exists');
      }

      const buildYearCol = await query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'farms' AND column_name = 'build_year'`
      );
      if (buildYearCol.rowCount === 0) {
        await query(`ALTER TABLE farms ADD COLUMN build_year VARCHAR(10)`);
        console.log('✅ Added build_year column to farms');
      } else {
        console.log('ℹ️ farms.build_year column already exists');
      }
    } else {
      console.warn('ℹ️ farms table not found. Skipping farms column upgrades.');
    }

    // Guard: if store_products table does not exist yet, skip upgrades
    const tableExists = await query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_products'`
    );

    if (tableExists.rowCount === 0) {
      console.warn('ℹ️ store_products table not found. Skipping column upgrades until base schema is initialized.');
      return;
    }

    // Check if discount_description column exists
    const checkRes = await query(
      `SELECT 1 FROM information_schema.columns 
       WHERE table_name = 'store_products' AND column_name = 'discount_description'`
    );

    if (checkRes.rowCount === 0) {
      await query(`ALTER TABLE store_products ADD COLUMN discount_description TEXT`);
      console.log('✅ Added discount_description column to store_products');
    } else {
      console.log('ℹ️ discount_description column already exists');
    }

    // Check if product_image_url column exists
    const imgCheckRes = await query(
      `SELECT 1 FROM information_schema.columns 
       WHERE table_name = 'store_products' AND column_name = 'product_image_url'`
    );

    if (imgCheckRes.rowCount === 0) {
      await query(`ALTER TABLE store_products ADD COLUMN product_image_url TEXT`);
      console.log('✅ Added product_image_url column to store_products');
    } else {
      console.log('ℹ️ product_image_url column already exists');
    }

    // Check if description column exists (store-level override)
    const descCheckRes = await query(
      `SELECT 1 FROM information_schema.columns 
       WHERE table_name = 'store_products' AND column_name = 'description'`
    );

    if (descCheckRes.rowCount === 0) {
      await query(`ALTER TABLE store_products ADD COLUMN description TEXT`);
      console.log('✅ Added description column to store_products');
    } else {
      console.log('ℹ️ description column already exists');
    }

    // Products table: ensure 'status' column for sold/unsold tracking
    const productsTable = await query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products'`
    );

    if (productsTable.rowCount > 0) {
      const statusCol = await query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'status'`
      );

      if (statusCol.rowCount === 0) {
        await query(`ALTER TABLE products ADD COLUMN status VARCHAR(20) DEFAULT 'unsold'`);
        console.log("✅ Added status column to products (default 'unsold')");
      } else {
        console.log('ℹ️ products.status column already exists');
      }
    } else {
      console.warn('ℹ️ products table not found. Skipping products column upgrades.');
    }

    // Sales table: ensure 'profit' column exists for reporting
    const salesTable = await query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales'`
    );

    if (salesTable.rowCount > 0) {
      const profitCol = await query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'profit'`
      );

      if (profitCol.rowCount === 0) {
        await query(`ALTER TABLE sales ADD COLUMN profit DECIMAL(10,2) DEFAULT 0`);
        console.log('✅ Added profit column to sales (default 0)');
      } else {
        console.log('ℹ️ sales.profit column already exists');
      }
    } else {
      console.warn('ℹ️ sales table not found. Skipping sales column upgrades.');
    }

    // Expenses table: ensure optional batch_id column exists for linking to batch_names
    const expensesTable = await query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses'`
    );

    if (expensesTable.rowCount > 0) {
      const batchIdCol = await query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'batch_id'`
      );

      if (batchIdCol.rowCount === 0) {
        // Add nullable batch_id column with FK to batch_names
        await query(`ALTER TABLE expenses ADD COLUMN batch_id UUID`);
        await query(`ALTER TABLE expenses ADD CONSTRAINT fk_expenses_batch_id FOREIGN KEY (batch_id) REFERENCES batch_names(id) ON DELETE SET NULL`);
        console.log('✅ Added batch_id column to expenses and linked to batch_names');
      } else {
        console.log('ℹ️ expenses.batch_id column already exists');
      }
    } else {
      console.warn('ℹ️ expenses table not found. Skipping expenses column upgrades.');
    }
  } catch (error) {
    console.error('❌ ensureSchemaUpgrades failed:', error.message);
    // Do not crash startup; log and continue
  }
}

module.exports = { 
  connectToDatabase, 
  testConnection, 
  query, 
  transaction, 
  closePool,
  initializeSchema,
  ensureBaseSchema,
  ensureSchemaUpgrades
};
