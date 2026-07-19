import { supabase } from "../config/supabase.js";

async function run() {
  console.log("Testing Supabase JS Client over HTTPS...");
  console.log("Supabase URL:", process.env.SUPABASE_URL);
  
  try {
    const { data, error } = await supabase
      .from("dairies")
      .select("id, dairy_name")
      .limit(3);
      
    if (error) {
      console.error("❌ Supabase Client Error:", error.message);
    } else {
      console.log("✅ Success! Fetched dairies:", data);
    }
  } catch (err) {
    console.error("❌ Exception:", err.message);
  }
}

run();
