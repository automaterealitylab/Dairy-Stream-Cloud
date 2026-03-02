-- Supabase SQL Migrations for Dairy Automation System
-- Run these SQL statements in the Supabase SQL Editor to create all required tables

-- ============================================
-- Create Dairies Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.dairies (
  id BIGSERIAL PRIMARY KEY,
  dairy_name VARCHAR(255) NOT NULL,
  dairy_phone VARCHAR(20) NOT NULL,
  dairy_email VARCHAR(255) NOT NULL UNIQUE,
  gstin VARCHAR(20),
  category VARCHAR(100) DEFAULT 'Milk & Dairy',
  address VARCHAR(500) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(10) NOT NULL,
  service_type VARCHAR(50) DEFAULT 'PINCODE',
  service_pincodes VARCHAR(500),
  service_radius NUMERIC(5, 2) DEFAULT 5.0,
  owner_name VARCHAR(255) NOT NULL,
  bank_account_holder_name VARCHAR(255),
  bank_account_number VARCHAR(30),
  bank_ifsc_code VARCHAR(20),
  bank_name VARCHAR(255),
  bank_branch VARCHAR(255),
  upi_id VARCHAR(255),
  selected_plan VARCHAR(50) DEFAULT 'GROWTH',
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_account_holder_name VARCHAR(255);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(30);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_ifsc_code VARCHAR(20);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_dairies_email ON public.dairies(dairy_email);
CREATE INDEX IF NOT EXISTS idx_dairies_city ON public.dairies(city);
CREATE INDEX IF NOT EXISTS idx_dairies_pincode ON public.dairies(pincode);

-- ============================================
-- Create Admins Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.admins (
  id BIGSERIAL PRIMARY KEY,
  dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) DEFAULT 'ADMIN',
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Legacy-safe normalization for existing admins table
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS dairy_id BIGINT;
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS password VARCHAR(255);
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_dairy_id ON public.admins(dairy_id);

-- ============================================
-- Create Customers Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.customers (
  id BIGSERIAL PRIMARY KEY,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  phone_number VARCHAR(20),
  building_name VARCHAR(255),
  wing VARCHAR(50),
  room_no VARCHAR(50),
  profile_photo_url TEXT,
  default_milk_quantity_liters NUMERIC(10, 2) DEFAULT 1.0,
  default_extra_product VARCHAR(255) DEFAULT 'None',
  default_extra_product_quantity NUMERIC(10, 2) DEFAULT 0,
  billing_cycle VARCHAR(50) DEFAULT 'Monthly',
  date_joined TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_building ON public.customers(building_name);
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS dairy_id BIGINT;
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
CREATE INDEX IF NOT EXISTS idx_customers_dairy_id ON public.customers(dairy_id);

-- ============================================
-- Create / Normalize Subscriptions Table
-- ============================================
-- Subscription table should use BIGINT ids to match customers.id and dairies.id.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  dairy_id BIGINT NOT NULL,
  milk_type VARCHAR(100),
  quantity_liters NUMERIC(10, 2),
  delivery_slot VARCHAR(100),
  start_date DATE,
  address TEXT,
  payment_method VARCHAR(100),
  status VARCHAR(50) DEFAULT 'ACTIVE',
  approval_status VARCHAR(50) DEFAULT 'APPROVED',
  assigned_agent_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Legacy-safe normalization for existing subscriptions table.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS customer_id BIGINT;
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS dairy_id BIGINT;
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS milk_type VARCHAR(100);
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS quantity_liters NUMERIC(10, 2);
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS delivery_slot VARCHAR(100);
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100);
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'APPROVED';
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS assigned_agent_id BIGINT;
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- If legacy subscriptions columns are UUID and table has no rows, convert to BIGINT.
DO $$
DECLARE
  subscriptions_customer_type text;
  subscriptions_dairy_type text;
  subscriptions_row_count bigint;
  c record;
BEGIN
  SELECT udt_name INTO subscriptions_customer_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'customer_id';

  SELECT udt_name INTO subscriptions_dairy_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'dairy_id';

  EXECUTE 'SELECT COUNT(*) FROM public.subscriptions' INTO subscriptions_row_count;

  IF subscriptions_row_count = 0
     AND (subscriptions_customer_type <> 'int8' OR subscriptions_dairy_type <> 'int8') THEN
    -- Drop existing constraints first so type change can proceed.
    FOR c IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.subscriptions'::regclass
    LOOP
      EXECUTE format('ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS %I', c.conname);
    END LOOP;

    ALTER TABLE public.subscriptions
      ALTER COLUMN customer_id TYPE BIGINT
      USING CASE
        WHEN customer_id IS NULL THEN NULL
        WHEN customer_id::text ~ '^[0-9]+$' THEN customer_id::text::bigint
        ELSE NULL
      END;

    ALTER TABLE public.subscriptions
      ALTER COLUMN dairy_id TYPE BIGINT
      USING CASE
        WHEN dairy_id IS NULL THEN NULL
        WHEN dairy_id::text ~ '^[0-9]+$' THEN dairy_id::text::bigint
        ELSE NULL
      END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON public.subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_dairy_id ON public.subscriptions(dairy_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_approval_status ON public.subscriptions(approval_status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_assigned_agent_id ON public.subscriptions(assigned_agent_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_subscriptions_customer_dairy'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT uq_subscriptions_customer_dairy UNIQUE (customer_id, dairy_id);
  END IF;
END $$;

-- ============================================
-- Create / Normalize Deliveries Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.deliveries (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  dairy_id BIGINT,
  agent_id BIGINT,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  milk_type VARCHAR(100),
  quantity_liters NUMERIC(10, 2),
  status VARCHAR(50) DEFAULT 'PENDING',
  approval_status VARCHAR(50) DEFAULT 'APPROVED',
  customer_issue_text TEXT,
  customer_issue_status VARCHAR(50) DEFAULT 'NONE',
  customer_issue_reported_at TIMESTAMP WITH TIME ZONE,
  customer_issue_admin_action TEXT,
  customer_issue_resolved_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS customer_id BIGINT;
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS dairy_id BIGINT;
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS agent_id BIGINT;
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS delivery_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS milk_type VARCHAR(100);
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS quantity_liters NUMERIC(10, 2);
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'APPROVED';
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS customer_issue_text TEXT;
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS customer_issue_status VARCHAR(50) DEFAULT 'NONE';
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS customer_issue_reported_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS customer_issue_admin_action TEXT;
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS customer_issue_resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_deliveries_customer_id ON public.deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_dairy_id ON public.deliveries(dairy_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_agent_id ON public.deliveries(agent_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_date ON public.deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_approval_status ON public.deliveries(approval_status);
CREATE INDEX IF NOT EXISTS idx_deliveries_issue_status ON public.deliveries(customer_issue_status);
CREATE INDEX IF NOT EXISTS idx_deliveries_issue_reported_at ON public.deliveries(customer_issue_reported_at);

-- ============================================
-- Create / Normalize Products Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  product_type VARCHAR(80) DEFAULT 'MILK',
  unit VARCHAR(40) DEFAULT 'LITER',
  rate_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stock_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS dairy_id BIGINT;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_type VARCHAR(80) DEFAULT 'MILK';
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit VARCHAR(40) DEFAULT 'LITER';
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS rate_per_unit NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_products_dairy_id ON public.products(dairy_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_products_dairy_name_ci'
  ) THEN
    CREATE UNIQUE INDEX uq_products_dairy_name_ci
      ON public.products (dairy_id, lower(name));
  END IF;
END $$;

-- ============================================
-- Create / Normalize Payments Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.payments (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  dairy_id BIGINT,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'PENDING',
  method VARCHAR(100),
  description TEXT,
  billing_month VARCHAR(50),
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS customer_id BIGINT;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS dairy_id BIGINT;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS method VARCHAR(100);
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS billing_month VARCHAR(50);
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_dairy_id ON public.payments(dairy_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments(due_date);

-- ============================================
-- Create Memberships Table (Customer <-> Dairy Link)
-- ============================================
-- This table is the source of truth for "customer registered to specific dairy".
CREATE TABLE IF NOT EXISTS public.memberships (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  plan_name VARCHAR(100),
  status VARCHAR(50) DEFAULT 'ACTIVE',
  building_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- If memberships already existed with legacy shape, normalize it.
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS customer_id BIGINT;
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS dairy_id BIGINT;
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS plan_name VARCHAR(100);
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS building_name VARCHAR(255);
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Backfill customer_id from legacy user_id if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memberships'
      AND column_name = 'user_id'
  ) THEN
    -- Handle legacy user_id type safely:
    -- 1) If customer_id is uuid, direct assignment is valid.
    -- 2) If customer_id is bigint, only copy numeric-looking user_id values.
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'memberships'
        AND column_name = 'customer_id'
        AND udt_name = 'uuid'
    ) THEN
      EXECUTE '
        UPDATE public.memberships
        SET customer_id = user_id
        WHERE customer_id IS NULL
      ';
    ELSE
      EXECUTE '
        UPDATE public.memberships
        SET customer_id = user_id::text::bigint
        WHERE customer_id IS NULL
          AND user_id::text ~ ''^[0-9]+$''
      ';
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_memberships_customer_id ON public.memberships(customer_id);
CREATE INDEX IF NOT EXISTS idx_memberships_dairy_id ON public.memberships(dairy_id);
CREATE INDEX IF NOT EXISTS idx_memberships_building_name ON public.memberships(building_name);

-- Ensure one membership per (customer, dairy) pair.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_memberships_customer_dairy'
      AND conrelid = 'public.memberships'::regclass
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT uq_memberships_customer_dairy UNIQUE (customer_id, dairy_id);
  END IF;
END $$;

-- Backfill memberships from legacy customers.dairy_id links.
DO $$
DECLARE
  memberships_customer_type text;
  memberships_dairy_type text;
  customers_id_type text;
  customers_dairy_type text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'dairy_id'
  ) THEN
    SELECT udt_name INTO memberships_customer_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memberships' AND column_name = 'customer_id';

    SELECT udt_name INTO memberships_dairy_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memberships' AND column_name = 'dairy_id';

    SELECT udt_name INTO customers_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'id';

    SELECT udt_name INTO customers_dairy_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'dairy_id';

    -- Backfill only when types are compatible to avoid runtime cast failures.
    IF memberships_customer_type = customers_id_type
       AND memberships_dairy_type = customers_dairy_type THEN
      INSERT INTO public.memberships (customer_id, dairy_id, building_name)
      SELECT c.id, c.dairy_id, c.building_name
      FROM public.customers c
      WHERE c.dairy_id IS NOT NULL
      ON CONFLICT (customer_id, dairy_id) DO NOTHING;
    END IF;
  END IF;
END $$;

-- Backfill memberships from subscriptions if table exists.
DO $$
DECLARE
  memberships_customer_type text;
  memberships_dairy_type text;
  subscriptions_customer_type text;
  subscriptions_dairy_type text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'customer_id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'dairy_id'
  ) THEN
    SELECT udt_name INTO memberships_customer_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memberships' AND column_name = 'customer_id';

    SELECT udt_name INTO memberships_dairy_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memberships' AND column_name = 'dairy_id';

    SELECT udt_name INTO subscriptions_customer_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'customer_id';

    SELECT udt_name INTO subscriptions_dairy_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'dairy_id';

    -- Backfill only when types are compatible to avoid runtime cast failures.
    IF memberships_customer_type = subscriptions_customer_type
       AND memberships_dairy_type = subscriptions_dairy_type THEN
      INSERT INTO public.memberships (customer_id, dairy_id)
      SELECT s.customer_id, s.dairy_id
      FROM public.subscriptions s
      WHERE s.customer_id IS NOT NULL AND s.dairy_id IS NOT NULL
      ON CONFLICT (customer_id, dairy_id) DO NOTHING;
    END IF;
  END IF;
END $$;

-- ============================================
-- Create Agents Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.agents (
  id BIGSERIAL PRIMARY KEY,
  dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  agent_id VARCHAR(50) NOT NULL,
  agent_name VARCHAR(255),
  phone_number VARCHAR(20),
  building VARCHAR(255),
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Legacy-safe normalization for existing agents table
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS dairy_id BIGINT;
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS password VARCHAR(255);
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS agent_id VARCHAR(50);
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS inactive_from TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS inactive_until DATE;
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS inactive_days INTEGER;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_agents_email ON public.agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_building ON public.agents(building);
CREATE INDEX IF NOT EXISTS idx_agents_dairy_id ON public.agents(dairy_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_inactive_until ON public.agents(inactive_until);

-- ============================================
-- Enable Row Level Security (Optional but Recommended)
-- ============================================
-- ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Grant Permissions (If using service role)
-- ============================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;

-- ============================================
-- Sample Insert (For Testing)
-- ============================================
-- Note: In production, use bcrypt hashed passwords
-- INSERT INTO public.customers (email, password, customer_name, phone_number, building_name, wing, room_no, billing_cycle)
-- VALUES 
--   ('customer1@example.com', '$2a$10$...', 'John Doe', '1234567890', 'Building A', 'Wing A', '101', 'Monthly'),
--   ('customer2@example.com', '$2a$10$...', 'Jane Smith', '0987654321', 'Building B', 'Wing B', '202', 'Monthly');

-- INSERT INTO public.agents (email, password, agent_name, phone_number, building)
-- VALUES 
--   ('agent1@example.com', '$2a$10$...', 'Agent One', '1111111111', 'Building A'),
--   ('agent2@example.com', '$2a$10$...', 'Agent Two', '2222222222', 'Building B');
