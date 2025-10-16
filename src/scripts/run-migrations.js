require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, connectToDatabase, closePool } = require('../config/database');

async function runMigrations() {
  try {
    await connectToDatabase();
    const migrationsDir = path.join(__dirname, '../../database/migrations');

    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found, skipping.');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found, skipping.');
      return;
    }

    console.log('Applying migrations:');
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`\n▶ Running migration: ${file}`);
      try {
        await query(sql);
        console.log(`✅ Applied: ${file}`);
      } catch (err) {
        console.warn(`⚠️  Migration skipped due to error: ${file}`);
        console.warn(`   Reason: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

runMigrations();