import { supabase } from "../config/supabase.js";

async function run() {
  try {
    const { data, error } = await supabase
      .from("super_admins")
      .select("id")
      .limit(1);
      
    if (error) {
      console.log("❌ Table check error:", error.message);
    } else {
      console.log("✅ super_admins table exists!", data);
    }
  } catch (err) {
    console.error("❌ Exception:", err.message);
  }
}

run();
