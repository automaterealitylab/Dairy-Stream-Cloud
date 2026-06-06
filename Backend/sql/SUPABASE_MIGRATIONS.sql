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
  phone VARCHAR(20),
  email VARCHAR(255),
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
  bank_account VARCHAR(35),
  ifsc VARCHAR(20),
  pan VARCHAR(20),
  bank_name VARCHAR(255),
  bank_branch VARCHAR(255),
  upi_id VARCHAR(255),
  razorpay_account_id VARCHAR(50),
  razorpay_linked_account_id VARCHAR(255),
  razorpay_stakeholder_id VARCHAR(255),
  razorpay_route_product_id VARCHAR(50),
  razorpay_onboarding_status VARCHAR(50) DEFAULT 'PENDING',
  route_activation_status VARCHAR(50) DEFAULT 'PENDING',
  payments_enabled BOOLEAN DEFAULT FALSE,
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
  ADD COLUMN IF NOT EXISTS bank_account_number_encrypted JSONB;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS masked_account_number VARCHAR(40);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_ifsc_code VARCHAR(20);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_account VARCHAR(35);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS ifsc VARCHAR(20);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS pan VARCHAR(20);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS razorpay_account_id VARCHAR(50);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS razorpay_linked_account_id VARCHAR(255);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS razorpay_stakeholder_id VARCHAR(255);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS razorpay_route_product_id VARCHAR(50);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS razorpay_onboarding_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS route_activation_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS payments_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS verification_provider VARCHAR(80);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS verification_reference_id VARCHAR(150);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_verification_status VARCHAR(50) DEFAULT 'NOT_SUBMITTED';
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_verification_timestamp TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS account_name_match_score NUMERIC(5, 2);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS verified_account_holder_name VARCHAR(255);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS verified_upi_id VARCHAR(255);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS account_verification_response JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS verification_last_error TEXT;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS verification_method VARCHAR(80);
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS vpa_detected BOOLEAN DEFAULT FALSE;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS vpa_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_verification_reset_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS verification_required BOOLEAN DEFAULT FALSE;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS account_last_updated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_dairies_email ON public.dairies(dairy_email);
CREATE INDEX IF NOT EXISTS idx_dairies_city ON public.dairies(city);
CREATE INDEX IF NOT EXISTS idx_dairies_pincode ON public.dairies(pincode);
CREATE INDEX IF NOT EXISTS idx_dairies_route_account ON public.dairies(razorpay_account_id);
CREATE INDEX IF NOT EXISTS idx_dairies_bank_verification_status
  ON public.dairies(bank_verification_status);
CREATE INDEX IF NOT EXISTS idx_dairies_verified_upi_id
  ON public.dairies(verified_upi_id)
  WHERE verified_upi_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dairies_verification_required
  ON public.dairies(verification_required)
  WHERE verification_required = TRUE;

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
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_phone ON public.admins(phone);
CREATE INDEX IF NOT EXISTS idx_admins_phone_number ON public.admins(phone_number);
CREATE INDEX IF NOT EXISTS idx_admins_dairy_id ON public.admins(dairy_id);

