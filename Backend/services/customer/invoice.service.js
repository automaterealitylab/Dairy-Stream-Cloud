
import { supabase } from "../../config/supabase.js";
import { decryptDeterministic } from "../../utils/crypto.js";
import {
  isDeliveredStatus,
  parseDeliveryBillingMeta,
} from "./monthlyBilling.service.js";

const toNumber = (value) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

const formatInvoiceNumber = (row) =>
  row?.bill_number ||
  `DS-${row?.dairy_id || "DAIRY"}-${row?.customer_id || "CUSTOMER"}-${row?.billing_month || row?.id}`;

export const getCustomerInvoiceHistory = async ({ customerId, dairyId = null, limit = 24 }) => {
  let query = supabase
    .from("monthly_bills")
    .select("id, dairy_id, billing_month, bill_number, subtotal, tax_amount, discount_amount, late_fee_amount, total_amount, paid_amount, due_amount, status, due_date, invoice_url, generated_at")
    .eq("customer_id", customerId)
    .order("billing_month", { ascending: false })
    .limit(limit);

  if (dairyId) query = query.eq("dairy_id", dairyId);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row) => ({
    ...row,
    invoiceNumber: formatInvoiceNumber(row),
    subtotal: toNumber(row.subtotal),
    taxAmount: toNumber(row.tax_amount),
    discountAmount: toNumber(row.discount_amount),
    lateFeeAmount: toNumber(row.late_fee_amount),
    totalAmount: toNumber(row.total_amount),
    paidAmount: toNumber(row.paid_amount),
    dueAmount: toNumber(row.due_amount),
  }));
};

export const getCustomerInvoiceDetail = async ({ customerId, invoiceId, dairyId = null }) => {
  let query = supabase
    .from("monthly_bills")
    .select("*")
    .eq("id", invoiceId);

  if (customerId) query = query.eq("customer_id", customerId);
  if (dairyId) query = query.eq("dairy_id", dairyId);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  if (!data) {
    const notFound = new Error("Invoice not found or access denied");
    notFound.statusCode = 404;
    throw notFound;
  }

  const monthKey = String(data.billing_month || "").slice(0, 7);
  const startDate = `${monthKey}-01`;
  const endDate = `${monthKey}-31`;

  const [customerRes, dairyRes, deliveriesRes, paymentsRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, customer_name, name, email, phone_number, phone, address, building_name, wing, room_no")
      .eq("id", data.customer_id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("dairies")
      .select("id, dairy_name, owner_name, upi_id, gstin, address, city, state, pincode, phone, email")
      .eq("id", data.dairy_id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("deliveries")
      .select("id, delivery_date, milk_type, quantity_liters, status, notes, delivery_slot")
      .eq("customer_id", data.customer_id)
      .eq("dairy_id", data.dairy_id)
      .gte("delivery_date", startDate)
      .lte("delivery_date", endDate)
      .order("delivery_date", { ascending: true }),
    supabase
      .from("payments")
      .select("id, amount, status, method, description, created_at, utr_number")
      .eq("customer_id", data.customer_id)
      .eq("dairy_id", data.dairy_id)
      .or(`monthly_bill_id.eq.${data.id},description.ilike.%month=${monthKey}%`)
      .order("created_at", { ascending: true }),
  ]);

  if (customerRes.error) throw customerRes.error;
  if (dairyRes.error) throw dairyRes.error;

  const rawCustomer = customerRes.data || {};
  const customer = {
    ...rawCustomer,
    email: decryptDeterministic(rawCustomer.email),
    phone_number: decryptDeterministic(rawCustomer.phone_number || rawCustomer.phone),
    phone: decryptDeterministic(rawCustomer.phone || rawCustomer.phone_number),
  };

  const dairy = dairyRes.data || {};
  const deliveries = Array.isArray(deliveriesRes.data) ? deliveriesRes.data : [];
  const rawPayments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];

  // Calculate delivery summary metrics
  const totalScheduled = deliveries.length;
  let delivered = 0;
  let skipped = 0;
  let paused = 0;

  const productGroups = new Map();

  for (const del of deliveries) {
    const status = String(del.status || "").trim().toUpperCase();
    if (isDeliveredStatus(status)) {
      delivered += 1;

      const productName = String(del.milk_type || "Milk").trim();
      const slot = String(del.delivery_slot || "").trim();
      const groupKey = slot ? `${productName} (${slot})` : productName;
      const qty = toNumber(del.quantity_liters, 0);

      const notesMeta = parseDeliveryBillingMeta(del.notes);
      const unitPrice = notesMeta.unitPrice ?? 60; // default rate fallback if unparsed
      const amount = Number((qty * unitPrice).toFixed(2));

      if (!productGroups.has(groupKey)) {
        productGroups.set(groupKey, {
          product: groupKey,
          days: 0,
          totalQty: 0,
          rate: unitPrice,
          amount: 0,
        });
      }

      const group = productGroups.get(groupKey);
      group.days += 1;
      group.totalQty = Number((group.totalQty + qty).toFixed(2));
      group.amount = Number((group.amount + amount).toFixed(2));
      if (unitPrice > 0) group.rate = unitPrice;
    } else if (status === "SKIPPED") {
      skipped += 1;
    } else if (status === "PAUSED") {
      paused += 1;
    }
  }

  const items = [...productGroups.values()];
  // Fallback item if no delivered records found but bill total exists
  if (items.length === 0 && toNumber(data.total_amount) > 0) {
    items.push({
      product: "Monthly Milk Subscription",
      days: delivered || 30,
      totalQty: delivered || 30,
      rate: toNumber(data.total_amount) / Math.max(delivered || 30, 1),
      amount: toNumber(data.total_amount),
    });
  }

  const paymentHistory = rawPayments.map((p) => ({
    id: p.id,
    date: p.created_at,
    created_at: p.created_at,
    utr_number: p.utr_number || `PAY-${p.id}`,
    method: p.method || "UPI",
    amount: toNumber(p.amount),
    status: p.status,
  }));

  const shareUrl = `${process.env.FRONTEND_URL || ""}/customer/payments?invoice=${data.id}`;

  return {
    ...data,
    customer,
    dairy,
    deliverySummary: {
      totalScheduled,
      delivered,
      skipped,
      paused,
    },
    items,
    paymentHistory,
    invoiceNumber: formatInvoiceNumber(data),
    shareUrl,
    receipt: {
      title: `Invoice ${formatInvoiceNumber(data)}`,
      amount: toNumber(data.total_amount),
      paidAmount: toNumber(data.paid_amount),
      dueAmount: toNumber(data.due_amount),
      status: data.status,
      generatedAt: data.generated_at,
    },
  };
};
