require('dotenv').config();
const { query, closePool, connectToDatabase } = require('../config/database');

async function checkSalesProfitColumn() {
  try {
    await connectToDatabase();
    const result = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'profit'
    `);
    if (result.rows.length > 0) {
      console.log('✅ sales.profit column exists');
    } else {
      console.log('❌ sales.profit column missing');
    }
  } catch (err) {
    console.error('Check error:', err.message);
  } finally {
    await closePool();
  }
}

checkSalesProfitColumn();