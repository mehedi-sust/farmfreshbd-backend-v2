const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'admin',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'farmfreshbd',
    password: process.env.DB_PASSWORD || 'admin123',
    port: parseInt(process.env.DB_PORT) || 15432,
});

async function checkFarmsTableSchema() {
    try {
        console.log('🔍 Checking farms table schema...');
        
        // Check farms table columns
        const farmsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'farms' 
            ORDER BY ordinal_position;
        `);
        
        if (farmsResult.rows.length === 0) {
            console.log('❌ farms table does not exist');
        } else {
            console.log('✅ farms table columns:');
            farmsResult.rows.forEach(row => {
                console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
            });
        }
        
        // Check users table columns
        console.log('\n🔍 Checking users table schema...');
        const usersResult = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            ORDER BY ordinal_position;
        `);
        
        if (usersResult.rows.length === 0) {
            console.log('❌ users table does not exist');
        } else {
            console.log('✅ users table columns:');
            usersResult.rows.forEach(row => {
                console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
            });
        }
        
        // Also check all tables in the database
        console.log('\n📋 All tables in database:');
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);
        
        tablesResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });
        
    } catch (error) {
        console.error('❌ Error checking schema:', error.message);
        console.error('❌ Full error:', error);
    } finally {
        await pool.end();
    }
}

checkFarmsTableSchema();