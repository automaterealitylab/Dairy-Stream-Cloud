import { supabase } from "../../config/supabase.js";

// Fetch all plans
export const fetchPlans = async (req, res) => {
  try {
    const { data: plans, error } = await supabase
      .from("platform_plans")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;

    res.json({ success: true, plans });
  } catch (err) {
    console.error("Fetch Plans Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Create a subscription plan
export const createPlan = async (req, res) => {
  try {
    const { planKey, name, monthlyPrice, yearlyPrice, gstPercent, trialPeriodDays, features } = req.body || {};

    if (!planKey || !name || monthlyPrice === undefined || yearlyPrice === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const { data: plan, error } = await supabase
      .from("platform_plans")
      .insert({
        plan_key: String(planKey).toUpperCase(),
        name,
        monthly_price: Number(monthlyPrice),
        yearly_price: Number(yearlyPrice),
        gst_percent: Number(gstPercent || 18.00),
        trial_period_days: Number(trialPeriodDays || 14),
        features: features || [],
        status: "ACTIVE"
      })
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("super_admin_audit_logs").insert({
      super_admin_id: req.superAdmin.id,
      action: "CREATE_PLAN",
      entity_type: "platform_plan",
      entity_id: String(plan.id),
      details: { plan_key: plan.plan_key, name: plan.name },
    });

    res.json({ success: true, plan });
  } catch (err) {
    console.error("Create Plan Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Update a subscription plan
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, monthlyPrice, yearlyPrice, gstPercent, trialPeriodDays, features, status } = req.body || {};

    const { data: plan, error } = await supabase
      .from("platform_plans")
      .update({
        name,
        monthly_price: monthlyPrice !== undefined ? Number(monthlyPrice) : undefined,
        yearly_price: yearlyPrice !== undefined ? Number(yearlyPrice) : undefined,
        gst_percent: gstPercent !== undefined ? Number(gstPercent) : undefined,
        trial_period_days: trialPeriodDays !== undefined ? Number(trialPeriodDays) : undefined,
        features,
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("super_admin_audit_logs").insert({
      super_admin_id: req.superAdmin.id,
      action: "UPDATE_PLAN",
      entity_type: "platform_plan",
      entity_id: String(id),
      details: { plan_key: plan.plan_key, name: plan.name },
    });

    res.json({ success: true, plan });
  } catch (err) {
    console.error("Update Plan Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete a subscription plan
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    // Get key for logging
    const { data: plan, error: getErr } = await supabase
      .from("platform_plans")
      .select("id, plan_key")
      .eq("id", id)
      .single();

    if (getErr) throw getErr;

    const { error } = await supabase.from("platform_plans").delete().eq("id", id);
    if (error) throw error;

    // Log audit
    await supabase.from("super_admin_audit_logs").insert({
      super_admin_id: req.superAdmin.id,
      action: "DELETE_PLAN",
      entity_type: "platform_plan",
      entity_id: String(id),
      details: { plan_key: plan.plan_key },
    });

    res.json({ success: true, message: "Subscription plan deleted successfully" });
  } catch (err) {
    console.error("Delete Plan Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
