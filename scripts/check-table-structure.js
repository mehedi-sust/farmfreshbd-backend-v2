const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/farmfreshbd'
});

async function checkTable() {
  try {
    console.log('🔍 Checking expense_types table structure...');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'expense_types' 
      ORDER BY ordinal_position;
    `);
    
    console.log('Current expense_types table structure:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
    });
    
    // Also check existing data
    const dataResult = await pool.query('SELECT COUNT(*) as count FROM expense_types');
    console.log(`\nTotal expense types in database: ${dataResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTable();