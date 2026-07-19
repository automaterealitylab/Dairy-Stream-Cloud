import pg from "pg";
import bcrypt from "bcryptjs";
import "../config/loadEnv.js";

const { Client } = pg;

async function run() {
  const projectRef = process.env.SUPABASE_PROJECT_REF || "drncjxojfmepvsupjaut";
  const password = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Try pooler in all possible Supabase regions
  const hosts = [
    `aws-0-us-east-1.pooler.supabase.com`,
    `aws-0-us-east-2.pooler.supabase.com`,
    `aws-0-us-west-1.pooler.supabase.com`,
    `aws-0-us-west-2.pooler.supabase.com`,
    `aws-0-ap-south-1.pooler.supabase.com`,
    `aws-0-ap-southeast-1.pooler.supabase.com`,
    `aws-0-ap-southeast-2.pooler.supabase.com`,
    `aws-0-ap-northeast-1.pooler.supabase.com`,
    `aws-0-ap-northeast-2.pooler.supabase.com`,
    `aws-0-eu-west-1.pooler.supabase.com`,
    `aws-0-eu-west-2.pooler.supabase.com`,
    `aws-0-eu-west-3.pooler.supabase.com`,
    `aws-0-eu-central-1.pooler.supabase.com`,
    `aws-0-ca-central-1.pooler.supabase.com`,
    `aws-0-sa-east-1.pooler.supabase.com`
  ];
  
  const ddlQuery = `
    -- 1. Create super_admins table
    CREATE TABLE IF NOT EXISTS public.super_admins (
      id BIGSERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      role VARCHAR(50) DEFAULT 'SUPER_ADMIN',
      status VARCHAR(50) DEFAULT 'ACTIVE',
      two_factor_secret TEXT,
      two_factor_enabled BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Drop existing check constraints on actor_type in auth_sessions, auth_token_revocations, otp_challenges
    DO $$
    DECLARE
      c record;
    BEGIN
      FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.auth_sessions'::regclass AND conname LIKE '%actor_type%'
      LOOP
        EXECUTE format('ALTER TABLE public.auth_sessions DROP CONSTRAINT IF EXISTS %I', c.conname);
      END LOOP;

      FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.auth_token_revocations'::regclass AND conname LIKE '%actor_type%'
      LOOP
        EXECUTE format('ALTER TABLE public.auth_token_revocations DROP CONSTRAINT IF EXISTS %I', c.conname);
      END LOOP;

      FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.otp_challenges'::regclass AND conname LIKE '%actor_type%'
      LOOP
        EXECUTE format('ALTER TABLE public.otp_challenges DROP CONSTRAINT IF EXISTS %I', c.conname);
      END LOOP;
    END $$;

    -- 3. Add updated check constraints on actor_type
    ALTER TABLE public.auth_sessions ADD CONSTRAINT chk_auth_sessions_actor_type CHECK (actor_type IN ('CUSTOMER', 'ADMIN', 'AGENT', 'SUPER_ADMIN', 'COMPANY_STAFF'));
    ALTER TABLE public.auth_token_revocations ADD CONSTRAINT chk_auth_token_revocations_actor_type CHECK (actor_type IN ('CUSTOMER', 'ADMIN', 'AGENT', 'SUPER_ADMIN', 'COMPANY_STAFF'));
    ALTER TABLE public.otp_challenges ADD CONSTRAINT chk_otp_challenges_actor_type CHECK (actor_type IN ('CUSTOMER', 'ADMIN', 'AGENT', 'SUPER_ADMIN', 'COMPANY_STAFF'));

    -- 4. Create super_admin_audit_logs table
    CREATE TABLE IF NOT EXISTS public.super_admin_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      super_admin_id BIGINT REFERENCES public.super_admins(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(100),
      entity_id VARCHAR(100),
      ip_address VARCHAR(45),
      details JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Create platform_plans table
    CREATE TABLE IF NOT EXISTS public.platform_plans (
      id BIGSERIAL PRIMARY KEY,
      plan_key VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      monthly_price NUMERIC(10, 2) NOT NULL,
      yearly_price NUMERIC(10, 2) NOT NULL,
      gst_percent NUMERIC(5, 2) DEFAULT 18.00,
      trial_period_days INTEGER DEFAULT 14,
      features JSONB NOT NULL,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. Create platform_subscriptions table
    CREATE TABLE IF NOT EXISTS public.platform_subscriptions (
      id BIGSERIAL PRIMARY KEY,
      dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
      plan_id BIGINT REFERENCES public.platform_plans(id) ON DELETE SET NULL,
      plan_key VARCHAR(50) NOT NULL,
      billing_cycle VARCHAR(20) NOT NULL,
      amount NUMERIC(10, 2) NOT NULL,
      payable_amount NUMERIC(10, 2) NOT NULL,
      trial_start_date TIMESTAMP WITH TIME ZONE,
      trial_end_date TIMESTAMP WITH TIME ZONE,
      start_date TIMESTAMP WITH TIME ZONE NOT NULL,
      end_date TIMESTAMP WITH TIME ZONE NOT NULL,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      coupon_code VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. Create platform_payments table
    CREATE TABLE IF NOT EXISTS public.platform_payments (
      id BIGSERIAL PRIMARY KEY,
      dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
      subscription_id BIGINT REFERENCES public.platform_subscriptions(id) ON DELETE SET NULL,
      amount NUMERIC(10, 2) NOT NULL,
      gateway VARCHAR(50) DEFAULT 'RAZORPAY',
      gateway_order_id VARCHAR(100),
      gateway_payment_id VARCHAR(100),
      gateway_signature VARCHAR(255),
      payment_method VARCHAR(50),
      status VARCHAR(50) DEFAULT 'PENDING',
      coupon_code VARCHAR(50),
      discount_amount NUMERIC(10, 2) DEFAULT 0.00,
      paid_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 8. Create coupons table
    CREATE TABLE IF NOT EXISTS public.coupons (
      id BIGSERIAL PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      discount_type VARCHAR(50) NOT NULL,
      discount_value NUMERIC(10, 2) DEFAULT 0.00,
      trial_extension_days INTEGER DEFAULT 0,
      start_date TIMESTAMP WITH TIME ZONE NOT NULL,
      end_date TIMESTAMP WITH TIME ZONE NOT NULL,
      max_uses INTEGER DEFAULT 999999,
      current_uses INTEGER DEFAULT 0,
      min_purchase_amount NUMERIC(10, 2) DEFAULT 0.00,
      applicable_plans JSONB,
      one_time_per_dairy BOOLEAN DEFAULT TRUE,
      area_restriction VARCHAR(255),
      is_invite_only BOOLEAN DEFAULT FALSE,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 9. Create coupon_redemptions table
    CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
      id BIGSERIAL PRIMARY KEY,
      coupon_id BIGINT NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
      coupon_code VARCHAR(50) NOT NULL,
      dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
      discount_applied NUMERIC(10, 2) NOT NULL,
      redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 10. Create website_traffic_logs table
    CREATE TABLE IF NOT EXISTS public.website_traffic_logs (
      id BIGSERIAL PRIMARY KEY,
      visitor_id VARCHAR(100) NOT NULL,
      session_id VARCHAR(100) NOT NULL,
      page_path VARCHAR(255) NOT NULL,
      referrer VARCHAR(255),
      traffic_source VARCHAR(50) DEFAULT 'DIRECT',
      is_unique BOOLEAN DEFAULT TRUE,
      session_duration_sec INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 11. Create platform_announcements table
    CREATE TABLE IF NOT EXISTS public.platform_announcements (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      announcement_type VARCHAR(50) DEFAULT 'NOTIFICATION',
      target_type VARCHAR(50) DEFAULT 'ALL',
      target_value TEXT,
      created_by BIGINT REFERENCES public.super_admins(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 12. Create support_tickets table
    CREATE TABLE IF NOT EXISTS public.support_tickets (
      id BIGSERIAL PRIMARY KEY,
      dairy_id BIGINT NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
      subject VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'OPEN',
      priority VARCHAR(20) DEFAULT 'MEDIUM',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 13. Create platform_settings table
    CREATE TABLE IF NOT EXISTS public.platform_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL,
      description TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 14. Indexes for faster analytics
    CREATE INDEX IF NOT EXISTS idx_website_traffic_logs_created_at ON public.website_traffic_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_website_traffic_logs_visitor_id ON public.website_traffic_logs(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_dairy_id ON public.platform_subscriptions(dairy_id);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
  `;

  const seedPassword = await bcrypt.hash("Admin@12345", 10);

  for (const host of hosts) {
    const connectionString = `postgresql://postgres.${projectRef}:${password}@${host}:6543/postgres`;
    console.log(`Connecting to database pooler on ${host}...`);
    
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connect_timeout: 4000
    });
    
    try {
      await client.connect();
      console.log(`Connected successfully to ${host}! Running DDL...`);
      
      // Run DDL queries
      await client.query(ddlQuery);
      console.log("DDL executed successfully!");

      // Seed Initial Super Admin
      const seedAdminQuery = `
        INSERT INTO public.super_admins (email, password, name, role, status)
        VALUES ('owner@dairystream.com', $1, 'Company Owner', 'OWNER', 'ACTIVE')
        ON CONFLICT (email) DO NOTHING;
      `;
      await client.query(seedAdminQuery, [seedPassword]);
      console.log("Seeded default super admin owner@dairystream.com successfully!");

      // Seed Default Platform Plans
      const seedPlansQuery = `
        INSERT INTO public.platform_plans (plan_key, name, monthly_price, yearly_price, gst_percent, trial_period_days, features, status)
        VALUES 
          ('FREE', 'Free Starter Plan', 0.00, 0.00, 18.00, 14, '["agents"]', 'ACTIVE'),
          ('GROWTH', 'Growth Premium Plan', 999.00, 9990.00, 18.00, 14, '["agents", "performance"]', 'ACTIVE'),
          ('PRIME', 'Prime Platform Plan', 2499.00, 24990.00, 18.00, 14, '["agents", "performance", "procurement", "suppliers"]', 'ACTIVE')
        ON CONFLICT (plan_key) DO UPDATE 
        SET monthly_price = EXCLUDED.monthly_price, yearly_price = EXCLUDED.yearly_price, features = EXCLUDED.features;
      `;
      await client.query(seedPlansQuery);
      console.log("Seeded default plans (FREE, GROWTH, PRIME) successfully!");

      await client.end();
      console.log("Database migration finished successfully!");
      process.exit(0);
    } catch (err) {
      if (!err.message.includes("tenant/user postgres.drncjxojfmepvsupjaut not found")) {
        console.error(`Host ${host} error:`, err.message);
      }
      try {
        await client.end();
      } catch (e) {}
    }
  }
  
  console.error("All pooler hosts failed to complete the migration.");
  process.exit(1);
}

run();
