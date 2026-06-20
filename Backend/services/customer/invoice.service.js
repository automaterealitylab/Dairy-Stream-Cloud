import { supabase } from "../../config/supabase.js";

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
    .eq("id", invoiceId)
    .eq("customer_id", customerId)
    .limit(1)
    .maybeSingle();

  if (dairyId) query = query.eq("dairy_id", dairyId);

  const { data, error } = await query;
  if (error) throw error;
  if (!data) {
    const notFound = new Error("Invoice not found");
    notFound.statusCode = 404;
    throw notFound;
  }

  const [customerRes, dairyRes] = await Promise.all([
    supabase
      .from("customers")
      .select("customer_name, name, email, phone_number, phone, address, building_name, room_no")
      .eq("id", data.customer_id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("dairies")
      .select("dairy_name, owner_name, upi_id, gstin, address, city, state, pincode")
      .eq("id", data.dairy_id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (customerRes.error) throw customerRes.error;
  if (dairyRes.error) throw dairyRes.error;

  const shareUrl = `${process.env.FRONTEND_URL || ""}/customer/payments?invoice=${data.id}`;
  return {
    ...data,
    customer: customerRes.data || null,
    dairy: dairyRes.data || null,
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
