import { supabase } from "../config/supabase.js";

async function check() {
  try {
    const { data, error } = await supabase
      .from("dairies")
      .select("id, upi_id")
      .limit(1);
    
    if (error) {
      console.error("Error querying dairies:", error);
      return;
    }
    
    console.log("Successfully connected and queried dairies:", data);

    const { data: colsData, error: colsError } = await supabase
      .from("dairies")
      .select("payment_method_one_time, payment_method_subscription")
      .limit(1);
      
    if (colsError) {
      console.log("Columns do not exist. Error:", colsError.message);
    } else {
      console.log("Columns already exist!", colsData);
    }
  } catch (err) {
    console.error("Exception:", err);
  }
  process.exit(0);
}

check();
