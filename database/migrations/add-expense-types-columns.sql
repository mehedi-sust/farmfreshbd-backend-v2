-- Migration: Add missing columns to expense_types table
-- This migration adds the columns expected by the backend API

-- Add missing columns to expense_types table
ALTER TABLE expense_types 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Remove the category column as it's not used in the new API
ALTER TABLE expense_types 
DROP COLUMN IF EXISTS category;

-- Create trigger to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_expense_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_expense_types_updated_at
    BEFORE UPDATE ON expense_types
    FOR EACH ROW
    EXECUTE FUNCTION update_expense_types_updated_at();

-- Insert default expense types
INSERT INTO expense_types (name, description, is_default, is_global, created_by) VALUES
('Food', 'Animal feed and nutrition expenses', true, true, NULL),
('Medicine', 'Veterinary medicines and treatments', true, true, NULL),
('Vaccine', 'Vaccination and immunization costs', true, true, NULL),
('Other', 'Miscellaneous farm expenses', true, true, NULL)
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE expense_types IS 'Expense types for farm expense categorization';
COMMENT ON COLUMN expense_types.is_default IS 'Whether this is a system default expense type that cannot be deleted';
COMMENT ON COLUMN expense_types.is_global IS 'Whether this expense type is available to all farms';
COMMENT ON COLUMN expense_types.created_by IS 'User who created this expense type (NULL for system defaults)';