-- ============================================
-- Create Customers Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.customers (
  id BIGSERIAL PRIMARY KEY,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  customer_name VARCHAR(255),
  phone_number VARCHAR(20),
  address_line_1 VARCHAR(255),
  address_line_2 VARCHAR(255),
  building_name VARCHAR(255),
  wing VARCHAR(50),
  room_no VARCHAR(50),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  profile_photo_url TEXT,
  default_milk_quantity_liters NUMERIC(10, 2) DEFAULT 1.0,
  default_extra_product VARCHAR(255) DEFAULT 'None',
  default_extra_product_quantity NUMERIC(10, 2) DEFAULT 0,
  wallet_balance NUMERIC(12, 2) DEFAULT 0,
  outstanding_balance NUMERIC(12, 2) DEFAULT 0,
  billing_cycle VARCHAR(50) DEFAULT 'Monthly',
  push_subscription JSONB,
  date_joined TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone_number ON public.customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_customers_building ON public.customers(building_name);
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS dairy_id BIGINT;
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address_line_1 VARCHAR(255);
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address_line_2 VARCHAR(255);
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS push_subscription JSONB;
CREATE INDEX IF NOT EXISTS idx_customers_dairy_id ON public.customers(dairy_id);

-- ============================================
-- Create / Normalize Marketplace Orders Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.orders (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES public.customers(id),
  dairy_id BIGINT REFERENCES public.dairies(id),
  amount NUMERIC(12, 2) NOT NULL,
  subtotal NUMERIC(12, 2) DEFAULT 0,
  tax_amount NUMERIC(12, 2) DEFAULT 0,
  delivery_fee NUMERIC(12, 2) DEFAULT 0,
  pricing_snapshot JSONB,
  payment_status VARCHAR(50) DEFAULT 'CREATED',
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_id BIGINT;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dairy_id BIGINT;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'CREATED';
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100);
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100);
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_dairy_id ON public.orders(dairy_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON public.orders(razorpay_order_id);

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
  delivery_days JSONB,
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
  ADD COLUMN IF NOT EXISTS delivery_days JSONB;
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

-- ============================================
-- Extend Procurement Logs For Generic Inventory
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'procurement_logs'
  ) THEN
    ALTER TABLE public.procurement_logs
      ADD COLUMN IF NOT EXISTS supplier_id BIGINT;
    ALTER TABLE public.procurement_logs
      ADD COLUMN IF NOT EXISTS item_name VARCHAR(150) DEFAULT 'Milk';
    ALTER TABLE public.procurement_logs
      ADD COLUMN IF NOT EXISTS item_category VARCHAR(80) DEFAULT 'MILK';
    ALTER TABLE public.procurement_logs
      ADD COLUMN IF NOT EXISTS unit VARCHAR(40) DEFAULT 'LITER';
    ALTER TABLE public.procurement_logs
      ADD COLUMN IF NOT EXISTS rate_per_unit NUMERIC(10, 2);

    UPDATE public.procurement_logs
    SET
      item_name = COALESCE(NULLIF(item_name, ''), 'Milk'),
      item_category = COALESCE(NULLIF(item_category, ''), 'MILK'),
      unit = COALESCE(NULLIF(unit, ''), 'LITER'),
      rate_per_unit = COALESCE(rate_per_unit, rate_per_liter)
    WHERE item_name IS NULL
       OR item_category IS NULL
       OR unit IS NULL
       OR rate_per_unit IS NULL;
  END IF;
