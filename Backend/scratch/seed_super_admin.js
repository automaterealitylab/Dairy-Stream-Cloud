import { supabase } from "../config/supabase.js";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding super admin owner credentials...");
  
  try {
    const seedPassword = await bcrypt.hash("Admin@12345", 10);

    const { data: adminData, error: adminErr } = await supabase
      .from("super_admins")
      .upsert({
        email: "owner@dairystream.com",
        password: seedPassword,
        name: "Company Owner",
        role: "OWNER",
        status: "ACTIVE"
      }, { onConflict: "email" })
      .select();

    if (adminErr) {
      throw adminErr;
    }

    console.log("Seeded Super Admin owner@dairystream.com successfully!");

    // Seed default plans
    const { error: plansErr } = await supabase
      .from("platform_plans")
      .upsert([
        {
          plan_key: "FREE",
          name: "Free Starter Plan",
          monthly_price: 0.00,
          yearly_price: 0.00,
          gst_percent: 18.00,
          trial_period_days: 14,
          features: ["agents"],
          status: "ACTIVE"
        },
        {
          plan_key: "GROWTH",
          name: "Growth Premium Plan",
          monthly_price: 999.00,
          yearly_price: 9990.00,
          gst_percent: 18.00,
          trial_period_days: 14,
          features: ["agents", "performance"],
          status: "ACTIVE"
        },
        {
          plan_key: "PRIME",
          name: "Prime Platform Plan",
          monthly_price: 2499.00,
          yearly_price: 24990.00,
          gst_percent: 18.00,
          trial_period_days: 14,
          features: ["agents", "performance", "procurement", "suppliers"],
          status: "ACTIVE"
        }
      ], { onConflict: "plan_key" });

    if (plansErr) {
      throw plansErr;
    }

    console.log("Seeded default platform plans successfully!");
    console.log("Seed migration completed successfully! You can now log in.");
    process.exit(0);
  } catch (err) {
    console.error("Migration/seeding failed:", err.message);
    process.exit(1);
  }
}

seed();
