import pg from "pg";
import "../config/loadEnv.js";

const { Client } = pg;

async function run() {
  const projectRef = process.env.SUPABASE_PROJECT_REF || "drncjxojfmepvsupjaut";
  const password = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const connectionStrings = [
    `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`,
    `postgresql://postgres:${password}@db.${projectRef}.supabase.co:6543/postgres`,
    `postgresql://postgres.${projectRef}:${password}@db.${projectRef}.supabase.co:5432/postgres`,
    `postgresql://postgres.${projectRef}:${password}@db.${projectRef}.supabase.co:6543/postgres`
  ];

  console.log("Direct DB Connection Diagnostics...");
  console.log("Project Ref:", projectRef);

  for (let i = 0; i < connectionStrings.length; i++) {
    const cs = connectionStrings[i];
    console.log(`Trying connection string index ${i}...`);
    
    const client = new Client({
      connectionString: cs,
      ssl: { rejectUnauthorized: false },
      connect_timeout: 4000
    });
    
    try {
      await client.connect();
      console.log(`✅ Success for index ${i}!`);
      await client.end();
      return;
    } catch (err) {
      console.log(`❌ Fail index ${i}. Error: ${err.message}`);
      try {
        await client.end();
      } catch (e) {}
    }
  }
  console.log("All direct connections diagnosed.");
}

run();
