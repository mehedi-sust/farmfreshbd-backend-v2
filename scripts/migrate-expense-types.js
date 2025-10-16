require('dotenv').config();
const { Pool } = require('pg');

async function migrateExpenseTypes() {
  let pool;
  
  try {
    console.log('🚀 Starting expense_types table migration...');

    // Create a direct database connection
    const poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'farmfreshbd',
      user: process.env.DB_USER || 'farmfresh_user',
      password: process.env.DB_PASSWORD || 'farmfresh_password',
      ssl: false,
    };

    pool = new Pool(poolConfig);
    
    console.log('🔌 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Connected to database successfully');

    // Check current table structure
    console.log('🔍 Checking current table structure...');
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'expense_types' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Current columns:');
    tableInfo.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Add missing columns one by one
    const columnsToAdd = [
      { name: 'is_default', type: 'BOOLEAN DEFAULT false' },
      { name: 'is_global', type: 'BOOLEAN DEFAULT false' },
      { name: 'created_by', type: 'UUID' },
      { name: 'farm_id', type: 'UUID' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP' }
    ];

    for (const column of columnsToAdd) {
      try {
        console.log(`📝 Adding column: ${column.name}...`);
        await pool.query(`ALTER TABLE expense_types ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`);
        console.log(`✅ Added column: ${column.name}`);
      } catch (error) {
        console.log(`ℹ️  Column ${column.name} might already exist: ${error.message}`);
      }
    }

    // Remove category column if it exists
    try {
      console.log('📝 Removing category column...');
      await pool.query(`ALTER TABLE expense_types DROP COLUMN IF EXISTS category`);
      console.log('✅ Removed category column');
    } catch (error) {
      console.log('ℹ️  Category column already removed or doesn\'t exist');
    }

    // Create trigger for updated_at
    console.log('📝 Creating updated_at trigger...');
    
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_expense_types_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS update_expense_types_updated_at ON expense_types;
      CREATE TRIGGER update_expense_types_updated_at
          BEFORE UPDATE ON expense_types
          FOR EACH ROW
          EXECUTE FUNCTION update_expense_types_updated_at()
    `);
    
    console.log('✅ Created updated_at trigger');

    // Insert default expense types
    console.log('📝 Inserting default expense types...');
    
    const defaultTypes = [
      { name: 'Food', description: 'Animal feed and nutrition expenses' },
      { name: 'Medicine', description: 'Veterinary medicines and treatments' },
      { name: 'Vaccine', description: 'Vaccination and immunization costs' },
      { name: 'Other', description: 'Miscellaneous farm expenses' }
    ];

    for (const type of defaultTypes) {
      try {
        const result = await pool.query(`
          INSERT INTO expense_types (name, description, is_default, is_global, created_by) 
          VALUES ($1, $2, true, true, NULL)
          ON CONFLICT (name) DO NOTHING
          RETURNING id
        `, [type.name, type.description]);
        
        if (result.rows.length > 0) {
          console.log(`✅ Added default expense type: ${type.name}`);
        } else {
          console.log(`ℹ️  Expense type '${type.name}' already exists`);
        }
      } catch (error) {
        console.log(`❌ Error adding expense type '${type.name}': ${error.message}`);
      }
    }

    // Verify the migration
    console.log('🔍 Verifying migration...');
    const result = await pool.query('SELECT * FROM expense_types ORDER BY name');
    console.log(`✅ Found ${result.rows.length} expense types in database:`);
    result.rows.forEach(type => {
      console.log(`   - ${type.name}: ${type.description} (default: ${type.is_default}, global: ${type.is_global})`);
    });

    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the migration
if (require.main === module) {
  migrateExpenseTypes();
}

module.exports = { migrateExpenseTypes };