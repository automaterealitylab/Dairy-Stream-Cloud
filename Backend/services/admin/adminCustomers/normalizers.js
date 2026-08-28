// Pure normalization/formatting helpers for the admin customers domain:
// numeric coercion, wallet balance resolution, billing-month keys/labels,
// overdue-day and bill-issue-date derivation.

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const resolveWalletBalance = (row) => {
  const walletBalance = toNumber(row?.wallet_balance, NaN);
  if (Number.isFinite(walletBalance)) return walletBalance;

  const camelWalletBalance = toNumber(row?.walletBalance, NaN);
  if (Number.isFinite(camelWalletBalance)) return camelWalletBalance;

  return 0;
};

export const getMonthKey = (dateValue) => String(dateValue || "").slice(0, 7);

export const formatMonthLabel = (monthKey) => {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return "Current Billing Period";
  const date = new Date(`${monthKey}-01T00:00:00`);
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
};

export const getOverdueDays = (dueDate) => {
  if (!dueDate) return 0;
  const due = new Date(`${String(dueDate).slice(0, 10)}T00:00:00`);
  const today = new Date();
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (Number.isNaN(due.getTime())) return 0;
  const diffMs = localToday.getTime() - due.getTime();
  return diffMs > 0 ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;
};

export const getBillIssueDate = (monthKey) => {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) {
    return new Date().toISOString().slice(0, 10);
  }
  const [year, month] = String(monthKey).split("-").map(Number);
  const issueDate = new Date(year, month, 1);
  return issueDate.toISOString().slice(0, 10);
};
