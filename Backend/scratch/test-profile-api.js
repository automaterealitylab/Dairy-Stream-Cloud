/**
 * Test the admin profile API endpoint response to verify decryption happens correctly.
 * Run: node Backend/scratch/test-profile-api.js
 */
import { supabase } from "../config/supabase.js";
import { getAdminDairyProfileService } from "../services/admin/dairy.service.js";
import "../config/loadEnv.js";

async function run() {
  console.log("=== Testing getAdminDairyProfileService ===\n");

  // Find the dairy for Narhe Test (ID: 101024 from diagnostic)
  const dairyId = 101024;
  const adminId = 16; // Admin ID from diagnostic

  console.log(`Testing with dairyId=${dairyId}, adminId=${adminId}\n`);

  try {
    const result = await getAdminDairyProfileService({
      adminId,
      dairyId,
      revealBankDetails: false,
    });

    console.log("=== DAIRY FIELDS RETURNED BY SERVICE ===");
    console.log("dairy.dairy_email:", result.dairy?.dairy_email);
    console.log("dairy.dairy_phone:", result.dairy?.dairy_phone);
    console.log("dairy.bank_ifsc_code:", result.dairy?.bank_ifsc_code);
    console.log("dairy.pan:", result.dairy?.pan);
    
    console.log("\n=== ADMIN FIELDS RETURNED BY SERVICE ===");
    console.log("admin.email:", result.admin?.email);
    console.log("admin.phone:", result.admin?.phone);
    console.log("admin.name:", result.admin?.name);
    
    console.log("\n=== FULL RESPONSE (stringify) ===");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Service call failed:", err.message);
  }

  process.exit(0);
}

run().catch(err => {
  console.error("Script error:", err);
  process.exit(1);
});
