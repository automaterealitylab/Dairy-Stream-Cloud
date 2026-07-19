import { supabase } from "../../config/supabase.js";

// Fetch all coupons with aggregates
export const fetchCoupons = async (req, res) => {
  try {
    const { data: coupons, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ success: true, coupons });
  } catch (err) {
    console.error("Fetch Coupons Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Create a coupon code
export const createCoupon = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      trialExtensionDays,
      startDate,
      endDate,
      maxUses,
      minPurchaseAmount,
      applicablePlans,
      oneTimePerDairy,
      areaRestriction,
      isInviteOnly,
    } = req.body || {};

    if (!code || !discountType || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const { data: coupon, error } = await supabase
      .from("coupons")
      .insert({
        code: String(code).toUpperCase().trim(),
        discount_type: discountType,
        discount_value: Number(discountValue || 0),
        trial_extension_days: Number(trialExtensionDays || 0),
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        max_uses: Number(maxUses || 99999),
        min_purchase_amount: Number(minPurchaseAmount || 0),
        applicable_plans: applicablePlans || [],
        one_time_per_dairy: oneTimePerDairy ?? true,
        area_restriction: areaRestriction || null,
        is_invite_only: isInviteOnly ?? false,
        status: "ACTIVE",
      })
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("super_admin_audit_logs").insert({
      super_admin_id: req.superAdmin.id,
      action: "CREATE_COUPON",
      entity_type: "coupon",
      entity_id: String(coupon.id),
      details: { code: coupon.code, discount_type: coupon.discount_type },
    });

    res.json({ success: true, coupon });
  } catch (err) {
    console.error("Create Coupon Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete a coupon
export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: coupon, error: getErr } = await supabase
      .from("coupons")
      .select("id, code")
      .eq("id", id)
      .single();
    if (getErr) throw getErr;

    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) throw error;

    // Log audit
    await supabase.from("super_admin_audit_logs").insert({
      super_admin_id: req.superAdmin.id,
      action: "DELETE_COUPON",
      entity_type: "coupon",
      entity_id: String(id),
      details: { code: coupon.code },
    });

    res.json({ success: true, message: "Coupon deleted successfully" });
  } catch (err) {
    console.error("Delete Coupon Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Validate Coupon (Public/Platform endpoint used during dairy checkout)
export const validateCoupon = async (req, res) => {
  try {
    const { code, dairyId, planKey, purchaseAmount } = req.body || {};

    if (!code || !dairyId || !planKey || purchaseAmount === undefined) {
      return res.status(400).json({ success: false, error: "Missing validation parameters" });
    }

    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", String(code).toUpperCase().trim())
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!coupon) {
      return res.status(404).json({ success: false, error: "Coupon code does not exist" });
    }

    if (coupon.status !== "ACTIVE") {
      return res.status(400).json({ success: false, error: "This coupon is inactive" });
    }

    const now = new Date();
    if (now < new Date(coupon.start_date) || now > new Date(coupon.end_date)) {
      return res.status(400).json({ success: false, error: "This coupon has expired or is not yet active" });
    }

    if (coupon.current_uses >= coupon.max_uses) {
      return res.status(400).json({ success: false, error: "This coupon usage limit has been exceeded" });
    }

    if (Number(purchaseAmount) < Number(coupon.min_purchase_amount)) {
      return res.status(400).json({
        success: false,
        error: `Minimum purchase of ₹${coupon.min_purchase_amount} required to apply this coupon`,
      });
    }

    if (coupon.applicable_plans && coupon.applicable_plans.length > 0) {
      if (!coupon.applicable_plans.includes(String(planKey).toUpperCase())) {
        return res.status(400).json({ success: false, error: "This coupon is not applicable for the selected plan" });
      }
    }

    // Check if one_time_per_dairy constraint is violated
    if (coupon.one_time_per_dairy) {
      const { data: previousRedemption, error: prErr } = await supabase
        .from("coupon_redemptions")
        .select("id")
        .eq("coupon_id", coupon.id)
        .eq("dairy_id", dairyId)
        .limit(1)
        .maybeSingle();

      if (prErr) throw prErr;
      if (previousRedemption) {
        return res.status(400).json({ success: false, error: "This coupon has already been redeemed by your dairy" });
      }
    }

    // Calculate discount amount
    let discountApplied = 0;
    if (coupon.discount_type === "PERCENTAGE") {
      discountApplied = Number(((purchaseAmount * coupon.discount_value) / 100).toFixed(2));
    } else if (coupon.discount_type === "FLAT") {
      discountApplied = Number(coupon.discount_value);
    } else if (coupon.discount_type === "FIRST_MONTH_FREE") {
      discountApplied = Number(purchaseAmount); // 100% discount
    }

    // Discount cannot exceed original amount
    discountApplied = Math.min(discountApplied, purchaseAmount);

    res.json({
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        trialExtensionDays: coupon.trial_extension_days,
        discountApplied,
        payableAmount: Number((purchaseAmount - discountApplied).toFixed(2)),
      },
    });
  } catch (err) {
    console.error("Validate Coupon Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Fetch coupon redemption logs
export const fetchRedemptions = async (req, res) => {
  try {
    const { data: redemptions, error } = await supabase
      .from("coupon_redemptions")
      .select(`
        id,
        coupon_code,
        discount_applied,
        redeemed_at,
        dairy_id,
        dairies (
          dairy_name,
          owner_name
        )
      `)
      .order("redeemed_at", { ascending: false });

    if (error) throw error;

    res.json({ success: true, redemptions });
  } catch (err) {
    console.error("Fetch Redemptions Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
