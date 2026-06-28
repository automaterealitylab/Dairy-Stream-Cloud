import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("STATS_RESULT_START");
  
  // Find dairies that actually have non-zero pending payments or customers
  // To optimize, let's query the payments table directly to find which dairy_ids have pending payments
  const { data: activeDairiesPayments, error: payError } = await supabase
    .from("payments")
    .select("dairy_id, amount")
    .in("status", ["PENDING", "OVERDUE"]);

  if (payError) {
    console.error("Error fetching payments:", payError);
    return;
  }

  const dairyAmounts = {};
  for (const row of activeDairiesPayments || []) {
    if (row.dairy_id) {
      dairyAmounts[row.dairy_id] = (dairyAmounts[row.dairy_id] || 0) + Number(row.amount || 0);
    }
  }

  const dairyIds = Object.keys(dairyAmounts);
  console.log(`Found ${dairyIds.length} dairies with active PENDING/OVERDUE payments.`);

  if (dairyIds.length === 0) {
    console.log("No dairies found with pending/overdue payments.");
    console.log("STATS_RESULT_END");
    return;
  }

  // Fetch dairy details for these IDs
  const { data: dairies, error: dairiesError } = await supabase
    .from("dairies")
    .select("id, dairy_name")
    .in("id", dairyIds.map(Number));

  if (dairiesError) {
    console.error("Error fetching dairies:", dairiesError);
    return;
  }

  for (const dairy of dairies) {
    const pendingPayments = dairyAmounts[dairy.id] || 0;

    // Fetch outstanding balance from customers for this dairy
    const { data: customersData, error: customersError } = await supabase
      .from("customers")
      .select("outstanding_balance")
      .eq("dairy_id", dairy.id);

    if (customersError) {
      console.error(`Error fetching customers for dairy ${dairy.id}:`, customersError);
      continue;
    }

    const customerOutstanding = (customersData || []).reduce(
      (sum, row) => sum + Math.max(0, Number(row.outstanding_balance || 0)),
      0
    );

    console.log(`Dairy: ${dairy.dairy_name} (ID: ${dairy.id})`);
    console.log(`- Pending Payments Total (unpaid invoices): ₹${pendingPayments.toFixed(2)}`);
    console.log(`- Net Outstanding Balance Total (amount actually owed): ₹${customerOutstanding.toFixed(2)}`);
  }
  
  console.log("STATS_RESULT_END");
}

run();
