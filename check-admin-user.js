const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Database configuration (using same defaults as backend)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'farmfreshbd',
  user: process.env.DB_USER || 'farmfresh_user',
  password: process.env.DB_PASSWORD || 'farmfresh_password',
  ssl: false,
};

async function checkAndCreateAdmin() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔍 Checking for admin user...');
    
    // Check if admin user exists
    const adminCheck = await pool.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      ['admin@farmfreshbd.com']
    );
    
    if (adminCheck.rows.length > 0) {
      console.log('✅ Admin user found:', adminCheck.rows[0]);
      
      // Test password hash
      const user = adminCheck.rows[0];
      const passwordCheck = await pool.query(
        'SELECT password_hash FROM users WHERE email = $1',
        ['admin@farmfreshbd.com']
      );
      
      console.log('🔐 Password hash:', passwordCheck.rows[0].password_hash);
      
      // Try to verify the password
      const isValid = await bcrypt.compare('admin123', passwordCheck.rows[0].password_hash);
      console.log('🔓 Password verification:', isValid ? 'VALID' : 'INVALID');
      
      if (!isValid) {
        console.log('🔧 Updating admin password...');
        const newHash = await bcrypt.hash('admin123', 10);
        await pool.query(
          'UPDATE users SET password_hash = $1 WHERE email = $2',
          [newHash, 'admin@farmfreshbd.com']
        );
        console.log('✅ Admin password updated successfully');
      }
    } else {
      console.log('❌ No admin user found. Creating one...');
      
      // Create admin user
      const passwordHash = await bcrypt.hash('admin123', 10);
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, role, first_name, last_name, is_active, email_verified, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, email, role`,
        ['admin@farmfreshbd.com', passwordHash, 'admin', 'System', 'Administrator', true, true, new Date()]
      );
      
      console.log('✅ Admin user created:', result.rows[0]);
    }
    
    // Final verification
    console.log('\n🧪 Testing login...');
    const finalCheck = await pool.query(
      'SELECT id, email, role, password_hash FROM users WHERE email = $1',
      ['admin@farmfreshbd.com']
    );
    
    if (finalCheck.rows.length > 0) {
      const user = finalCheck.rows[0];
      const isValid = await bcrypt.compare('admin123', user.password_hash);
      console.log('✅ Final verification:', isValid ? 'SUCCESS' : 'FAILED');
      console.log('👤 Admin user details:', {
        id: user.id,
        email: user.email,
        role: user.role
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('❌ Full error:', error);
    console.error('❌ Stack trace:', error.stack);
  } finally {
    try {
      await pool.end();
    } catch (closeError) {
      console.error('❌ Error closing pool:', closeError.message);
    }
  }
}

checkAndCreateAdmin();