/**
 * Initialize Default Expense Types
 * 
 * This script initializes the database with default expense types that all farms can use.
 * Default types: Food, Medicine, Vaccine, Other
 * 
 * Features:
 * - Prevents duplicate type names
 * - Creates global expense types (not farm-specific)
 * - Marks types as default (cannot be deleted by users)
 * - Only admin can modify default types
 */

const { connectToDatabase, getCollections } = require('../src/config/database');

const DEFAULT_EXPENSE_TYPES = [
  {
    name: 'Food',
    description: 'Animal feed and food expenses',
    is_default: true,
    is_global: true,
    created_by: 'system',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    name: 'Medicine',
    description: 'Medical treatments and medicines for animals',
    is_default: true,
    is_global: true,
    created_by: 'system',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    name: 'Vaccine',
    description: 'Vaccination and immunization expenses',
    is_default: true,
    is_global: true,
    created_by: 'system',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    name: 'Other',
    description: 'Miscellaneous farm expenses',
    is_default: true,
    is_global: true,
    created_by: 'system',
    created_at: new Date(),
    updated_at: new Date()
  }
];

async function initializeExpenseTypes() {
  try {
    console.log('🚀 Starting expense types initialization...');
    
    const { db } = await connectToDatabase();
    const { expense_types } = await getCollections(db);

    console.log('📊 Checking existing expense types...');
    
    let createdCount = 0;
    let skippedCount = 0;

    for (const expenseType of DEFAULT_EXPENSE_TYPES) {
      // Check if expense type already exists (case-insensitive)
      const existingType = await expense_types.findOne({
        name: { $regex: new RegExp(`^${expenseType.name}$`, 'i') }
      });

      if (existingType) {
        console.log(`⏭️  Skipping '${expenseType.name}' - already exists`);
        skippedCount++;
        continue;
      }

      // Create the expense type
      const result = await expense_types.insertOne(expenseType);
      console.log(`✅ Created expense type: '${expenseType.name}' (ID: ${result.insertedId})`);
      createdCount++;
    }

    console.log('\n📈 Initialization Summary:');
    console.log(`   ✅ Created: ${createdCount} expense types`);
    console.log(`   ⏭️  Skipped: ${skippedCount} expense types (already exist)`);
    console.log(`   📊 Total default types: ${DEFAULT_EXPENSE_TYPES.length}`);

    // Verify all default types exist
    const allDefaultTypes = await expense_types.find({ is_default: true }).toArray();
    console.log(`\n🔍 Verification: Found ${allDefaultTypes.length} default expense types in database`);
    
    allDefaultTypes.forEach(type => {
      console.log(`   - ${type.name}: ${type.description}`);
    });

    console.log('\n🎉 Expense types initialization completed successfully!');
    
    return {
      success: true,
      created: createdCount,
      skipped: skippedCount,
      total: DEFAULT_EXPENSE_TYPES.length
    };

  } catch (error) {
    console.error('❌ Error initializing expense types:', error);
    throw error;
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  initializeExpenseTypes()
    .then((result) => {
      console.log('\n✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { initializeExpenseTypes, DEFAULT_EXPENSE_TYPES };