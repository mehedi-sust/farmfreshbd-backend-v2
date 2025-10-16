const fs = require('fs');
const path = require('path');
const { query } = require('./src/config/database');

async function runExpenseTypesMigration() {
  try {
    console.log('🔧 Running expense types migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'database', 'migrations', 'add-expense-types-columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded');
    
    // Execute the migration
    await query(migrationSQL);
    
    console.log('✅ Expense types migration completed successfully!');
    
    // Verify the results
    const result = await query('SELECT * FROM expense_types ORDER BY name');
    console.log(`📊 Found ${result.rows.length} expense types:`);
    result.rows.forEach(type => {
      console.log(`  - ${type.name}: ${type.description} (default: ${type.is_default}, global: ${type.is_global})`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

runExpenseTypesMigration();