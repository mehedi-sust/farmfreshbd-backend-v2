-- Add profit column to sales table
-- This column stores per-sale total profit computed at sale creation

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS profit NUMERIC(14,2) DEFAULT 0;

-- Optional: backfill profit for existing rows using available fields
-- Assumes products.unit_price represents unit cost at time of sale; if not available, this stays 0
-- UPDATE sales s
-- SET profit = (s.unit_price - p.unit_price) * s.quantity
-- FROM products p
-- WHERE s.product_id = p.id AND (s.profit IS NULL OR s.profit = 0);