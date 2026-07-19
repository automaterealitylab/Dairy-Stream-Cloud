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

  console.log("Starting DB Connection Diagnostics...");
  console.log("Project Ref:", projectRef);
  console.log("Password length:", password?.length);

  for (const host of hosts) {
    const connectionString = `postgresql://postgres.${projectRef}:${password}@${host}:6543/postgres`;
    
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connect_timeout: 4000
    });
    
    try {
      await client.connect();
      console.log(`✅ Success! Connected to ${host}`);
      await client.end();
      return;
    } catch (err) {
      console.log(`❌ Fail: ${host}. Error: ${err.message}`);
      try {
        await client.end();
      } catch (e) {}
    }
  }
  console.log("All hosts diagnosed.");
}

run();
