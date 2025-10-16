const axios = require('axios');

const BACKEND_URL = 'http://localhost:8000';

async function loginAsAdmin() {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'admin@farmfreshbd.com',
      password: 'admin123'
    });
    
    console.log('✅ Logged in as admin');
    return response.data.token;
  } catch (error) {
    console.error('❌ Failed to login:', error.response?.data || error.message);
    throw error;
  }
}

async function getExpenseTypes(token) {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/expense_types`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get expense types:', error.response?.data || error.message);
    throw error;
  }
}

async function deleteExpenseType(id, token) {
  try {
    const response = await axios.delete(`${BACKEND_URL}/api/expense_types/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Expense type deleted successfully');
    return response.data;
  } catch (error) {
    console.error('❌ Failed to delete expense type:', error.response?.data || error.message);
    throw error;
  }
}

async function removeTestType() {
  try {
    console.log('🚀 Starting Test Type removal...');
    
    // Login as admin
    const token = await loginAsAdmin();
    
    // Get all expense types
    console.log('📋 Fetching expense types...');
    const expenseTypes = await getExpenseTypes(token);
    
    console.log('\nCurrent expense types:');
    expenseTypes.forEach((type, index) => {
      console.log(`${index + 1}. ${type.name} (ID: ${type._id})`);
    });
    
    // Find Test Type (case insensitive)
    const testTypes = expenseTypes.filter(type => 
      type.name.toLowerCase().includes('test')
    );
    
    if (testTypes.length === 0) {
      console.log('\n✅ No "Test Type" entries found to remove.');
      return;
    }
    
    console.log(`\n🎯 Found ${testTypes.length} test type(s) to remove:`);
    testTypes.forEach((type, index) => {
      console.log(`${index + 1}. "${type.name}" (ID: ${type._id})`);
    });
    
    // Delete each test type
    for (const testType of testTypes) {
      console.log(`\n🗑️  Deleting "${testType.name}"...`);
      await deleteExpenseType(testType._id, token);
    }
    
    // Get updated list
    console.log('\n📋 Fetching updated expense types...');
    const updatedTypes = await getExpenseTypes(token);
    
    console.log('\nRemaining expense types:');
    if (updatedTypes.length === 0) {
      console.log('   (No expense types remaining)');
    } else {
      updatedTypes.forEach((type, index) => {
        console.log(`${index + 1}. ${type.name}`);
      });
    }
    
    console.log('\n✅ Test Type removal completed successfully!');
    
  } catch (error) {
    console.error('💥 Removal failed:', error.message);
    process.exit(1);
  }
}

// Run the removal
if (require.main === module) {
  removeTestType();
}

module.exports = { removeTestType };