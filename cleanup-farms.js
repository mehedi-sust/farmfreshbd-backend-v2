const { Pool } = require('pg');
require('dotenv').config({ path: './farmfreshbd-backend-v2/.env' });

const pool = new Pool({
  user: process.env.DB_USER || 'admin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'farmfreshbd',
  password: process.env.DB_PASSWORD || 'admin123',
  port: process.env.DB_PORT || 15432,
});

async function cleanupFarms() {
  try {
    console.log('🧹 Cleaning up farms with null manager_id...');
    
    // First, show farms with null manager_id
    const selectResult = await pool.query('SELECT id, name, owner_id, manager_id FROM farms WHERE manager_id IS NULL');
    console.log(`📊 Found ${selectResult.rows.length} farms with null manager_id:`);
    selectResult.rows.forEach(farm => {
      console.log(`  - ${farm.name} (ID: ${farm.id}, Owner: ${farm.owner_id})`);
    });
    
    if (selectResult.rows.length > 0) {
      // Delete farms with null manager_id
      const deleteResult = await pool.query('DELETE FROM farms WHERE manager_id IS NULL');
      console.log(`✅ Deleted ${deleteResult.rowCount} farms with null manager_id`);
    } else {
      console.log('✅ No farms with null manager_id found');
    }
    
  } catch (error) {
    console.error('❌ Error cleaning up farms:', error);
  } finally {
    await pool.end();
  }
}

cleanupFarms();