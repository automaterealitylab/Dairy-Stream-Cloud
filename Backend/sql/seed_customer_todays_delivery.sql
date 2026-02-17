-- Seed: Today's delivery + assigned agent for customer dashboard tracking
-- Run this in Supabase SQL Editor after replacing the target emails.

-- 1) Set your target customer and agent by email
WITH target_customer AS (
  SELECT id, dairy_id
  FROM public.customers
  WHERE email = 'customer1@example.com'
  LIMIT 1
),
target_agent AS (
  SELECT id, dairy_id
  FROM public.agents
  WHERE email = 'agent1@example.com'
  LIMIT 1
)
INSERT INTO public.deliveries (
  customer_id,
  dairy_id,
  agent_id,
  delivery_date,
  milk_type,
  quantity_liters,
  status,
  notes
)
SELECT
  c.id,
  COALESCE(c.dairy_id, a.dairy_id),
  a.id,
  CURRENT_DATE,
  'Cow Milk',
  1.0,
  'PENDING',
  'Seeded row for today delivery tracking'
FROM target_customer c
LEFT JOIN target_agent a ON true
WHERE c.id IS NOT NULL;

-- 2) Optional: insert a delivered record for yesterday (history preview)
WITH target_customer AS (
  SELECT id, dairy_id
  FROM public.customers
  WHERE email = 'customer1@example.com'
  LIMIT 1
),
target_agent AS (
  SELECT id, dairy_id
  FROM public.agents
  WHERE email = 'agent1@example.com'
  LIMIT 1
)
INSERT INTO public.deliveries (
  customer_id,
  dairy_id,
  agent_id,
  delivery_date,
  milk_type,
  quantity_liters,
  status,
  delivered_at,
  notes
)
SELECT
  c.id,
  COALESCE(c.dairy_id, a.dairy_id),
  a.id,
  CURRENT_DATE - INTERVAL '1 day',
  'Cow Milk',
  1.0,
  'DELIVERED',
  NOW() - INTERVAL '1 day',
  'Seeded row for delivery history'
FROM target_customer c
LEFT JOIN target_agent a ON true
WHERE c.id IS NOT NULL;
