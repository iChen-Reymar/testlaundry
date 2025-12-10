-- Update RLS policies for services table
-- Allow all authenticated users (including customers) to VIEW active services
-- Restrict INSERT, UPDATE, DELETE to ADMIN ONLY (staff can only view)

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "services_select" ON services;
DROP POLICY IF EXISTS "services_select_inactive" ON services;
DROP POLICY IF EXISTS "services_insert" ON services;
DROP POLICY IF EXISTS "services_update" ON services;
DROP POLICY IF EXISTS "services_delete" ON services;

-- SELECT: All authenticated users can view active services
-- Staff and admin can view both active and inactive services
CREATE POLICY "services_select" ON services 
FOR SELECT 
TO authenticated 
USING (
  is_active = true OR 
  public.get_user_role() IN ('admin', 'staff')
);

-- INSERT: Only admin can add new services
CREATE POLICY "services_insert" ON services 
FOR INSERT 
TO authenticated 
WITH CHECK (
  public.get_user_role() = 'admin'
);

-- UPDATE: Only admin can update services
CREATE POLICY "services_update" ON services 
FOR UPDATE 
TO authenticated 
USING (
  public.get_user_role() = 'admin'
)
WITH CHECK (
  public.get_user_role() = 'admin'
);

-- DELETE: Only admin can delete services
CREATE POLICY "services_delete" ON services 
FOR DELETE 
TO authenticated 
USING (
  public.get_user_role() = 'admin'
);

-- Summary:
-- 1. All authenticated users (customers, staff, admin) can VIEW active services
-- 2. Staff and admin can VIEW both active and inactive services
-- 3. Only ADMIN can INSERT, UPDATE, or DELETE services
-- 4. Staff has VIEW-ONLY access to services