END $$;

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
  order_id BIGINT,
  customer_id BIGINT NOT NULL,
  dairy_id BIGINT,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'PENDING',
  settlement_status VARCHAR(50) DEFAULT 'PENDING',
  transfer_status VARCHAR(50) DEFAULT 'PENDING',
  settlement_id VARCHAR(100),
  failure_reason TEXT,
  method VARCHAR(100),
  description TEXT,
  billing_month VARCHAR(50),
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  razorpay_transfer_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS order_id BIGINT;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS customer_id BIGINT;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS dairy_id BIGINT;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS transfer_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS settlement_id VARCHAR(100);
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;
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
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100);
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100);
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS razorpay_transfer_id VARCHAR(100);
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_dairy_id ON public.payments(dairy_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_settlement_status ON public.payments(settlement_status);
CREATE INDEX IF NOT EXISTS idx_payments_transfer_status ON public.payments(transfer_status);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON public.payments(razorpay_order_id);

-- ============================================
-- Create Webhook Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id BIGSERIAL PRIMARY KEY,
  razorpay_event_id VARCHAR(100),
  event_type VARCHAR(100),
  payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT,
  attempts INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  dead_letter BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS razorpay_event_id VARCHAR(100);
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(100);
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS dead_letter BOOLEAN DEFAULT FALSE;
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON public.webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_logs_razorpay_event_id
  ON public.webhook_logs(razorpay_event_id)
  WHERE razorpay_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_logs_retry
  ON public.webhook_logs(processed, dead_letter, next_retry_at);

-- ============================================
-- Create Reconciliation Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.reconciliation_logs (
  id BIGSERIAL PRIMARY KEY,
  run_type VARCHAR(80) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'STARTED',
  checked_count INTEGER DEFAULT 0,
  repaired_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  details JSONB,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_run_type ON public.reconciliation_logs(run_type);
CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_status ON public.reconciliation_logs(status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_created_at ON public.reconciliation_logs(created_at);

-- ============================================
-- Create Payment Audit Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  payment_id BIGINT,
  order_id BIGINT,
  event_type VARCHAR(100) NOT NULL,
  previous_state JSONB,
  next_state JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_payment_id ON public.payment_audit_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_order_id ON public.payment_audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_event_type ON public.payment_audit_logs(event_type);

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
CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON public.agents(agent_id);
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
-- ============================================
-- Create Deliveries Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.deliveries (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  dairy_farm_id VARCHAR(255),
  dairy_farm_name VARCHAR(255),
  customer_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  address TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'IN_TRANSIT')),
  delivery_date DATE NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_reason VARCHAR(50) CHECK (failed_reason IN ('CUSTOMER_UNAVAILABLE', 'PAYMENT_ISSUE', 'WRONG_ADDRESS', 'OTHER')),
  failed_reason_details TEXT,
  proof_type VARCHAR(50) CHECK (proof_type IN ('PHOTO', 'OTP', 'NONE')),
  proof_photo_url TEXT,
  proof_otp VARCHAR(10),
  otp_verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deliveries_agent_id ON public.deliveries(agent_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer_id ON public.deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_date ON public.deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);

-- ============================================
-- Create Delivery Proofs Table (Optional - for tracking proof submissions)
-- ============================================
CREATE TABLE IF NOT EXISTS public.delivery_proofs (
  id BIGSERIAL PRIMARY KEY,
  delivery_id BIGINT NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  proof_type VARCHAR(50) NOT NULL CHECK (proof_type IN ('PHOTO', 'OTP')),
  photo_url TEXT,
  otp_code VARCHAR(10),
  otp_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_proofs_delivery_id ON public.delivery_proofs(delivery_id);

-- ============================================
-- Create Agent Performance Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_performance (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  performance_date DATE NOT NULL,
  total_assigned BIGINT DEFAULT 0,
  completed BIGINT DEFAULT 0,
  failed BIGINT DEFAULT 0,
  pending BIGINT DEFAULT 0,
  completion_rate NUMERIC(5, 2) DEFAULT 0,
  efficiency_percentage NUMERIC(5, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_id, performance_date)
);

CREATE INDEX IF NOT EXISTS idx_agent_performance_agent_id ON public.agent_performance(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_date ON public.agent_performance(performance_date);

-- ============================================
-- Create Agent Earnings Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_earnings (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  earning_date DATE NOT NULL,
  deliveries_completed BIGINT DEFAULT 0,
  earning_per_delivery NUMERIC(10, 2) DEFAULT 50.00,
  total_earnings NUMERIC(10, 2) DEFAULT 0,
  bonus_amount NUMERIC(10, 2) DEFAULT 0,
  deductions NUMERIC(10, 2) DEFAULT 0,
  net_earnings NUMERIC(10, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_id, earning_date)
);

CREATE INDEX IF NOT EXISTS idx_agent_earnings_agent_id ON public.agent_earnings(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_earnings_date ON public.agent_earnings(earning_date);

-- ============================================
-- Enterprise Fintech Hardening Additions
-- ============================================
-- These additions preserve the existing Razorpay Route architecture while adding
-- append-only ledgers, event lineage, reconciliation snapshots, queue telemetry,
-- fraud/security hooks, and RLS-ready policy boundaries.

ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS event_version VARCHAR(30) DEFAULT 'v1';
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS lineage_key VARCHAR(150);
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS replay_count INTEGER DEFAULT 0;
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS duplicate_suppressed BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_lineage_key ON public.webhook_logs(lineage_key);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed_at ON public.webhook_logs(processed_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_dead_retry ON public.webhook_logs(dead_letter, next_retry_at);

CREATE TABLE IF NOT EXISTS public.financial_ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  payment_id BIGINT REFERENCES public.payments(id),
  order_id BIGINT REFERENCES public.orders(id),
  dairy_id BIGINT REFERENCES public.dairies(id),
  customer_id BIGINT REFERENCES public.customers(id),
  entry_type VARCHAR(80) NOT NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  reference_type VARCHAR(80),
  reference_id VARCHAR(150),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_ledger_payment_id ON public.financial_ledger_entries(payment_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_order_id ON public.financial_ledger_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_dairy_id ON public.financial_ledger_entries(dairy_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_reference ON public.financial_ledger_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_created_at ON public.financial_ledger_entries(created_at);

CREATE TABLE IF NOT EXISTS public.settlement_ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  payment_id BIGINT REFERENCES public.payments(id),
  dairy_id BIGINT REFERENCES public.dairies(id),
  razorpay_transfer_id VARCHAR(100),
  settlement_id VARCHAR(100),
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(80) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settlement_ledger_payment_id ON public.settlement_ledger_entries(payment_id);
CREATE INDEX IF NOT EXISTS idx_settlement_ledger_dairy_id ON public.settlement_ledger_entries(dairy_id);
CREATE INDEX IF NOT EXISTS idx_settlement_ledger_transfer_id ON public.settlement_ledger_entries(razorpay_transfer_id);
CREATE INDEX IF NOT EXISTS idx_settlement_ledger_settlement_id ON public.settlement_ledger_entries(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_ledger_created_at ON public.settlement_ledger_entries(created_at);

CREATE TABLE IF NOT EXISTS public.immutable_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(150),
  event_type VARCHAR(120) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_hash VARCHAR(64),
  hash VARCHAR(64) NOT NULL,
  correlation_id VARCHAR(128),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_immutable_audit_hash ON public.immutable_audit_logs(hash);
CREATE INDEX IF NOT EXISTS idx_immutable_audit_entity ON public.immutable_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_immutable_audit_event_type ON public.immutable_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_immutable_audit_created_at ON public.immutable_audit_logs(created_at);

CREATE OR REPLACE FUNCTION public.prevent_immutable_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'immutable_audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_immutable_audit_update ON public.immutable_audit_logs;
CREATE TRIGGER trg_prevent_immutable_audit_update
BEFORE UPDATE OR DELETE ON public.immutable_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_audit_mutation();

CREATE TABLE IF NOT EXISTS public.reconciliation_mismatches (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT REFERENCES public.reconciliation_logs(id),
  payment_id BIGINT REFERENCES public.payments(id),
  order_id BIGINT REFERENCES public.orders(id),
  dairy_id BIGINT REFERENCES public.dairies(id),
  mismatch_type VARCHAR(120) NOT NULL,
  severity VARCHAR(30) NOT NULL DEFAULT 'MEDIUM',
  expected JSONB,
  actual JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(40) NOT NULL DEFAULT 'OPEN',
  fingerprint TEXT NOT NULL,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reconciliation_mismatches_fingerprint
  ON public.reconciliation_mismatches(fingerprint);
CREATE INDEX IF NOT EXISTS idx_reconciliation_mismatches_status ON public.reconciliation_mismatches(status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_mismatches_payment_id ON public.reconciliation_mismatches(payment_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_mismatches_dairy_id ON public.reconciliation_mismatches(dairy_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_mismatches_last_seen ON public.reconciliation_mismatches(last_seen_at);

CREATE TABLE IF NOT EXISTS public.reconciliation_snapshots (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT REFERENCES public.reconciliation_logs(id),
  stage VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  checked_count INTEGER DEFAULT 0,
  repaired_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  anomaly_count INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_snapshots_run_id ON public.reconciliation_snapshots(run_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_snapshots_stage ON public.reconciliation_snapshots(stage);
CREATE INDEX IF NOT EXISTS idx_reconciliation_snapshots_created_at ON public.reconciliation_snapshots(created_at);

CREATE TABLE IF NOT EXISTS public.queue_job_logs (
  id BIGSERIAL PRIMARY KEY,
  queue_name VARCHAR(120) NOT NULL,
  job_name VARCHAR(120) NOT NULL,
  job_id VARCHAR(180),
  idempotency_key VARCHAR(180),
  status VARCHAR(40) NOT NULL DEFAULT 'QUEUED',
  attempts INTEGER DEFAULT 0,
  payload JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_job_logs_idempotency
  ON public.queue_job_logs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_queue_job_logs_queue_status ON public.queue_job_logs(queue_name, status);

CREATE TABLE IF NOT EXISTS public.fraud_alerts (
  id BIGSERIAL PRIMARY KEY,
  payment_id BIGINT REFERENCES public.payments(id),
  order_id BIGINT REFERENCES public.orders(id),
  dairy_id BIGINT REFERENCES public.dairies(id),
  customer_id BIGINT REFERENCES public.customers(id),
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(30) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(40) NOT NULL DEFAULT 'OPEN',
  signal JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON public.fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_payment_id ON public.fraud_alerts(payment_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_created_at ON public.fraud_alerts(created_at);

CREATE TABLE IF NOT EXISTS public.security_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(120) NOT NULL,
  severity VARCHAR(30) NOT NULL DEFAULT 'INFO',
  ip_address VARCHAR(80),
  user_agent TEXT,
  fingerprint VARCHAR(64),
  path TEXT,
  method VARCHAR(12),
  correlation_id VARCHAR(128),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_fingerprint ON public.security_events(fingerprint);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at);

CREATE TABLE IF NOT EXISTS public.consent_records (
  id BIGSERIAL PRIMARY KEY,
  subject_type VARCHAR(40) NOT NULL,
  subject_id BIGINT NOT NULL,
  consent_type VARCHAR(100) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'GRANTED',
  source VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_consent_records_subject ON public.consent_records(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_type_status ON public.consent_records(consent_type, status);

CREATE TABLE IF NOT EXISTS public.retention_policies (
  id BIGSERIAL PRIMARY KEY,
  data_domain VARCHAR(100) NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL CHECK (retention_days > 0),
  action VARCHAR(40) NOT NULL DEFAULT 'ARCHIVE',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.retention_policies (data_domain, retention_days, action)
VALUES
  ('webhook_logs', 365, 'ARCHIVE'),
  ('security_events', 180, 'ARCHIVE'),
  ('immutable_audit_logs', 2555, 'RETAIN'),
  ('financial_ledger_entries', 2555, 'RETAIN'),
  ('settlement_ledger_entries', 2555, 'RETAIN')
ON CONFLICT (data_domain) DO NOTHING;

-- Query optimization for marketplace operational paths.
CREATE INDEX IF NOT EXISTS idx_payments_reconciliation_scan
  ON public.payments(settlement_status, created_at DESC)
  WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_transfer_lookup
  ON public.payments(razorpay_transfer_id)
  WHERE razorpay_transfer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_created_desc ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_dairy_created ON public.orders(dairy_id, created_at DESC);

-- RLS-ready controls. Service-role backend bypasses RLS; authenticated clients can
-- be given JWT claims such as dairy_id/customer_id/admin_role for direct Supabase use.
ALTER TABLE public.financial_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immutable_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_mismatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_financial_ledger ON public.financial_ledger_entries;
CREATE POLICY service_role_all_financial_ledger ON public.financial_ledger_entries
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS service_role_all_settlement_ledger ON public.settlement_ledger_entries;
CREATE POLICY service_role_all_settlement_ledger ON public.settlement_ledger_entries
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS service_role_all_immutable_audit ON public.immutable_audit_logs;
CREATE POLICY service_role_all_immutable_audit ON public.immutable_audit_logs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS service_role_all_reconciliation_mismatches ON public.reconciliation_mismatches;
CREATE POLICY service_role_all_reconciliation_mismatches ON public.reconciliation_mismatches
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS service_role_all_reconciliation_snapshots ON public.reconciliation_snapshots;
CREATE POLICY service_role_all_reconciliation_snapshots ON public.reconciliation_snapshots
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS service_role_all_fraud_alerts ON public.fraud_alerts;
CREATE POLICY service_role_all_fraud_alerts ON public.fraud_alerts
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS service_role_all_security_events ON public.security_events;
CREATE POLICY service_role_all_security_events ON public.security_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Partitioning strategy:
-- Existing production tables are left intact. For high-volume deployments, create
-- monthly partitions for webhook/security/audit archives and migrate old rows with
-- online backfill jobs. New immutable ledgers above are indexed by created_at so
-- they can be promoted to RANGE partitions during a zero-downtime maintenance run.

-- ============================================
-- Direct UPI Billing & Payment Tracking
-- ============================================
-- This section supports the direct customer -> dairy owner payment model.
-- It does not require Razorpay Route, RazorpayX, linked accounts, payouts, or commissions.

ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS payment_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS upi_qr_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS bank_transfer_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.dairies
  ADD COLUMN IF NOT EXISTS payment_verification_mode VARCHAR(30) DEFAULT 'MANUAL';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS monthly_bill_id BIGINT;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(40) DEFAULT 'NOT_SUBMITTED';
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS utr_number VARCHAR(80);
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS verified_by_admin_id BIGINT;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS verification_note TEXT;

CREATE TABLE IF NOT EXISTS public.monthly_bills (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  billing_month VARCHAR(7) NOT NULL,
  bill_number VARCHAR(60) NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  adjustments NUMERIC(12, 2) NOT NULL DEFAULT 0,
  previous_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  due_date DATE,
  invoice_url TEXT,
  invoice_payload JSONB DEFAULT '{}'::jsonb,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, dairy_id, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_bills_customer_id ON public.monthly_bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_monthly_bills_dairy_id ON public.monthly_bills(dairy_id);
CREATE INDEX IF NOT EXISTS idx_monthly_bills_status ON public.monthly_bills(status);
CREATE INDEX IF NOT EXISTS idx_monthly_bills_due_date ON public.monthly_bills(due_date);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_payments_monthly_bill_id'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT fk_payments_monthly_bill_id
      FOREIGN KEY (monthly_bill_id) REFERENCES public.monthly_bills(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payment_verifications (
  id BIGSERIAL PRIMARY KEY,
  payment_id BIGINT REFERENCES public.payments(id) ON DELETE SET NULL,
  monthly_bill_id BIGINT REFERENCES public.monthly_bills(id) ON DELETE SET NULL,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  method VARCHAR(40) NOT NULL DEFAULT 'UPI',
  utr_number VARCHAR(80) NOT NULL,
  payer_upi_id VARCHAR(255),
  screenshot_url TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  ocr_status VARCHAR(40) DEFAULT 'NOT_RUN',
  ocr_payload JSONB DEFAULT '{}'::jsonb,
  duplicate_check JSONB DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by_admin_id BIGINT REFERENCES public.admins(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_verifications_payment_id ON public.payment_verifications(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_bill_id ON public.payment_verifications(monthly_bill_id);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_customer_id ON public.payment_verifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_dairy_status ON public.payment_verifications(dairy_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_submitted_at ON public.payment_verifications(submitted_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_verifications_dairy_utr
  ON public.payment_verifications(dairy_id, lower(utr_number))
  WHERE status <> 'REJECTED';

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_type VARCHAR(40) NOT NULL,
  actor_id BIGINT,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120),
  action VARCHAR(120) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(80),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_dairy_id ON public.audit_logs(dairy_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

CREATE TABLE IF NOT EXISTS public.reminders (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  payment_id BIGINT REFERENCES public.payments(id) ON DELETE SET NULL,
  monthly_bill_id BIGINT REFERENCES public.monthly_bills(id) ON DELETE SET NULL,
  reminder_type VARCHAR(60) NOT NULL DEFAULT 'PAYMENT_DUE',
  channel VARCHAR(40) NOT NULL DEFAULT 'WHATSAPP',
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  payload JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reminders_customer_id ON public.reminders(customer_id);
CREATE INDEX IF NOT EXISTS idx_reminders_dairy_status ON public.reminders(dairy_id, status);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_for ON public.reminders(scheduled_for);

CREATE INDEX IF NOT EXISTS idx_payments_monthly_bill_id ON public.payments(monthly_bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_verification_status ON public.payments(verification_status);
CREATE INDEX IF NOT EXISTS idx_payments_utr_number ON public.payments(utr_number);

-- ============================================
-- Production Dairy Billing, Verification & Delivery Extensions
-- ============================================
-- These additive changes support direct UPI verification, advanced invoices,
-- reports, routes, subscription flexibility, and future provider integrations
-- without introducing marketplace settlements or commission routing.

ALTER TABLE public.monthly_bills
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(7, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gstin VARCHAR(20),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS late_fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(80),
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS share_token VARCHAR(120),
  ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(40) DEFAULT 'OPEN';

CREATE UNIQUE INDEX IF NOT EXISTS uq_monthly_bills_invoice_number
  ON public.monthly_bills(invoice_number)
  WHERE invoice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_monthly_bills_reconciliation_status
  ON public.monthly_bills(reconciliation_status);

ALTER TABLE public.payment_verifications
  ADD COLUMN IF NOT EXISTS screenshot_sha256 VARCHAR(64),
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_recommendation VARCHAR(60) DEFAULT 'MANUAL_REVIEW',
  ADD COLUMN IF NOT EXISTS fraud_flags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS manual_override_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_verifications_screenshot_sha
  ON public.payment_verifications(screenshot_sha256)
  WHERE screenshot_sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_verifications_confidence
  ON public.payment_verifications(confidence_score);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_fraud_flags
  ON public.payment_verifications USING GIN(fraud_flags);

CREATE TABLE IF NOT EXISTS public.ocr_processing_logs (
  id BIGSERIAL PRIMARY KEY,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  payment_id BIGINT REFERENCES public.payments(id) ON DELETE SET NULL,
  screenshot_sha256 VARCHAR(64),
  provider VARCHAR(80) NOT NULL,
  status VARCHAR(40) NOT NULL,
  confidence_score INTEGER DEFAULT 0,
  extracted_payload JSONB DEFAULT '{}'::jsonb,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ocr_processing_logs_dairy_status
  ON public.ocr_processing_logs(dairy_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocr_processing_logs_screenshot
  ON public.ocr_processing_logs(screenshot_sha256)
  WHERE screenshot_sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.customer_wallet_ledger (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE SET NULL,
  payment_id BIGINT REFERENCES public.payments(id) ON DELETE SET NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(12, 2),
  reason VARCHAR(120) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_ledger_customer
  ON public.customer_wallet_ledger(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_ledger_dairy
  ON public.customer_wallet_ledger(dairy_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_adjustments (
  id BIGSERIAL PRIMARY KEY,
  monthly_bill_id BIGINT REFERENCES public.monthly_bills(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  adjustment_type VARCHAR(50) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reason TEXT,
  created_by_admin_id BIGINT REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_adjustments_bill
  ON public.billing_adjustments(monthly_bill_id);
CREATE INDEX IF NOT EXISTS idx_billing_adjustments_dairy
  ON public.billing_adjustments(dairy_id, created_at DESC);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku VARCHAR(80),
  ADD COLUMN IF NOT EXISTS min_stock_level NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(7, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_subscription_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_products_low_stock
  ON public.products(dairy_id, is_active, stock_quantity, min_stock_level);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(50) DEFAULT 'DAILY',
  ADD COLUMN IF NOT EXISTS paused_from DATE,
  ADD COLUMN IF NOT EXISTS paused_until DATE,
  ADD COLUMN IF NOT EXISTS vacation_mode BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS product_items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS temporary_changes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS family_plan_size INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS plan_version INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_subscriptions_schedule_status
  ON public.subscriptions(dairy_id, schedule_type, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_product_items
  ON public.subscriptions USING GIN(product_items);

CREATE TABLE IF NOT EXISTS public.subscription_change_requests (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  request_type VARCHAR(80) NOT NULL,
  requested_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from DATE,
  effective_until DATE,
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  reviewed_by_admin_id BIGINT REFERENCES public.admins(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_change_requests_status
  ON public.subscription_change_requests(dairy_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.delivery_routes (
  id BIGSERIAL PRIMARY KEY,
  dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  route_name VARCHAR(150) NOT NULL,
  agent_id BIGINT REFERENCES public.agents(id) ON DELETE SET NULL,
  service_area JSONB DEFAULT '{}'::jsonb,
  planned_sequence JSONB DEFAULT '[]'::jsonb,
  optimization_score NUMERIC(8, 2),
  status VARCHAR(40) DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_routes_dairy_agent
  ON public.delivery_routes(dairy_id, agent_id, status);

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS route_id BIGINT REFERENCES public.delivery_routes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(12),
  ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS proof_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS latitude_delivered DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude_delivered DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS missed_reason TEXT,
  ADD COLUMN IF NOT EXISTS sequence_no INTEGER;

CREATE INDEX IF NOT EXISTS idx_deliveries_route_date
  ON public.deliveries(route_id, delivery_date, sequence_no);

CREATE TABLE IF NOT EXISTS public.agent_attendance (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE SET NULL,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_at TIMESTAMP WITH TIME ZONE,
  check_out_at TIMESTAMP WITH TIME ZONE,
  check_in_location JSONB,
  check_out_location JSONB,
  status VARCHAR(40) DEFAULT 'PRESENT',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_agent_attendance_dairy_date
  ON public.agent_attendance(dairy_id, attendance_date DESC);

CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
  id BIGSERIAL PRIMARY KEY,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE CASCADE,
  run_type VARCHAR(80) NOT NULL DEFAULT 'DAILY',
  status VARCHAR(40) NOT NULL DEFAULT 'STARTED',
  checked_count INTEGER DEFAULT 0,
  matched_count INTEGER DEFAULT 0,
  mismatch_count INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_dairy
  ON public.reconciliation_runs(dairy_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_events (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  channel VARCHAR(40) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'QUEUED',
  destination TEXT,
  template_key VARCHAR(120),
  payload JSONB DEFAULT '{}'::jsonb,
  provider_response JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  attempt_count INTEGER DEFAULT 0,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_notification_events_dairy_status
  ON public.notification_events(dairy_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_events_customer
  ON public.notification_events(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.analytics_daily_snapshots (
  id BIGSERIAL PRIMARY KEY,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  metric_key VARCHAR(120) NOT NULL,
  metric_value NUMERIC(16, 4) NOT NULL DEFAULT 0,
  dimensions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dairy_id, snapshot_date, metric_key, dimensions)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_snapshots_dairy_date
  ON public.analytics_daily_snapshots(dairy_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS public.job_execution_logs (
  id BIGSERIAL PRIMARY KEY,
  job_key VARCHAR(120) NOT NULL,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE SET NULL,
  status VARCHAR(40) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  result_payload JSONB DEFAULT '{}'::jsonb,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_execution_logs_job_started
  ON public.job_execution_logs(job_key, started_at DESC);

-- ============================================
-- Create App Settings Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id BIGSERIAL PRIMARY KEY,
  setting_key VARCHAR(120) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type VARCHAR(50) DEFAULT 'string',
  description TEXT,
  is_sensitive BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_settings_key
  ON public.app_settings(setting_key);

CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at
  ON public.app_settings(updated_at DESC);
