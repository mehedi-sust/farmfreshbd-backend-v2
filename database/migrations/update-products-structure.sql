-- Migration: Update products table structure
-- Remove category_id, update product_type enum, add status field

-- Step 1: Add status column
ALTER TABLE products 
ADD COLUMN status VARCHAR(20) DEFAULT 'unsold' 
CHECK (status IN ('sold', 'unsold'));

-- Step 2: Update existing products to have 'unsold' status
UPDATE products SET status = 'unsold' WHERE status IS NULL;

-- Step 3: Drop the foreign key constraint for category_id
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_fkey;

-- Step 4: Remove category_id column
ALTER TABLE products DROP COLUMN IF EXISTS category_id;

-- Step 5: Drop the old product_type constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_product_type_check;

-- Step 6: Add new product_type constraint with expanded enum values
ALTER TABLE products 
ADD CONSTRAINT products_product_type_check 
CHECK (product_type IN ('animal', 'fish', 'crop', 'others', 'produce', 'dairy'));

-- Step 7: Remove base_price column as it's redundant with unit_price
ALTER TABLE products DROP COLUMN IF EXISTS base_price;

-- Step 8: Update the updated_at trigger to include status changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure trigger exists for products table
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Create index on status for better query performance
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_farm_status ON products(farm_id, status);