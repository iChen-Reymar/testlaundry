-- Add actual_weight column to bookings table for weighing feature
-- Run this in your Supabase SQL Editor

-- Add actual_weight column if it doesn't exist
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_weight DECIMAL(10,2);

-- Add comment for clarity
COMMENT ON COLUMN bookings.actual_weight IS 'Actual weight in kg after staff weighs the items';

-- Update the bookings view/query if needed
-- The actual_weight will be used to calculate final price:
-- final_price = actual_weight * service_price_per_unit

-- Example query to get booking with calculated price:
-- SELECT 
--   b.*,
--   s.price as price_per_unit,
--   COALESCE(b.actual_weight, b.quantity) as weight,
--   COALESCE(b.actual_weight, b.quantity) * s.price as calculated_total
-- FROM bookings b
-- JOIN services s ON b.service_id = s.id;

