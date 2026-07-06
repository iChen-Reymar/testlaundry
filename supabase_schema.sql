-- =============================================================================
-- Laundry Connect — Supabase (PostgreSQL) Schema
-- Run this in Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'user', 'staff', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM (
    'pending', 'confirmed', 'in_progress', 'ready', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- PROFILES (extends auth.users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  role          user_role NOT NULL DEFAULT 'customer',
  profile_image TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- =============================================================================
-- CUSTOMERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id                     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL DEFAULT '',
  email                  TEXT NOT NULL DEFAULT '',
  phone                  TEXT,
  address                TEXT,
  preferred_pickup_time  TEXT,
  total_bookings         INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- STAFF
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.staff (
  id                     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id            TEXT NOT NULL UNIQUE,
  department             TEXT NOT NULL DEFAULT 'operations',
  can_confirm_payments   BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage_bookings    BOOLEAN NOT NULL DEFAULT TRUE,
  promoted_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  promoted_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SERVICES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  price       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  unit        TEXT NOT NULL DEFAULT 'per kg',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_popular  BOOLEAN NOT NULL DEFAULT FALSE,
  image_url   TEXT,
  rating      NUMERIC(3, 2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- BOOKINGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        TEXT NOT NULL UNIQUE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id      UUID REFERENCES public.services(id) ON DELETE SET NULL,
  quantity        NUMERIC(10, 2) NOT NULL DEFAULT 1,
  pickup_date     DATE,
  pickup_time     TEXT,
  payment_method  TEXT,
  payment_id      TEXT,
  payment_status  payment_status NOT NULL DEFAULT 'unpaid',
  total_price     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status          booking_status NOT NULL DEFAULT 'pending',
  actual_weight   NUMERIC(10, 2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON public.bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_order_id ON public.bookings(order_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_pickup ON public.bookings(pickup_date, pickup_time);

-- =============================================================================
-- USER HIDDEN BOOKINGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_hidden_bookings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, booking_id)
);

CREATE INDEX IF NOT EXISTS idx_hidden_bookings_user ON public.user_hidden_bookings(user_id);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  message             TEXT NOT NULL,
  type                notification_type NOT NULL DEFAULT 'info',
  related_booking_id  UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  is_read             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- =============================================================================
-- MESSAGES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(sender_id, receiver_id, created_at);

-- =============================================================================
-- BOOKING RATINGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.booking_ratings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   TEXT NOT NULL,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  rating     INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_order ON public.booking_ratings(order_id);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_customers_updated ON public.customers;
CREATE TRIGGER trg_customers_updated
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_staff_updated ON public.staff;
CREATE TRIGGER trg_staff_updated
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_services_updated ON public.services;
CREATE TRIGGER trg_services_updated
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated ON public.bookings;
CREATE TRIGGER trg_bookings_updated
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- AUTO-CREATE PROFILE + CUSTOMER ON SIGNUP
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name TEXT;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', '');

  INSERT INTO public.profiles (id, email, name, role)
  VALUES (NEW.id, NEW.email, user_name, 'customer');

  INSERT INTO public.customers (id, name, email, total_bookings)
  VALUES (NEW.id, user_name, NEW.email, 0);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- UPDATE SERVICE RATING AFTER CUSTOMER RATES AN ORDER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_service_ratings_for_order(p_order_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  svc RECORD;
  avg_rating NUMERIC;
BEGIN
  FOR svc IN
    SELECT DISTINCT b.service_id
    FROM public.bookings b
    WHERE b.service_id IS NOT NULL
      AND (b.order_id = p_order_id OR b.order_id LIKE p_order_id || '-%')
  LOOP
    SELECT ROUND(AVG(br.rating)::numeric, 2) INTO avg_rating
    FROM public.booking_ratings br
    JOIN public.bookings b ON b.user_id = br.user_id
      AND (b.order_id = br.order_id OR b.order_id LIKE br.order_id || '-%')
    WHERE b.service_id = svc.service_id;

    IF avg_rating IS NOT NULL THEN
      UPDATE public.services SET rating = avg_rating, updated_at = NOW()
      WHERE id = svc.service_id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_update_service_ratings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.update_service_ratings_for_order(NEW.order_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rating_updates_service ON public.booking_ratings;
CREATE TRIGGER trg_rating_updates_service
  AFTER INSERT ON public.booking_ratings
  FOR EACH ROW EXECUTE FUNCTION public.trg_update_service_ratings();

-- =============================================================================
-- RLS HELPERS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'staff') FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hidden_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_ratings ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_delete_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_delete_own_or_admin" ON public.profiles
  FOR DELETE TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Customers
DROP POLICY IF EXISTS "customers_select" ON public.customers;
CREATE POLICY "customers_select" ON public.customers
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "customers_upsert" ON public.customers;
CREATE POLICY "customers_upsert" ON public.customers
  FOR ALL TO authenticated
  USING (id = auth.uid() OR public.is_staff_or_admin())
  WITH CHECK (id = auth.uid() OR public.is_staff_or_admin());

-- Staff
DROP POLICY IF EXISTS "staff_select" ON public.staff;
CREATE POLICY "staff_select" ON public.staff
  FOR SELECT TO authenticated USING (public.is_staff_or_admin() OR id = auth.uid());

DROP POLICY IF EXISTS "staff_admin_write" ON public.staff;
CREATE POLICY "staff_admin_write" ON public.staff
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Services (public read, admin write)
DROP POLICY IF EXISTS "services_select" ON public.services;
CREATE POLICY "services_select" ON public.services
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "services_admin_write" ON public.services;
CREATE POLICY "services_admin_write" ON public.services
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Bookings
DROP POLICY IF EXISTS "bookings_select" ON public.bookings;
CREATE POLICY "bookings_select" ON public.bookings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "bookings_insert_own" ON public.bookings;
CREATE POLICY "bookings_insert_own" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "bookings_update_staff" ON public.bookings;
CREATE POLICY "bookings_update_staff" ON public.bookings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff_or_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "bookings_delete_admin" ON public.bookings;
CREATE POLICY "bookings_delete_admin" ON public.bookings
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Hidden bookings
DROP POLICY IF EXISTS "hidden_bookings_own" ON public.user_hidden_bookings;
CREATE POLICY "hidden_bookings_own" ON public.user_hidden_bookings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Notifications
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Messages
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "messages_update_receiver" ON public.messages;
CREATE POLICY "messages_update_receiver" ON public.messages
  FOR UPDATE TO authenticated USING (receiver_id = auth.uid());

-- Ratings
DROP POLICY IF EXISTS "ratings_select" ON public.booking_ratings;
CREATE POLICY "ratings_select" ON public.booking_ratings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "ratings_insert_own" ON public.booking_ratings;
CREATE POLICY "ratings_insert_own" ON public.booking_ratings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- STORAGE BUCKETS (profile & service images)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('services', 'services', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "profile_images_public_read" ON storage.objects;
CREATE POLICY "profile_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'profiles');

DROP POLICY IF EXISTS "profile_images_upload_own" ON storage.objects;
CREATE POLICY "profile_images_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "profile_images_update_own" ON storage.objects;
CREATE POLICY "profile_images_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "profile_images_delete_own" ON storage.objects;
CREATE POLICY "profile_images_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "service_images_public_read" ON storage.objects;
CREATE POLICY "service_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'services');

DROP POLICY IF EXISTS "service_images_admin_write" ON storage.objects;
CREATE POLICY "service_images_admin_write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'services' AND public.is_admin())
  WITH CHECK (bucket_id = 'services' AND public.is_admin());

-- =============================================================================
-- SEED DATA — Default laundry services
-- =============================================================================
INSERT INTO public.services (name, description, price, unit, is_active, is_popular)
SELECT * FROM (VALUES
  ('Wash',           'Standard washing service for everyday clothes',        50.00,  'per kg', TRUE, TRUE),
  ('Dry',            'Machine drying service',                               40.00,  'per kg', TRUE, FALSE),
  ('Fold',           'Neat folding after wash and dry',                      30.00,  'per kg', TRUE, FALSE),
  ('Ironing',        'Professional ironing service',                         80.00,  'per kg', TRUE, TRUE),
  ('Pressing',       'Steam pressing for formal wear',                       90.00,  'per kg', TRUE, FALSE),
  ('Dry Cleaning',   'Specialized dry cleaning for delicate fabrics',       150.00,  'per item', TRUE, TRUE),
  ('Wash & Fold',    'Complete wash and fold package',                       70.00,  'per kg', TRUE, TRUE),
  ('Ironing & Pressing', 'Combined ironing and pressing service',          120.00,  'per kg', TRUE, FALSE)
) AS v(name, description, price, unit, is_active, is_popular)
WHERE NOT EXISTS (SELECT 1 FROM public.services LIMIT 1);
