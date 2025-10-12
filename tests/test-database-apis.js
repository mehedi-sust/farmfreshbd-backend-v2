const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:3001/api';

// Test data
const testUser = {
  email: 'testfarmer@example.com',
  password: 'password123',
  name: 'Test Farmer',
  phone: '1234567890',
  address: 'Test Address',
  role: 'farm_manager'
};

let authToken = '';
let farmId = '';

async function testDatabaseAPIs() {
  console.log('🧪 Testing Database Management APIs...\n');

  try {
    // 1. Register/Login user
    console.log('1️⃣ Setting up test user...');
    try {
      await axios.post(`${BASE_URL}/auth/register`, testUser);
      console.log('✅ User registered');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('ℹ️ User already exists, proceeding with login');
      } else {
        throw error;
      }
    }

    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    authToken = loginResponse.data.token;
    console.log('✅ User logged in');

    // 2. Create a farm
    console.log('\n2️⃣ Creating test farm...');
    const farmResponse = await axios.post(`${BASE_URL}/farms`, {
      name: 'Test Farm for Database APIs',
      location: 'Test Location',
      size: 100,
      description: 'Test farm for database management'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    farmId = farmResponse.data._id;
    console.log(`✅ Farm created with ID: ${farmId}`);

    // 3. Add some test data
    console.log('\n3️⃣ Adding test data...');
    
    // Add products
    await axios.post(`${BASE_URL}/products`, {
      farm_id: farmId,
      name: 'Test Tomatoes',
      type: 'vegetables',
      quantity: 100,
      unit_price: 50,
      unit: 'kg'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    // Add expenses
    await axios.post(`${BASE_URL}/expenses`, {
      farm_id: farmId,
      type: 'Seeds',
      description: 'Tomato seeds',
      amount: 1000,
      date: new Date().toISOString()
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    // Add investments
    await axios.post(`${BASE_URL}/investments`, {
      farm_id: farmId,
      type: 'Infrastructure',
      description: 'Greenhouse',
      amount: 50000,
      date: new Date().toISOString()
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    console.log('✅ Test data added (products, expenses, investments)');

    // 4. Test database stats
    console.log('\n4️⃣ Testing database stats...');
    const statsResponse = await axios.get(`${BASE_URL}/farms/${farmId}/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('📊 Database Stats:', statsResponse.data.stats);
    console.log(`📈 Total Records: ${statsResponse.data.total_records}`);

    // 5. Test database export
    console.log('\n5️⃣ Testing database export...');
    const exportResponse = await axios.get(`${BASE_URL}/farms/${farmId}/export`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (!exportResponse.data.success) {
      throw new Error('Export failed: ' + exportResponse.data.error);
    }
    
    console.log('✅ Database exported successfully');
    console.log('📊 Export Stats:', exportResponse.data.stats);
    
    // Validate export data structure
    const exportData = exportResponse.data.data;
    if (!exportData.metadata || !exportData.metadata.farm_id) {
      throw new Error('Invalid export data structure');
    }
    
    console.log('✅ Export data structure validated');
    console.log('📋 Export metadata:', exportData.metadata);
    
    // Save export data to file for testing import
    fs.writeFileSync('test-export.json', JSON.stringify(exportData, null, 2));
    console.log('💾 Export data saved to test-export.json');

    // 6. Test remove all data
    console.log('\n6️⃣ Testing remove all data...');
    const removeResponse = await axios.delete(`${BASE_URL}/farms/${farmId}/remove-all-data`, {
      data: {
        confirmation: 'DELETE_ALL_DATA'
      },
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ All data removed successfully');
    console.log('📊 Deletion Stats:', removeResponse.data.stats);

    // 7. Verify data is removed
    console.log('\n7️⃣ Verifying data removal...');
    const statsAfterRemoval = await axios.get(`${BASE_URL}/farms/${farmId}/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('📊 Stats after removal:', statsAfterRemoval.data.stats);
    const totalAfterRemoval = statsAfterRemoval.data.total_records;
    
    if (totalAfterRemoval === 0) {
      console.log('✅ Data removal verified - all records deleted');
    } else {
      console.log(`⚠️ Warning: ${totalAfterRemoval} records still exist`);
    }

    // 8. Test database import
    console.log('\n8️⃣ Testing database import...');
    
    // Read the export data from file to simulate real usage
    const importData = JSON.parse(fs.readFileSync('test-export.json', 'utf8'));
    
    const importResponse = await axios.post(`${BASE_URL}/farms/${farmId}/import`, {
      data: importData,
      replace_existing: true
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (!importResponse.data.success) {
      throw new Error('Import failed: ' + importResponse.data.error);
    }
    
    console.log('✅ Database imported successfully');
    console.log('📊 Import Stats:', importResponse.data.stats);
    console.log('📈 Total Imported:', importResponse.data.total_imported);

    // 9. Verify import worked
    console.log('\n9️⃣ Verifying import...');
    const statsAfterImport = await axios.get(`${BASE_URL}/farms/${farmId}/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('📊 Stats after import:', statsAfterImport.data.stats);
    const totalAfterImport = statsAfterImport.data.total_records;
    
    if (totalAfterImport > 0) {
      console.log('✅ Import verified - data restored successfully');
    } else {
      console.log('❌ Import failed - no data found');
    }

    // 10. Test ROI calculation
    console.log('\n🔟 Testing updated ROI calculation...');
    const roiStatsResponse = await axios.get(`${BASE_URL}/stats/farm/${farmId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const stats = roiStatsResponse.data;
    console.log('\n📊 Updated Farm Statistics:');
    console.log(`   Total Investments: ৳${stats.total_investments.toFixed(2)}`);
    console.log(`   Sales Profit: ৳${stats.total_profit.toFixed(2)}`);
    console.log(`   Farm's Gross Profit: ৳${stats.gross_profit.toFixed(2)}`);
    console.log(`   ROI: ${stats.roi.toFixed(2)}%`);
    
    if (stats.roi < 0) {
      console.log('✅ ROI is negative as expected (showing loss)');
    } else {
      console.log('ℹ️ ROI is positive (showing profit)');
    }

    console.log('\n🎉 All database management tests completed successfully!');
    
    // Cleanup
    try {
      fs.unlinkSync('test-export.json');
      console.log('🧹 Cleanup: Removed test export file');
    } catch (error) {
      // File might not exist, ignore
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
testDatabaseAPIs();