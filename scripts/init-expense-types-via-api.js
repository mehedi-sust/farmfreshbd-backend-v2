const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function initExpenseTypesViaAPI() {
  try {
    console.log('🔧 Initializing expense types via API...');
    
    // First, login to get a token (using admin credentials)
    console.log('🔑 Logging in as admin...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@farmfreshbd.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Check current expense types
    console.log('📋 Checking current expense types...');
    const currentResponse = await axios.get(`${BASE_URL}/api/expense_types`, { headers });
    console.log(`Current expense types count: ${currentResponse.data.length}`);
    
    if (currentResponse.data.length > 0) {
      console.log('Existing expense types:');
      currentResponse.data.forEach(type => {
        console.log(`  - ${type.name}: ${type.description}`);
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
        const existing = currentResponse.data.find(type => type.name === expenseType.name);
        
        if (existing) {
          console.log(`⏭️  Expense type '${expenseType.name}' already exists, skipping...`);
          continue;
        }
        
        // Create new expense type
        const createResponse = await axios.post(`${BASE_URL}/api/expense_types`, {
          name: expenseType.name,
          description: expenseType.description,
          is_default: true,
          is_global: true
        }, { headers });
        
        console.log(`✅ Added expense type: ${createResponse.data.name} (ID: ${createResponse.data.id})`);
        
      } catch (error) {
        if (error.response) {
          console.error(`❌ Error adding expense type '${expenseType.name}':`, error.response.data);
        } else {
          console.error(`❌ Error adding expense type '${expenseType.name}':`, error.message);
        }
      }
    }
    
    // Verify final results
    console.log('\n🔍 Verifying final results...');
    const finalResponse = await axios.get(`${BASE_URL}/api/expense_types`, { headers });
    console.log(`🎉 Final expense types count: ${finalResponse.data.length}`);
    
    if (finalResponse.data.length > 0) {
      finalResponse.data.forEach(type => {
        const defaultStatus = type.is_default ? 'default' : 'custom';
        const globalStatus = type.is_global ? 'global' : 'local';
        console.log(`  - ${type.name}: ${type.description} (${defaultStatus}, ${globalStatus})`);
      });
    }
    
  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', error.response.status, error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
    throw error;
  }
}

// Run the script
initExpenseTypesViaAPI()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed');
    process.exit(1);
  });