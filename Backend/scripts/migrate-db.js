import pg from "pg";
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
  
  for (const host of hosts) {
    const connectionString = `postgresql://postgres.${projectRef}:${password}@${host}:6543/postgres`;
    console.log(`Connecting to database pooler on ${host}...`);
    
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connect_timeout: 3000
    });
    
    try {
      await client.connect();
      console.log(`Connected successfully to ${host}!`);
      
      const query = `
        ALTER TABLE public.dairies
          ADD COLUMN IF NOT EXISTS payment_method_one_time VARCHAR(50) DEFAULT 'DIRECT_UPI',
          ADD COLUMN IF NOT EXISTS payment_method_subscription VARCHAR(50) DEFAULT 'DIRECT_UPI';
      `;
      
      await client.query(query);
      console.log("Migration columns added successfully!");
      await client.end();
      process.exit(0);
    } catch (err) {
      if (!err.message.includes("tenant/user postgres.drncjxojfmepvsupjaut not found")) {
        console.log(`Host ${host} response:`, err.message);
      } else {
        // tenant not found in this region
      }
      try {
        await client.end();
      } catch (e) {}
    }
  }
  
  console.error("All pooler hosts failed.");
  process.exit(1);
}

run();
