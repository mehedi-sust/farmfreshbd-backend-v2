/**
 * Admin Initialization Script
 * Ensures that exactly one admin user exists in the system
 * This script runs on server startup to initialize the admin account
 */

const { connectToDatabase, getCollections } = require('../config/database');
const { hashPassword } = require('../config/auth');

async function initializeAdmin() {
  try {
    console.log('🔧 Initializing admin account...');
    
    const { db } = await connectToDatabase();
    const { users } = await getCollections(db);

    // Check if any admin users exist
    const existingAdmins = await users.find({ role: 'admin' }).toArray();
    
    if (existingAdmins.length > 1) {
      console.log('⚠️  WARNING: Multiple admin accounts detected!');
      console.log(`   Found ${existingAdmins.length} admin accounts`);
      console.log('   Only one admin account should exist for security reasons');
      
      // Keep only the first admin, remove others
      const adminToKeep = existingAdmins[0];
      const adminsToRemove = existingAdmins.slice(1);
      
      for (const admin of adminsToRemove) {
        await users.deleteOne({ _id: admin._id });
        console.log(`   Removed duplicate admin: ${admin.email}`);
      }
      
      console.log(`✅ Admin cleanup completed. Kept admin: ${adminToKeep.email}`);
      return;
    }
    
    if (existingAdmins.length === 1) {
      console.log(`✅ Admin account already exists: ${existingAdmins[0].email}`);
      return;
    }

    // No admin exists, create default admin
    console.log('📝 No admin account found. Creating default admin...');
    
    const defaultAdminEmail = process.env.ADMIN_EMAIL || 'admin@farmfreshbd.com';
    const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const defaultAdminName = process.env.ADMIN_NAME || 'System Administrator';
    
    // Hash the password
    const hashedPassword = await hashPassword(defaultAdminPassword);
    
    // Create admin user
    const adminDoc = {
      name: defaultAdminName,
      email: defaultAdminEmail,
      password: hashedPassword,
      role: 'admin',
      created_at: new Date(),
      is_default_admin: true
    };

    const result = await users.insertOne(adminDoc);
    
    if (result.insertedId) {
      console.log('✅ Default admin account created successfully!');
      console.log(`   Email: ${defaultAdminEmail}`);
      console.log(`   Password: ${defaultAdminPassword}`);
      console.log('');
      console.log('⚠️  IMPORTANT SECURITY NOTICE:');
      console.log('   Please change the default admin password immediately after first login!');
      console.log('   You can set custom admin credentials using environment variables:');
      console.log('   - ADMIN_EMAIL');
      console.log('   - ADMIN_PASSWORD');
      console.log('   - ADMIN_NAME');
    } else {
      console.error('❌ Failed to create admin account');
    }
    
  } catch (error) {
    console.error('❌ Error initializing admin account:', error.message);
    throw error;
  }
}

// Export for use in server startup
module.exports = { initializeAdmin };

// Allow running this script directly
if (require.main === module) {
  initializeAdmin()
    .then(() => {
      console.log('Admin initialization completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Admin initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeAdmin };