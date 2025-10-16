-- FarmFreshBD PostgreSQL Triggers, Functions, and Initial Data

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_farms_updated_at BEFORE UPDATE ON farms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_batches_updated_at BEFORE UPDATE ON product_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_store_products_updated_at BEFORE UPDATE ON store_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shopping_cart_updated_at BEFORE UPDATE ON shopping_cart FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_reviews_updated_at BEFORE UPDATE ON product_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(nextval('order_number_seq')::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create sequence for order numbers
CREATE SEQUENCE order_number_seq START 1;

-- Create trigger for order number generation
CREATE TRIGGER generate_order_number_trigger BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Function to validate order totals
CREATE OR REPLACE FUNCTION validate_order_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure final_amount = total_amount - discount_amount + tax_amount + shipping_amount
    IF NEW.final_amount != (NEW.total_amount - NEW.discount_amount + NEW.tax_amount + NEW.shipping_amount) THEN
        RAISE EXCEPTION 'Final amount calculation is incorrect';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for order total validation
CREATE TRIGGER validate_order_totals_trigger BEFORE INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION validate_order_totals();

-- Function to update stock when order items are created/updated
CREATE OR REPLACE FUNCTION update_stock_on_order()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Decrease stock when order item is created
        UPDATE store_products 
        SET stock_quantity = stock_quantity - NEW.quantity 
        WHERE id = NEW.store_product_id;
        
        -- Check if stock goes below zero
        IF (SELECT stock_quantity FROM store_products WHERE id = NEW.store_product_id) < 0 THEN
            RAISE EXCEPTION 'Insufficient stock for product';
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Adjust stock based on quantity change
        UPDATE store_products 
        SET stock_quantity = stock_quantity + OLD.quantity - NEW.quantity 
        WHERE id = NEW.store_product_id;
        
        -- Check if stock goes below zero
        IF (SELECT stock_quantity FROM store_products WHERE id = NEW.store_product_id) < 0 THEN
            RAISE EXCEPTION 'Insufficient stock for product';
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Restore stock when order item is deleted
        UPDATE store_products 
        SET stock_quantity = stock_quantity + OLD.quantity 
        WHERE id = OLD.store_product_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create trigger for stock management (commented out for now to avoid issues during initial setup)
-- CREATE TRIGGER update_stock_trigger AFTER INSERT OR UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION update_stock_on_order();

-- Insert initial product categories
INSERT INTO product_categories (name, description) VALUES
('Vegetables', 'Fresh vegetables and leafy greens'),
('Fruits', 'Fresh seasonal fruits'),
('Grains', 'Rice, wheat, and other grains'),
('Dairy', 'Milk, cheese, and dairy products'),
('Meat', 'Fresh meat and poultry'),
('Fish', 'Fresh fish and seafood'),
('Herbs', 'Fresh herbs and spices'),
('Organic', 'Certified organic products');

-- Insert initial expense types
INSERT INTO expense_types (name, description, category) VALUES
('Seeds', 'Cost of seeds for planting', 'materials'),
('Fertilizer', 'Chemical and organic fertilizers', 'materials'),
('Pesticides', 'Pest control chemicals', 'materials'),
('Labor', 'Farm worker wages', 'labor'),
('Equipment Maintenance', 'Maintenance of farm equipment', 'maintenance'),
('Fuel', 'Fuel for machinery and vehicles', 'operational'),
('Electricity', 'Electricity bills', 'utilities'),
('Water', 'Water supply and irrigation costs', 'utilities'),
('Transportation', 'Transportation and delivery costs', 'operational'),
('Packaging', 'Product packaging materials', 'materials'),
('Marketing', 'Advertising and marketing expenses', 'operational'),
('Insurance', 'Farm and crop insurance', 'operational'),
('Equipment Purchase', 'New equipment and machinery', 'investment'),
('Land Improvement', 'Land development and improvement', 'investment'),
('Storage', 'Storage facility costs', 'operational'),
('Veterinary', 'Animal health and veterinary services', 'operational'),
('Feed', 'Animal feed and nutrition', 'materials'),
('Rent', 'Land or facility rent', 'operational'),
('Professional Services', 'Consulting and professional fees', 'operational'),
('Other', 'Miscellaneous expenses', 'other');

-- Create a default admin user (password: admin123)
-- Note: In production, this should be changed immediately
INSERT INTO users (email, password_hash, role, first_name, last_name, is_active, email_verified) VALUES
('admin@farmfreshbd.com', '$2b$10$rQZ8kHWKQYXHjQXHjQXHjOzKQYXHjQXHjQXHjQXHjQXHjQXHjQXHjQ', 'admin', 'System', 'Administrator', true, true);

-- Create views for common queries
CREATE VIEW product_inventory AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.unit,
    f.name as farm_name,
    pc.name as category_name,
    COALESCE(SUM(pb.quantity), 0) as total_quantity,
    COALESCE(AVG(pb.unit_price), p.base_price) as avg_price,
    COUNT(pb.id) as batch_count
FROM products p
LEFT JOIN farms f ON p.farm_id = f.id
LEFT JOIN product_categories pc ON p.category_id = pc.id
LEFT JOIN product_batches pb ON p.id = pb.product_id AND pb.is_available = true
WHERE p.is_active = true
GROUP BY p.id, p.name, p.unit, f.name, pc.name, p.base_price;

CREATE VIEW store_inventory AS
SELECT 
    sp.id as store_product_id,
    p.name as product_name,
    p.unit,
    f.name as farm_name,
    pc.name as category_name,
    sp.store_price,
    sp.stock_quantity,
    sp.min_stock_level,
    sp.is_featured,
    sp.is_available,
    sp.discount_percentage,
    CASE 
        WHEN sp.stock_quantity <= sp.min_stock_level THEN 'Low Stock'
        WHEN sp.stock_quantity = 0 THEN 'Out of Stock'
        ELSE 'In Stock'
    END as stock_status
FROM store_products sp
JOIN products p ON sp.product_id = p.id
JOIN farms f ON p.farm_id = f.id
LEFT JOIN product_categories pc ON p.category_id = pc.id
WHERE p.is_active = true;

CREATE VIEW farm_sales_summary AS
SELECT 
    f.id as farm_id,
    f.name as farm_name,
    DATE_TRUNC('month', s.sale_date) as month,
    COUNT(s.id) as total_sales,
    SUM(s.total_amount) as total_revenue,
    AVG(s.total_amount) as avg_sale_amount
FROM farms f
LEFT JOIN sales s ON f.id = s.farm_id
GROUP BY f.id, f.name, DATE_TRUNC('month', s.sale_date);

CREATE VIEW farm_expenses_summary AS
SELECT 
    f.id as farm_id,
    f.name as farm_name,
    et.category as expense_category,
    DATE_TRUNC('month', e.expense_date) as month,
    COUNT(e.id) as total_expenses,
    SUM(e.amount) as total_amount
FROM farms f
LEFT JOIN expenses e ON f.id = e.farm_id
LEFT JOIN expense_types et ON e.expense_type_id = et.id
GROUP BY f.id, f.name, et.category, DATE_TRUNC('month', e.expense_date);

-- Grant permissions (adjust as needed for your security requirements)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO farmfreshbd_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO farmfreshbd_user;