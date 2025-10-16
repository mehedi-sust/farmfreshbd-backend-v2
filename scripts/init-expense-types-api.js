const axios = require('axios');

const BACKEND_URL = 'http://localhost:8000';

// Default expense types to initialize
const DEFAULT_EXPENSE_TYPES = [
  {
    name: 'Food',
    description: 'Animal feed and nutrition expenses',
    is_global: true
  },
  {
    name: 'Medicine',
    description: 'Veterinary medicines and treatments',
    is_global: true
  },
  {
    name: 'Vaccine',
    description: 'Vaccination and immunization costs',
    is_global: true
  },
  {
    name: 'Other',
    description: 'Miscellaneous farm expenses',
    is_global: true
  }
];

async function loginAsAdmin() {
  try {
    console.log('🔐 Logging in as admin...');
    const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'admin@farmfreshbd.com',
      password: 'admin123'
    });
    
    if (response.data.token) {
      console.log('✅ Admin login successful');
      return response.data.token;
    } else {
      throw new Error('No token received');
    }
  } catch (error) {
    console.error('❌ Admin login failed:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function createExpenseType(expenseType, token) {
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/expense_types`,
      expenseType,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`✅ Created expense type: ${expenseType.name}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 409) {
      console.log(`⚠️  Expense type '${expenseType.name}' already exists`);
      return null;
    } else {
      console.error(`❌ Failed to create expense type '${expenseType.name}':`);
      console.error('   Status:', error.response?.status);
      console.error('   Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('   Message:', error.message);
      throw error;
    }
  }
}

async function initializeExpenseTypes() {
  try {
    console.log('🚀 Starting expense types initialization via API...');
    
    // Login as admin
    const token = await loginAsAdmin();
    
    // Create each default expense type
    console.log('📝 Creating default expense types...');
    for (const expenseType of DEFAULT_EXPENSE_TYPES) {
      await createExpenseType(expenseType, token);
    }
    
    console.log('✅ Expense types initialization completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Total types to create: ${DEFAULT_EXPENSE_TYPES.length}`);
    console.log('   - Types: Food, Medicine, Vaccine, Other');
    console.log('   - All types are global and available to all farms');
    
  } catch (error) {
    console.error('💥 Initialization failed:', error.message);
    process.exit(1);
  }
}

// Run the initialization
if (require.main === module) {
  initializeExpenseTypes();
}

module.exports = { initializeExpenseTypes };