-- Migration to add quantity, total_price, unit_price, batch_name, and product_type to products table
-- Run this script to update existing database

-- Add new columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS quantity DECIMAL(10,2) DEFAULT 1 CHECK (quantity >= 0),
ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2) DEFAULT 0 CHECK (total_price >= 0),
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2) DEFAULT 0 CHECK (unit_price >= 0),
ADD COLUMN IF NOT EXISTS batch_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS product_type VARCHAR(50) DEFAULT 'other' CHECK (product_type IN ('animal', 'produce', 'dairy', 'other'));

-- Update existing products to have valid values
UPDATE products 
SET 
    quantity = 1,
    total_price = base_price,
    unit_price = base_price,
    product_type = 'other'
WHERE quantity IS NULL OR total_price IS NULL OR unit_price IS NULL OR product_type IS NULL;

-- Make the new columns NOT NULL after setting default values
ALTER TABLE products 
ALTER COLUMN quantity SET NOT NULL,
ALTER COLUMN total_price SET NOT NULL,
ALTER COLUMN unit_price SET NOT NULL,
ALTER COLUMN product_type SET NOT NULL;

-- Remove default values after migration
ALTER TABLE products 
ALTER COLUMN quantity DROP DEFAULT,
ALTER COLUMN total_price DROP DEFAULT,
ALTER COLUMN unit_price DROP DEFAULT,
ALTER COLUMN product_type DROP DEFAULT;