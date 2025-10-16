const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/farmfreshbd'
});

async function fixExpenseTypesTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing expense_types table...');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Check if category column exists
    const categoryCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'expense_types' AND column_name = 'category'
    `);
    
    if (categoryCheck.rows.length > 0) {
      console.log('📝 Removing category column...');
      await client.query('ALTER TABLE expense_types DROP COLUMN IF EXISTS category');
      console.log('✅ Category column removed');
    }
    
    // Check current table structure
    const structureResult = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'expense_types' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Current table structure:');
    structureResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Clear existing data and insert default expense types
    console.log('🗑️ Clearing existing expense types...');
    await client.query('DELETE FROM expense_types');
    
    console.log('📝 Inserting default expense types...');
    const defaultExpenseTypes = [
      { name: 'Food', description: 'Food and nutrition expenses', is_default: true, is_global: true },
      { name: 'Medicine', description: 'Medical and healthcare expenses', is_default: true, is_global: true },
      { name: 'Vaccine', description: 'Vaccination and immunization expenses', is_default: true, is_global: true },
      { name: 'Other', description: 'Other miscellaneous expenses', is_default: true, is_global: true }
    ];
    
    for (const expenseType of defaultExpenseTypes) {
      await client.query(`
        INSERT INTO expense_types (name, description, is_default, is_global, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, true, NOW(), NOW())
      `, [expenseType.name, expenseType.description, expenseType.is_default, expenseType.is_global]);
      
      console.log(`✅ Added expense type: ${expenseType.name}`);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('🎉 Expense types table fixed successfully!');
    
    // Verify the results
    const verifyResult = await client.query('SELECT * FROM expense_types ORDER BY name');
    console.log(`\n📊 Total expense types: ${verifyResult.rows.length}`);
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.name}: ${row.description} (default: ${row.is_default}, global: ${row.is_global})`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing expense types table:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixExpenseTypesTable().catch(console.error);