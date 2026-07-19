import { supabase } from "../../config/supabase.js";
import bcrypt from "bcryptjs";

// Fetch all dairies with aggregates (customers, orders, revenue) and filtering
export const fetchDairies = async (req, res) => {
  try {
    const { status, plan, city, state, search } = req.query || {};

    let query = supabase.from("dairies").select("*");

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }
    if (plan && plan !== "ALL") {
      if (plan === "STARTER") {
        query = query.in("selected_plan", ["STARTER", "FREE"]);
      } else if (plan === "ENTERPRISE") {
        query = query.in("selected_plan", ["ENTERPRISE", "PRIME"]);
      } else {
        query = query.eq("selected_plan", plan);
      }
    }
    if (city) {
      query = query.ilike("city", `%${city}%`);
    }
    if (state) {
      query = query.ilike("state", `%${state}%`);
    }
    if (search) {
      query = query.or(`dairy_name.ilike.%${search}%,owner_name.ilike.%${search}%,dairy_email.ilike.%${search}%`);
    }

    const { data: dairies, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    if (!dairies || dairies.length === 0) {
      return res.json({ success: true, dairies: [] });
    }

    const dairyIds = dairies.map(d => d.id);

    // Parallel aggregates across related tables
    const [customersAgg, ordersAgg, paymentsAgg] = await Promise.all([
      supabase.from("customers").select("dairy_id").in("dairy_id", dairyIds),
      supabase.from("orders").select("dairy_id, final_amount, order_status").in("dairy_id", dairyIds),
      supabase.from("payments").select("dairy_id, amount, status").in("dairy_id", dairyIds),
    ]);

    // Build lookup maps
    const customerMap = {};
    const orderMap = {};
    const revenueMap = {};

    (customersAgg.data || []).forEach(c => {
      customerMap[c.dairy_id] = (customerMap[c.dairy_id] || 0) + 1;
    });

    (ordersAgg.data || []).forEach(o => {
      orderMap[o.dairy_id] = (orderMap[o.dairy_id] || 0) + 1;
    });

    (paymentsAgg.data || []).filter(p => p.status === "PAID").forEach(p => {
      revenueMap[p.dairy_id] = (revenueMap[p.dairy_id] || 0) + Number(p.amount || 0);
    });

    // Merge aggregates into dairy object
    const enrichedDairies = dairies.map(d => ({
      ...d,
      totalCustomers: customerMap[d.id] || 0,
      totalOrders: orderMap[d.id] || 0,
      totalRevenue: Number((revenueMap[d.id] || 0).toFixed(2)),
    }));

    res.json({ success: true, dairies: enrichedDairies });
  } catch (err) {
    console.error("Fetch Dairies Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Update Dairy status (Activate / Suspend)
export const updateDairyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!["ACTIVE", "SUSPENDED"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status value" });
    }

    const { data: updated, error } = await supabase
      .from("dairies")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Log the audit event
    await supabase.from("super_admin_audit_logs").insert({
      super_admin_id: req.superAdmin.id,
      action: `DAIRY_${status}`,
      entity_type: "dairy",
      entity_id: String(id),
      details: { dairy_name: updated.dairy_name },
    });

    res.json({ success: true, dairy: updated });
  } catch (err) {
    console.error("Update Dairy Status Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Upgrade Subscription plan manually
export const upgradeDairySubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, billingCycle } = req.body || {};

    if (!plan || !billingCycle) {
      return res.status(400).json({ success: false, error: "Plan and billingCycle are required" });
    }

    const { data: dairy, error: getErr } = await supabase
      .from("dairies")
      .select("id, dairy_name")
      .eq("id", id)
      .single();
    if (getErr) throw getErr;

    // Update selected_plan
    const { error: updErr } = await supabase
      .from("dairies")
      .update({ selected_plan: plan, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (updErr) throw updErr;

    // Create entry in platform_subscriptions
    const startDate = new Date();
    const endDate = new Date();
    if (billingCycle === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    await supabase.from("platform_subscriptions").insert({
      dairy_id: id,
      plan_key: plan,
      billing_cycle: billingCycle,
      amount: (plan === "PRIME" || plan === "ENTERPRISE") ? 2499 : plan === "GROWTH" ? 999 : (plan === "STARTER" ? 499 : 0),
      payable_amount: (plan === "PRIME" || plan === "ENTERPRISE") ? 2499 : plan === "GROWTH" ? 999 : (plan === "STARTER" ? 499 : 0),
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      status: "ACTIVE",
    });

    // Audit Log
    await supabase.from("super_admin_audit_logs").insert({
      super_admin_id: req.superAdmin.id,
      action: "UPGRADE_PLAN_MANUAL",
      entity_type: "dairy",
      entity_id: String(id),
      details: { plan, billingCycle, dairy_name: dairy.dairy_name },
    });

    res.json({ success: true, message: "Subscription plan updated successfully" });
  } catch (err) {
    console.error("Upgrade Subscription Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Reset Owner Password
export const resetOwnerPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body || {};

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    // Get admin email linked to the dairy
    const { data: adminUser, error: getErr } = await supabase
      .from("admins")
      .select("id, email")
      .eq("dairy_id", id)
      .limit(1)
      .maybeSingle();

    if (getErr) throw getErr;
    if (!adminUser) {
      return res.status(404).json({ success: false, error: "No admin owner account found for this dairy" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error: updErr } = await supabase
      .from("admins")
      .update({ password: hashedPassword })
      .eq("id", adminUser.id);

    if (updErr) throw updErr;

    // Audit log
    await supabase.from("super_admin_audit_logs").insert({
      super_admin_id: req.superAdmin.id,
      action: "RESET_DAIRY_OWNER_PASSWORD",
      entity_type: "admin",
      entity_id: String(adminUser.id),
      details: { email: adminUser.email },
    });

    res.json({ success: true, message: "Owner password updated successfully" });
  } catch (err) {
    console.error("Reset Owner Password Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete Dairy
export const deleteDairy = async (req, res) => {
  try {
    const { id } = req.params;

    // Get details for logging
    const { data: dairy, error: getErr } = await supabase
      .from("dairies")
      .select("id, dairy_name")
      .eq("id", id)
      .single();

    if (getErr) throw getErr;

    const { error } = await supabase.from("dairies").delete().eq("id", id);
    if (error) throw error;

    // Log audit event
    await supabase.from("super_admin_audit_logs").insert({
      super_admin_id: req.superAdmin.id,
      action: "DELETE_DAIRY",
      entity_type: "dairy",
      entity_id: String(id),
      details: { dairy_name: dairy.dairy_name },
    });

    res.json({ success: true, message: "Dairy deleted successfully" });
  } catch (err) {
    console.error("Delete Dairy Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
