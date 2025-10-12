const { connectToDatabase, getCollections } = require('../config/database');
const { hashPassword } = require('../config/auth');

async function initializeAdmin() {
  try {
    console.log('🔧 Initializing admin user...');
    
    const { db } = await connectToDatabase();
    const { users } = getCollections(db);

    const adminEmail = 'admin@uniqitapps.com';
    const adminPassword = 'admin1234';

    // Check if admin already exists
    const existingAdmin = await users.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('✅ Admin user already exists:', adminEmail);
      return;
    }

    // Hash the password
    const hashedPassword = await hashPassword(adminPassword);

    // Create admin user
    const adminUser = {
      email: adminEmail,
      hashed_password: hashedPassword,
      role: 'admin',
      farm_id: null,
      is_main_manager: false,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await users.insertOne(adminUser);
    console.log('✅ Admin user created successfully:', adminEmail);
    console.log('   User ID:', result.insertedId.toString());
    console.log('   Default password: admin1234');
    console.log('   ⚠️  Please change the default password after first login');

  } catch (error) {
    console.error('❌ Error initializing admin user:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initializeAdmin()
    .then(() => {
      console.log('🎉 Admin initialization completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Admin initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeAdmin };