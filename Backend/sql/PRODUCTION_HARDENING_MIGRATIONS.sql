-- Production hardening migrations for 100k-customer scale.
-- Run after SUPABASE_MIGRATIONS.sql. Review in staging before production.

BEGIN;

-- ============================================
-- Authentication/session hardening
-- ============================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(80);

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_secret_encrypted JSONB,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(80);

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(80);

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id BIGSERIAL PRIMARY KEY,
  actor_type VARCHAR(30) NOT NULL CHECK (actor_type IN ('CUSTOMER', 'ADMIN', 'AGENT')),
  actor_id BIGINT NOT NULL,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE SET NULL,
  refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,
  access_token_jti VARCHAR(64),
  session_version INTEGER NOT NULL DEFAULT 1,
  device_id VARCHAR(120),
  device_label VARCHAR(255),
  ip_address VARCHAR(80),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_reason VARCHAR(120)
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_actor
  ON public.auth_sessions(actor_type, actor_id, revoked_at, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_dairy
  ON public.auth_sessions(dairy_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires
  ON public.auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS public.auth_token_revocations (
  id BIGSERIAL PRIMARY KEY,
  token_jti VARCHAR(64) NOT NULL UNIQUE,
  actor_type VARCHAR(30) CHECK (actor_type IN ('CUSTOMER', 'ADMIN', 'AGENT')),
  actor_id BIGINT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(120)
);

CREATE INDEX IF NOT EXISTS idx_auth_token_revocations_expires
  ON public.auth_token_revocations(expires_at);

CREATE TABLE IF NOT EXISTS public.otp_challenges (
  id BIGSERIAL PRIMARY KEY,
  actor_type VARCHAR(30) NOT NULL CHECK (actor_type IN ('CUSTOMER', 'ADMIN', 'AGENT')),
  actor_id BIGINT,
  destination VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL CHECK (purpose IN ('LOGIN', 'EMAIL_VERIFY', 'PASSWORD_RESET', 'MFA')),
  otp_hash VARCHAR(255) NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  ip_address VARCHAR(80),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  consumed_at TIMESTAMP WITH TIME ZONE,
  locked_until TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_lookup
  ON public.otp_challenges(destination, purpose, expires_at DESC)
  WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_otp_challenges_actor
  ON public.otp_challenges(actor_type, actor_id, created_at DESC);

-- ============================================
-- Abuse protection and auditability
-- ============================================
CREATE TABLE IF NOT EXISTS public.api_rate_limit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_type VARCHAR(30),
  actor_id BIGINT,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE SET NULL,
  ip_address VARCHAR(80),
  route_key VARCHAR(160) NOT NULL,
  limit_key VARCHAR(255) NOT NULL,
  action VARCHAR(40) NOT NULL CHECK (action IN ('ALLOW', 'WARN', 'BLOCK')),
  request_count INTEGER NOT NULL DEFAULT 1,
  window_seconds INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limit_events_key
  ON public.api_rate_limit_events(limit_key, route_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_rate_limit_events_dairy
  ON public.api_rate_limit_events(dairy_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_action_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT REFERENCES public.admins(id) ON DELETE SET NULL,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE SET NULL,
  action VARCHAR(160) NOT NULL,
  entity_type VARCHAR(80),
  entity_id VARCHAR(120),
  before_data JSONB,
  after_data JSONB,
  ip_address VARCHAR(80),
  user_agent TEXT,
  correlation_id VARCHAR(128),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_action_audit_dairy_created
  ON public.admin_action_audit_logs(dairy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_action_audit_entity
  ON public.admin_action_audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS public.tenant_api_keys (
  id BIGSERIAL PRIMARY KEY,
  dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  label VARCHAR(160),
  scopes TEXT[] NOT NULL DEFAULT '{}',
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_dairy
  ON public.tenant_api_keys(dairy_id, revoked_at, expires_at);

-- ============================================
-- Hot-path constraints and indexes
-- ============================================
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(160),
  ADD COLUMN IF NOT EXISTS generated_source VARCHAR(50) DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS generation_job_id VARCHAR(120);

CREATE UNIQUE INDEX IF NOT EXISTS uq_deliveries_idempotency_key
  ON public.deliveries(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_customer_date
  ON public.deliveries(customer_id, delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_dairy_status_date
  ON public.deliveries(dairy_id, status, delivery_date DESC);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(160),
  ADD COLUMN IF NOT EXISTS provider_event_id VARCHAR(160);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_idempotency_key
  ON public.payments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_dairy_status_created
  ON public.payments(dairy_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_customer_created
  ON public.payments(customer_id, created_at DESC);

ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(160),
  ADD COLUMN IF NOT EXISTS provider_event_id VARCHAR(160),
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_events_idempotency_key
  ON public.notification_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_events_retry
  ON public.notification_events(status, next_attempt_at)
  WHERE status IN ('QUEUED', 'RETRY');

CREATE INDEX IF NOT EXISTS idx_monthly_bills_dairy_month_status
  ON public.monthly_bills(dairy_id, billing_month, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_dairy_created
  ON public.audit_logs(dairy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity_created
  ON public.security_events(severity, created_at DESC);

-- ============================================
-- Dashboard read models
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_daily_snapshots (
  id BIGSERIAL PRIMARY KEY,
  dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  delivery_total INTEGER NOT NULL DEFAULT 0,
  delivery_completed INTEGER NOT NULL DEFAULT 0,
  delivery_failed INTEGER NOT NULL DEFAULT 0,
  payment_due NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payment_collected NUMERIC(14, 2) NOT NULL DEFAULT 0,
  active_customer_count INTEGER NOT NULL DEFAULT 0,
  active_agent_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dairy_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_admin_daily_snapshots_dairy_date
  ON public.admin_daily_snapshots(dairy_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS public.customer_dashboard_snapshots (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dairy_id BIGINT REFERENCES public.dairies(id) ON DELETE CASCADE,
  snapshot_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(customer_id, dairy_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_dashboard_snapshots_expires
  ON public.customer_dashboard_snapshots(expires_at);

-- ============================================
-- Partitioning plan helpers
-- ============================================
-- Existing non-partitioned tables cannot be converted safely in-place by this
-- script without a staged data migration. For production, create partitioned
-- replacements for deliveries/payments/audit/security/notification tables,
-- backfill in batches, swap names during maintenance, then attach monthly
-- partitions. Keep this marker table to track partition creation jobs.

CREATE TABLE IF NOT EXISTS public.partition_maintenance_runs (
  id BIGSERIAL PRIMARY KEY,
  table_name VARCHAR(120) NOT NULL,
  partition_name VARCHAR(160) NOT NULL,
  range_from DATE NOT NULL,
  range_to DATE NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'CREATED',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(table_name, partition_name)
);

COMMIT;
