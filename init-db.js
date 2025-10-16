const { Pool } = require('pg');

async function createBatchNamesTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:admin123@localhost:15432/farmfreshbd'
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected to database');
    
    // Check if batch_names table exists
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'batch_names'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ batch_names table already exists');
    } else {
      console.log('❌ batch_names table does not exist, creating it...');
      
      // Create only the batch_names table
      const createTableSQL = `
        -- Batch names table (for standalone batch names per farm)
        CREATE TABLE batch_names (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, farm_id)
        );
        
        -- Create index for batch_names
        CREATE INDEX idx_batch_names_farm_id ON batch_names(farm_id);
      `;
      
      await client.query(createTableSQL);
      console.log('✅ batch_names table created successfully');
      
      // Verify the table was created
      const tableCheckAfter = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'batch_names'
      `);
      
      if (tableCheckAfter.rows.length > 0) {
        console.log('✅ batch_names table verified');
      } else {
        console.log('❌ batch_names table verification failed');
      }
    }
    
    // Ensure expenses has batch_id column referencing batch_names
    try {
      const colCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'expenses'
          AND column_name = 'batch_id'
      `);
      if (colCheck.rows.length > 0) {
        console.log('✅ expenses.batch_id column already exists');
      } else {
        console.log('❌ expenses.batch_id column missing, adding it...');
        await client.query(`
          ALTER TABLE expenses
          ADD COLUMN batch_id UUID NULL;
        `);
        // Add FK constraint to batch_names
        await client.query(`
          ALTER TABLE expenses
          ADD CONSTRAINT fk_expenses_batch_id
          FOREIGN KEY (batch_id) REFERENCES batch_names(id)
          ON DELETE SET NULL;
        `);
        console.log('✅ expenses.batch_id column added with foreign key to batch_names');
      }
    } catch (e) {
      console.error('❌ Error ensuring expenses.batch_id column:', e.message);
    }

    // List all tables to confirm
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\nTables in database:');
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    client.release();
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

createBatchNamesTable();