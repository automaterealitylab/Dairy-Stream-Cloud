import { supabase } from "../../config/supabase.js";

const isMissingColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("column") && message.includes("does not exist");
};

const isMissingTableError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("relation") && message.includes("does not exist");
};

const isUuidSyntaxError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("invalid input syntax for type uuid");
};

const toNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const normalizeStatus = (status) => {
  const value = String(status || "").toUpperCase();
  if (value === "PAID") return "PAID";
  if (value === "PENDING") return "PENDING";
  if (value === "OVERDUE") return "OVERDUE";
  if (value === "FAILED") return "FAILED";
  return "PENDING";
};

const formatDate = (value) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const diffDaysFromToday = (value) => {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  const today = new Date();
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const b = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
};

const getCustomerWalletBalance = async (customerId) => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return 0;

  return (
    toNumber(data.wallet_balance, NaN) ||
    toNumber(data.walletBalance, NaN) ||
    toNumber(data.balance, 0)
  );
};

const fetchPaymentsRows = async (customerId) => {
  const candidateCustomerColumns = ["customer_id", "user_id", "customerId", "customerid"];

  for (const customerColumn of candidateCustomerColumns) {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq(customerColumn, customerId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error) return data || [];
    if (isMissingTableError(error)) return [];
    if (isMissingColumnError(error) || isUuidSyntaxError(error)) continue;
    throw error;
  }

  return [];
};

const mapPaymentRow = (row, index) => {
  const amount = toNumber(
    row.amount ?? row.total_amount ?? row.total ?? row.bill_amount ?? 0,
    0
  );
  const status = normalizeStatus(row.status);
  const dateSource = row.payment_date || row.date || row.created_at || row.updated_at;
  const monthLabel = row.billing_month || row.month || null;

  return {
    id: row.id ?? `payment-${index}`,
    title: row.title || row.description || (monthLabel ? `${monthLabel} Milk Bill` : "Milk Bill"),
    date: formatDate(dateSource),
    amount,
    status,
    method: row.method || row.payment_method || "-",
    dueDate: row.due_date || row.dueDate || null,
  };
};

export const getCustomerPaymentsData = async (customerId) => {
  const [walletBalance, paymentRows] = await Promise.all([
    getCustomerWalletBalance(customerId),
    fetchPaymentsRows(customerId),
  ]);

  const history = paymentRows.map(mapPaymentRow);
  const pendingCandidates = history.filter(
    (item) => item.status === "PENDING" || item.status === "OVERDUE"
  );
  const latestPending = pendingCandidates[0] || null;

  return {
    summary: {
      monthlyDue: latestPending?.amount || 0,
      walletBalance: toNumber(walletBalance, 0),
      dueInDays: latestPending ? diffDaysFromToday(latestPending.dueDate) : null,
    },
    history,
  };
};

