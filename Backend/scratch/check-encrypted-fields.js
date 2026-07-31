/**
 * Diagnostic: Check raw DB values for encrypted fields and test decryption.
 * Run: node Backend/scratch/check-encrypted-fields.js
 */
import { supabase } from "../config/supabase.js";
import { decryptDeterministic } from "../utils/crypto.js";
import "../config/loadEnv.js";

async function run() {
  console.log("=== Encrypted Fields Diagnostic ===\n");
  console.log("DATA_ENCRYPTION_KEY present:", Boolean(process.env.DATA_ENCRYPTION_KEY));
  console.log("DET_IV_SALT present:", Boolean(process.env.DET_IV_SALT), "\n");

  // 1. Check dairies table
  const { data: dairies, error: dairyError } = await supabase
    .from("dairies")
    .select("id, dairy_name, dairy_email, dairy_phone")
    .order("id", { ascending: true })
    .limit(5);

  if (dairyError) {
    console.error("Error fetching dairies:", dairyError.message);
  } else {
    console.log("=== DAIRIES TABLE (raw values) ===");
    for (const d of dairies || []) {
      console.log(`\nDairy ID: ${d.id} | Name: ${d.dairy_name}`);
      console.log(`  dairy_email (raw):    ${d.dairy_email}`);
      console.log(`  dairy_email (decrypt): ${decryptDeterministic(d.dairy_email)}`);
      console.log(`  dairy_phone (raw):    ${d.dairy_phone}`);
      console.log(`  dairy_phone (decrypt): ${decryptDeterministic(d.dairy_phone)}`);
    }
  }

  // 2. Check admins table
  const { data: admins, error: adminError } = await supabase
    .from("admins")
    .select("id, dairy_id, name, email, phone")
    .order("id", { ascending: true })
    .limit(5);

  if (adminError) {
    console.error("Error fetching admins:", adminError.message);
  } else {
    console.log("\n\n=== ADMINS TABLE (raw values) ===");
    for (const a of admins || []) {
      console.log(`\nAdmin ID: ${a.id} | Dairy ID: ${a.dairy_id} | Name: ${a.name}`);
      console.log(`  email (raw):    ${a.email}`);
      console.log(`  email (decrypt): ${decryptDeterministic(a.email)}`);
      console.log(`  phone (raw):    ${a.phone}`);
      console.log(`  phone (decrypt): ${decryptDeterministic(a.phone)}`);
    }
  }

  console.log("\n=== DONE ===");
  process.exit(0);
}

run().catch(err => {
  console.error("Script error:", err);
  process.exit(1);
});
