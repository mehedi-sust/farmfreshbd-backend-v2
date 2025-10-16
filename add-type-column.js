// Migration script to add type column to farms table
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/farmfreshbd'
});

async function addTypeColumn() {
  try {
    console.log('🔄 Adding type column to farms table...');
    
    // Check if column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'farms' AND column_name = 'type'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ Type column already exists');
      return;
    }
    
    // Add the type column
    await pool.query(`
      ALTER TABLE farms 
      ADD COLUMN type VARCHAR(50) DEFAULT 'mixed'
    `);
    
    console.log('✅ Type column added successfully');
    
    // Update existing farms to have a default type
    const updateResult = await pool.query(`
      UPDATE farms 
      SET type = 'mixed' 
      WHERE type IS NULL
    `);
    
    console.log(`✅ Updated ${updateResult.rowCount} existing farms with default type`);
    
  } catch (error) {
    console.error('❌ Error adding type column:', error);
  } finally {
    await pool.end();
  }
}

addTypeColumn();