const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

// Admin credentials (adjust as needed)
const ADMIN_CREDENTIALS = {
  email: 'admin@test.com',
  password: 'admin123'
};

class TestDataCleaner {
  constructor() {
    this.token = null;
  }

  async login() {
    try {
      console.log('🔐 Logging in as admin...');
      const response = await axios.post(`${BASE_URL}/api/auth/login`, ADMIN_CREDENTIALS);
      this.token = response.data.token;
      console.log('✅ Admin login successful');
      return true;
    } catch (error) {
      console.error('❌ Admin login failed:', error.response?.data?.error || error.message);
      return false;
    }
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  async getAllUsers() {
    try {
      const response = await axios.get(`${BASE_URL}/api/admin/users?limit=100`, {
        headers: this.getAuthHeaders()
      });
      return response.data.users || [];
    } catch (error) {
      console.error('❌ Failed to get users:', error.response?.data?.error || error.message);
      return [];
    }
  }

  async getAllFarms() {
    try {
      const response = await axios.get(`${BASE_URL}/api/admin/farms?limit=100`, {
        headers: this.getAuthHeaders()
      });
      return response.data.farms || [];
    } catch (error) {
      console.error('❌ Failed to get farms:', error.response?.data?.error || error.message);
      return [];
    }
  }

  async getAllStoreProducts() {
    try {
      const response = await axios.get(`${BASE_URL}/api/admin/store-products?limit=100`, {
        headers: this.getAuthHeaders()
      });
      return response.data.store_products || [];
    } catch (error) {
      console.error('❌ Failed to get store products:', error.response?.data?.error || error.message);
      return [];
    }
  }

  async deleteUser(userId) {
    try {
      const response = await axios.delete(`${BASE_URL}/api/admin/users/${userId}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to delete user ${userId}:`, error.response?.data?.error || error.message);
      return null;
    }
  }

  async deleteAllFarmData(farmId) {
    try {
      const response = await axios.delete(`${BASE_URL}/api/database/remove-all-data`, {
        headers: this.getAuthHeaders(),
        data: {
          farm_id: farmId,
          confirmation: 'DELETE_ALL_DATA'
        }
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to delete farm data ${farmId}:`, error.response?.data?.error || error.message);
      return null;
    }
  }

  async cleanTestData() {
    console.log('\n🧹 Starting test data cleanup...\n');

    // Get all data first
    const users = await this.getAllUsers();
    const farms = await this.getAllFarms();
    const storeProducts = await this.getAllStoreProducts();

    console.log(`📊 Current data summary:`);
    console.log(`   Users: ${users.length}`);
    console.log(`   Farms: ${farms.length}`);
    console.log(`   Store Products: ${storeProducts.length}\n`);

    // Filter out admin users and system data
    const testUsers = users.filter(user => 
      user.role !== 'admin' && 
      !user.email.includes('admin') &&
      (user.email.includes('test') || user.email.includes('demo') || user.email.includes('dummy'))
    );

    const testFarms = farms.filter(farm => 
      farm.farm_name && (
        farm.farm_name.toLowerCase().includes('test') ||
        farm.farm_name.toLowerCase().includes('demo') ||
        farm.farm_name.toLowerCase().includes('dummy')
      )
    );

    console.log(`🎯 Test data to delete:`);
    console.log(`   Test Users: ${testUsers.length}`);
    console.log(`   Test Farms: ${testFarms.length}\n`);

    // Delete test users (this will also delete their associated data)
    if (testUsers.length > 0) {
      console.log('🗑️  Deleting test users...');
      for (const user of testUsers) {
        console.log(`   Deleting user: ${user.email} (${user.role})`);
        const result = await this.deleteUser(user._id);
        if (result) {
          console.log(`   ✅ Deleted user and associated data`);
        }
      }
    }

    // Delete remaining test farms (if any)
    if (testFarms.length > 0) {
      console.log('\n🗑️  Deleting remaining test farms...');
      for (const farm of testFarms) {
        console.log(`   Deleting farm: ${farm.farm_name}`);
        const result = await this.deleteAllFarmData(farm._id);
        if (result) {
          console.log(`   ✅ Deleted farm data`);
        }
      }
    }

    console.log('\n✨ Test data cleanup completed!');
  }

  async showCurrentData() {
    console.log('\n📊 Current system data:\n');

    const users = await this.getAllUsers();
    const farms = await this.getAllFarms();
    const storeProducts = await this.getAllStoreProducts();

    console.log('👥 Users:');
    users.forEach(user => {
      console.log(`   ${user.email} (${user.role}) - ${user.full_name || 'No name'}`);
    });

    console.log('\n🏡 Farms:');
    farms.forEach(farm => {
      console.log(`   ${farm.farm_name} - ${farm.location || 'No location'}`);
    });

    console.log('\n🛒 Store Products:');
    storeProducts.forEach(product => {
      console.log(`   ${product.name} - $${product.selling_price} (${product.available_stock} ${product.unit})`);
    });

    console.log(`\n📈 Summary: ${users.length} users, ${farms.length} farms, ${storeProducts.length} products\n`);
  }
}

async function main() {
  const cleaner = new TestDataCleaner();

  // Login first
  const loginSuccess = await cleaner.login();
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without admin login');
    process.exit(1);
  }

  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--show') || args.includes('-s')) {
    await cleaner.showCurrentData();
  } else if (args.includes('--clean') || args.includes('-c')) {
    await cleaner.cleanTestData();
  } else {
    console.log(`
🧹 Test Data Cleaner

Usage:
  node delete-test-data.js --show    Show current data
  node delete-test-data.js --clean   Clean test data

Examples:
  node delete-test-data.js -s        Show current data
  node delete-test-data.js -c        Clean test data

Note: This script will only delete users/farms with 'test', 'demo', or 'dummy' in their names.
Admin users are protected and will not be deleted.
`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = TestDataCleaner;