// Admin SaaS farm-plan subscription: current plan lookup, plan updates,
// one-time Razorpay order checkout, recurring subscription mandates, and
// signature verification for both flows.

import crypto from "crypto";
import Razorpay from "razorpay";
import { supabase } from "../../../config/supabase.js";
import { getRazorpayConfig } from "../../../config/razorpay.js";
import { getPlatformPlan } from "../../common/platformPlan.service.js";

export const getFarmSubscription = async ({ adminId, dairyId }) => {
  let resolvedDairyId = dairyId ?? null;

  if (!resolvedDairyId && adminId) {
    const { data: adminRow, error: adminError } = await supabase
      .from("admins")
      .select("dairy_id")
      .eq("id", adminId)
      .limit(1)
      .maybeSingle();

    if (adminError) throw adminError;
    resolvedDairyId = adminRow?.dairy_id ?? null;
  }

  if (!resolvedDairyId) return null;

  const { data: dairy, error } = await supabase
    .from("dairies")
    .select(
      "id, selected_plan, status, updated_at, bank_account_holder_name, bank_account_number, bank_ifsc_code, bank_name, bank_branch, upi_id, payment_instructions, upi_qr_enabled, bank_transfer_enabled, payment_verification_mode, payments_enabled"
    )
    .eq("id", resolvedDairyId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return dairy;
};

export const updateFarmPlan = async (dairyId, newPlan) => {
  const sanitizedPlan = String(newPlan || "").toUpperCase().trim();
  const planDetails = await getPlatformPlan(sanitizedPlan);
  if (!planDetails) {
    throw new Error(`Invalid plan: ${newPlan}`);
  }

  const { data, error } = await supabase
    .from("dairies")
    .update({
      selected_plan: sanitizedPlan,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dairyId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createFarmPlanOrder = async ({ dairyId, plan, cycle, couponCode }) => {
  const planDetails = await getPlatformPlan(plan);
  if (!planDetails) {
    throw new Error(`Invalid plan selected: ${plan}`);
  }

  let amount = cycle === "yearly" ? planDetails.yearly_price : planDetails.monthly_price;
  if (amount === undefined || amount === null) {
    throw new Error(`Invalid billing cycle: ${cycle}`);
  }

  // Validate coupon on backend if provided
  let discountApplied = 0;
  if (couponCode) {
    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", String(couponCode).toUpperCase().trim())
      .limit(1)
      .maybeSingle();

    if (coupon && coupon.status === "ACTIVE") {
      const now = new Date();
      const withinDates = now >= new Date(coupon.start_date) && now <= new Date(coupon.end_date);
      const underUsageLimit = coupon.current_uses < coupon.max_uses;
      const minAmountMet = Number(amount) >= Number(coupon.min_purchase_amount);

      if (withinDates && underUsageLimit && minAmountMet) {
        if (coupon.discount_type === "PERCENTAGE") {
          discountApplied = (amount * coupon.discount_value) / 100;
        } else if (coupon.discount_type === "FLAT") {
          discountApplied = coupon.discount_value;
        } else if (coupon.discount_type === "FIRST_MONTH_FREE") {
          discountApplied = amount;
        }
        amount = Math.max(0, amount - discountApplied);
      }
    }
  }

  const { keyId, keySecret } = getRazorpayConfig();
  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  const orderPayload = {
    amount: Math.round(amount * 100), // in paise
    currency: "INR",
    receipt: `dairy_${dairyId}_plan_${plan}_${Date.now()}`.slice(0, 40),
    partial_payment: false,
    notes: {
      dairy_id: String(dairyId),
      plan,
      cycle,
      coupon_code: couponCode || "",
      discount_applied: String(discountApplied),
      payment_type: "saas_subscription",
    },
  };

  const order = await razorpay.orders.create(orderPayload);
  return {
    keyId,
    order,
  };
};

export const verifyFarmPlanPayment = async ({
  dairyId,
  plan,
  cycle,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  couponCode,
}) => {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new Error("Missing Razorpay verification fields");
  }

  const { keySecret } = getRazorpayConfig();
  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    throw new Error("Payment signature verification failed");
  }

  // Increment coupon usage and log coupon redemption on successful payment verification
  if (couponCode) {
    try {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", String(couponCode).toUpperCase().trim())
        .limit(1)
        .maybeSingle();

      if (coupon) {
        // Increment use count
        await supabase
          .from("coupons")
          .update({ current_uses: coupon.current_uses + 1 })
          .eq("id", coupon.id);

        const planDetails = await getPlatformPlan(plan);
        const originalAmount = cycle === "yearly" ? (planDetails?.yearly_price ?? 0) : (planDetails?.monthly_price ?? 0);
        let discountApplied = 0;
        if (coupon.discount_type === "PERCENTAGE") {
          discountApplied = (originalAmount * coupon.discount_value) / 100;
        } else if (coupon.discount_type === "FLAT") {
          discountApplied = coupon.discount_value;
        } else if (coupon.discount_type === "FIRST_MONTH_FREE") {
          discountApplied = originalAmount;
        }

        // Insert log in coupon_redemptions
        await supabase.from("coupon_redemptions").insert({
          coupon_id: coupon.id,
          coupon_code: coupon.code,
          dairy_id: dairyId,
          discount_applied: Math.min(discountApplied, originalAmount),
        });
      }
    } catch (couponErr) {
      console.error("Redemption logging failed during checkout verification:", couponErr.message);
    }
  }

  // Update the dairy's plan to the selected plan
  return await updateFarmPlan(dairyId, plan);
};

export const createFarmPlanSubscription = async ({ dairyId, plan, cycle }) => {
  const planDetails = await getPlatformPlan(plan);
  if (!planDetails) {
    throw new Error(`Invalid plan selected: ${plan}`);
  }

  const amount = cycle === "yearly" ? planDetails.yearly_price : planDetails.monthly_price;
  if (!amount) {
    throw new Error(`Invalid billing cycle: ${cycle}`);
  }

  const { keyId, keySecret } = getRazorpayConfig();
  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  // 1. Create a plan dynamically in Razorpay
  const razorpayPlan = await razorpay.plans.create({
    period: cycle === "yearly" ? "yearly" : "monthly",
    interval: 1,
    item: {
      name: `${plan} Plan SaaS Subscription (${cycle})`,
      amount: Math.round(amount * 100), // in paise
      currency: "INR",
      description: `Recurring SaaS fee for plan: ${plan}`
    }
  });

  // 2. Create the subscription mandate
  const subscription = await razorpay.subscriptions.create({
    plan_id: razorpayPlan.id,
    total_count: cycle === "yearly" ? 5 : 60,
    quantity: 1,
    customer_notify: 1,
    notes: {
      dairy_id: String(dairyId),
      plan,
      cycle,
      payment_type: "saas_subscription_mandate"
    }
  });

  return {
    keyId,
    subscriptionId: subscription.id,
    shortUrl: subscription.short_url
  };
};

export const verifyFarmPlanSubscriptionPayment = async ({
  dairyId,
  plan,
  cycle,
  razorpayPaymentId,
  razorpaySubscriptionId,
  razorpaySignature,
}) => {
  if (!razorpayPaymentId || !razorpaySubscriptionId || !razorpaySignature) {
    throw new Error("Missing subscription verification fields");
  }

  const { keySecret } = getRazorpayConfig();
  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayPaymentId}|${razorpaySubscriptionId}`)
    .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    throw new Error("Subscription payment signature verification failed");
  }

  // Update the dairy's plan to the selected plan since the first transaction cleared successfully!
  return await updateFarmPlan(dairyId, plan);
};
