import pg from "pg";
import "../config/loadEnv.js";

const { Client } = pg;

/**
 * Safe migration script to establish STARTER / GROWTH / PREMIUM as the canonical 3-plan matrix.
 *
 * This script:
 * 1. Adds PREMIUM plan if not exists
 * 2. Updates GROWTH price from ₹999 → ₹1,499
 * 3. Migrates legacy plan keys in platform_subscriptions and dairies.selected_plan:
 *    - FREE → STARTER
 *    - PRIME → PREMIUM
 *    - ENTERPRISE → PREMIUM
 * 4. Uses ON CONFLICT for idempotency
 * 5. Logs all changes for audit trail
 */

async function run() {
  const projectRef = process.env.SUPABASE_PROJECT_REF || "";
  const password = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!projectRef || !password) {
    console.error("Missing SUPABASE_PROJECT_REF or SUPABASE_SERVICE_ROLE_KEY environment variables");
    process.exit(1);
  }

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

  const migrationQueries = [
    // 1. Add PREMIUM plan if not exists (idempotent)
    `
    INSERT INTO public.platform_plans (plan_key, name, monthly_price, yearly_price, gst_percent, trial_period_days, features, status)
    VALUES (
      'PREMIUM',
      'Premium Plan',
      2499.00,
      24990.00,
      18.00,
      14,
      '["dashboard","customers","deliveries","products","payments","profile","agents","notifications","monitoring","health","buildings","farm-plan","bank","performance","procurement","suppliers"]',
      'ACTIVE'
    )
    ON CONFLICT (plan_key) DO UPDATE
    SET monthly_price = EXCLUDED.monthly_price,
        yearly_price = EXCLUDED.yearly_price,
        features = EXCLUDED.features,
        updated_at = CURRENT_TIMESTAMP;
    `,

    // 2. Update GROWTH price from ₹999 → ₹1,499 (idempotent)
    `
    UPDATE public.platform_plans
    SET monthly_price = 1499.00,
        yearly_price = 14990.00,
        updated_at = CURRENT_TIMESTAMP
    WHERE plan_key = 'GROWTH'
      AND (monthly_price != 1499.00 OR yearly_price != 14990.00);
    `,

    // 3. Ensure STARTER has correct price (idempotent)
    `
    UPDATE public.platform_plans
    SET monthly_price = 499.00,
        yearly_price = 4990.00,
        updated_at = CURRENT_TIMESTAMP
    WHERE plan_key = 'STARTER'
      AND (monthly_price != 499.00 OR yearly_price != 4990.00);
    `,

    // 4. Migrate legacy plan_key in platform_subscriptions: FREE → STARTER
    `
    UPDATE public.platform_subscriptions
    SET plan_key = 'STARTER',
        updated_at = CURRENT_TIMESTAMP
    WHERE plan_key = 'FREE';
    `,

    // 5. Migrate legacy plan_key in platform_subscriptions: PRIME → PREMIUM
    `
    UPDATE public.platform_subscriptions
    SET plan_key = 'PREMIUM',
        updated_at = CURRENT_TIMESTAMP
    WHERE plan_key = 'PRIME';
    `,

    // 6. Migrate legacy plan_key in platform_subscriptions: ENTERPRISE → PREMIUM
    `
    UPDATE public.platform_subscriptions
    SET plan_key = 'PREMIUM',
        updated_at = CURRENT_TIMESTAMP
    WHERE plan_key = 'ENTERPRISE';
    `,

    // 7. Migrate legacy selected_plan in dairies: FREE → STARTER
    `
    UPDATE public.dairies
    SET selected_plan = 'STARTER',
        updated_at = CURRENT_TIMESTAMP
    WHERE selected_plan = 'FREE';
    `,

    // 8. Migrate legacy selected_plan in dairies: PRIME → PREMIUM
    `
    UPDATE public.dairies
    SET selected_plan = 'PREMIUM',
        updated_at = CURRENT_TIMESTAMP
    WHERE selected_plan = 'PRIME';
    `,

    // 9. Migrate legacy selected_plan in dairies: ENTERPRISE → PREMIUM
    `
    UPDATE public.dairies
    SET selected_plan = 'PREMIUM',
        updated_at = CURRENT_TIMESTAMP
    WHERE selected_plan = 'ENTERPRISE';
    `,

    // 10. Optional: Mark legacy plans as INACTIVE in platform_plans (preserve records, don't delete)
    `
    UPDATE public.platform_plans
    SET status = 'INACTIVE',
        updated_at = CURRENT_TIMESTAMP
    WHERE plan_key IN ('FREE', 'PRIME', 'ENTERPRISE')
      AND status = 'ACTIVE';
    `,
  ];

  for (const host of hosts) {
    const connectionString = `postgresql://postgres.${projectRef}:${password}@${host}:6543/postgres`;
    console.log(`Connecting to database pooler on ${host}...`);

    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connect_timeout: 10000
    });

    try {
      await client.connect();
      console.log(`Connected successfully to ${host}! Running migration...`);

      // First, check current state
      console.log("\n--- Current platform_plans ---");
      const currentPlans = await client.query(`
        SELECT plan_key, name, monthly_price, yearly_price, status
        FROM public.platform_plans
        ORDER BY id
      `);
      console.table(currentPlans.rows);

      console.log("\n--- Current platform_subscriptions plan_key distribution ---");
      const subDist = await client.query(`
        SELECT plan_key, COUNT(*) as count
        FROM public.platform_subscriptions
        GROUP BY plan_key
        ORDER BY count DESC
      `);
      console.table(subDist.rows);

      console.log("\n--- Current dairies selected_plan distribution ---");
      const dairyDist = await client.query(`
        SELECT selected_plan, COUNT(*) as count
        FROM public.dairies
        GROUP BY selected_plan
        ORDER BY count DESC
      `);
      console.table(dairyDist.rows);

      // Run migration queries
      for (let i = 0; i < migrationQueries.length; i++) {
        const query = migrationQueries[i];
        try {
          const result = await client.query(query);
          console.log(`✅ Query ${i + 1} executed successfully (${result.rowCount} rows affected)`);
        } catch (err) {
          console.error(`❌ Query ${i + 1} failed:`, err.message);
          throw err;
        }
      }

      // Verify final state
      console.log("\n--- Final platform_plans ---");
      const finalPlans = await client.query(`
        SELECT plan_key, name, monthly_price, yearly_price, status
        FROM public.platform_plans
        ORDER BY
          CASE plan_key
            WHEN 'STARTER' THEN 1
            WHEN 'GROWTH' THEN 2
            WHEN 'PREMIUM' THEN 3
            ELSE 4
          END
      `);
      console.table(finalPlans.rows);

      console.log("\n--- Final platform_subscriptions plan_key distribution ---");
      const finalSubDist = await client.query(`
        SELECT plan_key, COUNT(*) as count
        FROM public.platform_subscriptions
        GROUP BY plan_key
        ORDER BY count DESC
      `);
      console.table(finalSubDist.rows);

      console.log("\n--- Final dairies selected_plan distribution ---");
      const finalDairyDist = await client.query(`
        SELECT selected_plan, COUNT(*) as count
        FROM public.dairies
        GROUP BY selected_plan
        ORDER BY count DESC
      `);
      console.table(finalDairyDist.rows);

      await client.end();
      console.log("\n✅ Migration completed successfully!");
      process.exit(0);
    } catch (err) {
      if (!err.message.includes("tenant/user postgres") && !err.message.includes("does not exist")) {
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