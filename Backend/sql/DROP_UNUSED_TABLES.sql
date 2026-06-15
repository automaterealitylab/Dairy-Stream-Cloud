-- Drop currently unused Supabase tables.
-- Review and run manually in the Supabase SQL Editor after taking a backup.
--
-- This list is based on backend code usage as of 2026-06-07. It excludes tables
-- that are read/written directly by controllers, services, workers, scripts, or middleware.

BEGIN;

-- delivery_routes is not used by the current backend, but deliveries.route_id
-- references it. Drop the unused column first so the table can be removed cleanly.
ALTER TABLE IF EXISTS public.deliveries
  DROP COLUMN IF EXISTS route_id;

DROP TABLE IF EXISTS public.delivery_proofs;
DROP TABLE IF EXISTS public.queue_job_logs;
DROP TABLE IF EXISTS public.consent_records;
DROP TABLE IF EXISTS public.retention_policies;
DROP TABLE IF EXISTS public.customer_wallet_ledger;
DROP TABLE IF EXISTS public.billing_adjustments;
DROP TABLE IF EXISTS public.subscription_change_requests;
DROP TABLE IF EXISTS public.delivery_routes;
DROP TABLE IF EXISTS public.agent_attendance;
DROP TABLE IF EXISTS public.reconciliation_runs;
DROP TABLE IF EXISTS public.analytics_daily_snapshots;
DROP TABLE IF EXISTS public.job_execution_logs;

COMMIT;
