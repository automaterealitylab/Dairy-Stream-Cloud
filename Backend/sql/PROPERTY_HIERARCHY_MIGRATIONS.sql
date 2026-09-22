-- ============================================================
-- PROPERTY HIERARCHY MIGRATIONS
-- Hierarchy: Society/Property -> Building -> Wing (optional) -> Floor -> Unit
-- Backward-compatible schema extension for live dairy delivery application
-- ============================================================

-- 1. PROPERTIES / SOCIETIES
CREATE TABLE IF NOT EXISTS public.properties (
  id BIGSERIAL PRIMARY KEY,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  pincode VARCHAR(20),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_properties_dairy_id ON public.properties(dairy_id);
CREATE INDEX IF NOT EXISTS idx_properties_name ON public.properties(name);

-- 2. BUILDINGS (Belongs to a Property)
CREATE TABLE IF NOT EXISTS public.buildings (
  id BIGSERIAL PRIMARY KEY,
  property_id BIGINT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_building_per_property UNIQUE (property_id, name)
);

CREATE INDEX IF NOT EXISTS idx_buildings_property_id ON public.buildings(property_id);

-- 3. WINGS / BLOCKS / SECTIONS (Optional level under Building)
CREATE TABLE IF NOT EXISTS public.wings (
  id BIGSERIAL PRIMARY KEY,
  building_id BIGINT NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_wing_per_building UNIQUE (building_id, name)
);

CREATE INDEX IF NOT EXISTS idx_wings_building_id ON public.wings(building_id);

-- 4. FLOORS (Belongs to Building, optionally attached to a Wing)
CREATE TABLE IF NOT EXISTS public.floors (
  id BIGSERIAL PRIMARY KEY,
  building_id BIGINT NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  wing_id BIGINT REFERENCES public.wings(id) ON DELETE CASCADE, -- NULL when building has no wing
  name VARCHAR(100) NOT NULL, -- e.g. "Ground Floor", "2nd Floor", "Mezzanine", "Level 2"
  floor_number NUMERIC(5, 1), -- Optional numeric sort order
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_floors_building_id ON public.floors(building_id);
CREATE INDEX IF NOT EXISTS idx_floors_wing_id ON public.floors(wing_id);

-- 5. UNITS (Belongs to a Floor)
CREATE TABLE IF NOT EXISTS public.units (
  id BIGSERIAL PRIMARY KEY,
  floor_id BIGINT NOT NULL REFERENCES public.floors(id) ON DELETE CASCADE,
  unit_type VARCHAR(50) NOT NULL DEFAULT 'Flat', -- Flat, Room, House, Shop, Office, Cabin, Other
  unit_number VARCHAR(100) NOT NULL, -- "204", "31", "12A", "M-01"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_unit_per_floor UNIQUE (floor_id, unit_type, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_units_floor_id ON public.units(floor_id);

-- 6. CUSTOMER EXTENSION (Non-destructive: All columns NULLable for existing rows)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS property_id BIGINT REFERENCES public.properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS building_id BIGINT REFERENCES public.buildings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wing_id BIGINT REFERENCES public.wings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS floor_id BIGINT REFERENCES public.floors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_id BIGINT REFERENCES public.units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS floor_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS unit_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS unit_number VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_customers_property_id ON public.customers(property_id);
CREATE INDEX IF NOT EXISTS idx_customers_building_id ON public.customers(building_id);
CREATE INDEX IF NOT EXISTS idx_customers_wing_id ON public.customers(wing_id);
CREATE INDEX IF NOT EXISTS idx_customers_floor_id ON public.customers(floor_id);
CREATE INDEX IF NOT EXISTS idx_customers_unit_id ON public.customers(unit_id);
