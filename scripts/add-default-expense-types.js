const { query } = require('../src/config/database');

async function addDefaultExpenseTypes() {
  try {
    console.log('🔧 Adding default expense types...');
    
    // Check current table structure first
    const structureResult = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'expense_types' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Current table structure:');
    structureResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Check existing expense types
    const existingResult = await query('SELECT * FROM expense_types');
    console.log(`\n📊 Current expense types count: ${existingResult.rows.length}`);
    
    if (existingResult.rows.length > 0) {
      console.log('Existing expense types:');
      existingResult.rows.forEach(row => {
        console.log(`  - ${row.name}: ${row.description}`);
      });
    }
    
    // Define default expense types
    const defaultExpenseTypes = [
      { name: 'Food', description: 'Food and nutrition expenses' },
      { name: 'Medicine', description: 'Medical and healthcare expenses' },
      { name: 'Vaccine', description: 'Vaccination and immunization expenses' },
      { name: 'Other', description: 'Other miscellaneous expenses' }
    ];
    
    console.log('\n📝 Adding default expense types...');
    
    for (const expenseType of defaultExpenseTypes) {
      try {
        // Check if expense type already exists
        const existingCheck = await query(
          'SELECT id FROM expense_types WHERE name = $1',
          [expenseType.name]
        );
        
        if (existingCheck.rows.length > 0) {
          console.log(`⏭️  Expense type '${expenseType.name}' already exists, skipping...`);
          continue;
        }
        
        // Insert new expense type
        const result = await query(`
          INSERT INTO expense_types (name, description, is_default, is_global, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          RETURNING id, name
        `, [expenseType.name, expenseType.description, true, true, true]);
        
        console.log(`✅ Added expense type: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
        
      } catch (error) {
        console.error(`❌ Error adding expense type '${expenseType.name}':`, error.message);
      }
    }
    
    // Verify final results
    const finalResult = await query('SELECT * FROM expense_types ORDER BY name');
    console.log(`\n🎉 Final expense types count: ${finalResult.rows.length}`);
    finalResult.rows.forEach(row => {
      const defaultStatus = row.is_default ? 'default' : 'custom';
      const globalStatus = row.is_global ? 'global' : 'local';
      console.log(`  - ${row.name}: ${row.description} (${defaultStatus}, ${globalStatus})`);
    });
    
  } catch (error) {
    console.error('❌ Error in addDefaultExpenseTypes:', error.message);
    throw error;
  }
}

// Run the script
addDefaultExpenseTypes()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });