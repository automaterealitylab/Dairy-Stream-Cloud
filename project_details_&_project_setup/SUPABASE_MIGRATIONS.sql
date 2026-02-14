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
  selected_plan VARCHAR(50) DEFAULT 'GROWTH',
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
CREATE INDEX IF NOT EXISTS idx_customers_dairy_id ON public.customers(dairy_id);

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

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_agents_email ON public.agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_building ON public.agents(building);
CREATE INDEX IF NOT EXISTS idx_agents_dairy_id ON public.agents(dairy_id);

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
