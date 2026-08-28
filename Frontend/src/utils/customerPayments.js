import { CreditCard, RefreshCw, Wallet } from "lucide-react";

export const bodyFont = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
export const headingFont = { fontFamily: "'Lora', serif" };

export const FILTER_OPTIONS = [
  { value: "ALL", label: "All records" },
  { value: "PENDING", label: "Pending" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PAID", label: "Paid" },
];

export const WALLET_TOPUP_PRESETS = [100, 250, 500, 1000];

export const INITIAL_SHOW = 7;

export const EMPTY_SUMMARY = {
  monthlyDue: 0,
  overdueAmount: 0,
  overdueBaseAmount: 0,
  overduePenaltyAmount: 0,
  walletBalance: 0,
  dueInDays: null,
  beneficiary: null,
  payableTillDate: 0,
  billingSummaryAmount: 0,
};

export const getAuthToken = () => {
  const storedUser = localStorage.getItem("user");
  return JSON.parse(storedUser || "{}")?.token || localStorage.getItem("token") || null;
};

export const fmt = (value) => {
  const num = Number(value || 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatPaymentMethodLabel = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized || normalized === "-") return "";
  if (normalized === "PAY_NOW" || normalized === "RAZORPAY") return "Online";
  if (normalized === "COD" || normalized === "CASH") return "Cash";
  if (normalized === "UPI") return "UPI";
  return normalized
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const formatDateLabel = (
  value,
  options = { day: "numeric", month: "short", year: "numeric" }
) => {
  if (!value) return "";

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString("en-IN", options);
};

export const dueText = (dueInDays) => {
  if (dueInDays === null || dueInDays === undefined) return "Due date not set";
  if (dueInDays < 0) return `Overdue by ${Math.abs(dueInDays)} days`;
  if (dueInDays === 0) return "Due today";
  return `Due in ${dueInDays} days`;
};

export const parseTitle = (raw = "") => {
  if (!raw) return { title: "Payment", subtitle: "Monthly billing" };

  // Strip database key/value noise (e.g., delivery_ids=847) and fix typos
  let cleanedRaw = String(raw)
    .replace(/\b(delivery_)?ids?=\s*\d+/gi, "")
    .replace(/\bPanner\b/gi, "Paneer")
    .replace(/\bPaner\b/gi, "Paneer")
    .replace(/\s+/g, " ")
    .trim();

  const up = cleanedRaw.toUpperCase();

  const formatQtyStr = (qty) => {
    if (!qty) return "";
    const cleanQty = String(qty).trim();
    const num = Number(cleanQty);
    if (Number.isInteger(num) && num > 50 && !/[a-zA-Z]/.test(cleanQty)) {
      return "";
    }
    if (
      cleanQty.toLowerCase().includes("l") ||
      cleanQty.toLowerCase().includes("g") ||
      cleanQty.toLowerCase().includes("kg") ||
      cleanQty.toLowerCase().includes("unit") ||
      cleanQty.toLowerCase().includes("pkt") ||
      cleanQty.toLowerCase().includes("pack")
    ) {
      return cleanQty;
    }
    return `${cleanQty} L`;
  };

  const formatSlotStr = (str) => {
    const upStr = String(str || "").toUpperCase();
    if (upStr.includes("MORNING")) return "Morning Slot";
    if (upStr.includes("EVENING")) return "Evening Slot";
    return "";
  };

  // 1. One-time / Extra Orders
  if (
    up.includes("ONE-TIME") ||
    up.includes("ONE_TIME") ||
    up.includes("BUY ONCE") ||
    up.includes("EXTRA ORDER")
  ) {
    let productName = "";
    let quantityStr = "";
    let slotName = formatSlotStr(cleanedRaw);

    const prodMatch = cleanedRaw.match(/(?:product|item|milk)=([^;,\s()]+)/i)?.[1]?.trim();
    if (prodMatch && !/ids?=/i.test(prodMatch)) {
      productName = prodMatch;
    }

    const qtyMatch = cleanedRaw.match(/(?:qty|quantity)=([^;,\s()]+)/i)?.[1]?.trim();
    if (qtyMatch) {
      quantityStr = formatQtyStr(qtyMatch);
    }

    if (!productName) {
      const bundleMatch = cleanedRaw.match(
        /One-time order(?: bundle)?:?\s*([^(\d=;,]+)?\s*(\d+(?:\.\d+)?\s*(?:L|g|kg|units?|pkts?)?)?\s*(?:\(([^)]+)\))?/i
      );

      if (bundleMatch) {
        const candidateProd = (bundleMatch[1] || "").replace(/delivery_ids/gi, "").replace(/[:=]/g, "").trim();
        if (candidateProd && candidateProd.length > 1) {
          productName = candidateProd;
        }
        if (!quantityStr && bundleMatch[2]) {
          quantityStr = formatQtyStr(bundleMatch[2]);
        }
        if (!slotName && bundleMatch[3]) {
          slotName = formatSlotStr(bundleMatch[3]);
        }
      }
    }

    if (!productName || /=/i.test(productName) || /delivery/i.test(productName)) {
      if (up.includes("PANEER")) productName = "Paneer";
      else if (up.includes("BUFFALO MILK") || up.includes("BUFFALO")) productName = "Buffalo Milk";
      else if (up.includes("COW MILK") || up.includes("COW")) productName = "Cow Milk";
      else if (up.includes("MILK")) productName = "Milk";
      else if (up.includes("CURD") || up.includes("DAHI")) productName = "Curd";
      else if (up.includes("GHEE")) productName = "Ghee";
      else if (up.includes("BUTTER")) productName = "Butter";
      else productName = "Extra Item";
    }

    productName = productName.replace(/\b\w/g, (c) => c.toUpperCase());

    const title = quantityStr
      ? `Extra Order: ${productName} (${quantityStr})`
      : `Extra Order: ${productName}`;
    const subtitle = slotName ? `${slotName} · Monthly billing` : "Morning Slot · Monthly billing";

    return { title, subtitle };
  }

  // 2. Subscription Orders / Deliveries
  if (up.includes("SUBSCRIPTION")) {
    const slotName = formatSlotStr(cleanedRaw) || "Morning Slot";
    return {
      title: "Daily Subscription Bill",
      subtitle: `${slotName} · Monthly billing`,
    };
  }

  // 3. Wallet Topup
  if (up.includes("WALLET")) {
    return {
      title: "Wallet Topup",
      subtitle: "Instant wallet credit",
    };
  }

  // Fallback for general payments
  const cleanTitle = cleanedRaw
    .replace(/\[.*?\]\s*/g, "")
    .replace(/\w+=\S+;?\s*/g, "")
    .trim();
  const formattedTitle = cleanTitle
    ? cleanTitle.replace(/\b\w/g, (c) => c.toUpperCase())
    : "Payment Record";

  return {
    title: formattedTitle,
    subtitle: "Morning Slot · Monthly billing",
  };
};

export const statusCfg = (status) => {
  const normalizedStatus = String(status || "").toUpperCase();

  if (normalizedStatus === "PAID") {
    return {
      pill: "border border-[#D6EEDD] bg-[#F4FBF7] text-[#1A7A4A] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]",
      dot: "bg-[#1A7A4A]",
      label: "Paid",
    };
  }

  if (normalizedStatus === "OVERDUE") {
    return {
      pill: "border border-[#F4D1D1] bg-[#FFF5F5] text-[#C53030] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
      dot: "bg-[#C53030]",
      label: "Overdue",
    };
  }

  return {
    pill: "border border-[#F3E1B8] bg-[#FFF9EE] text-[#B45309] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
    dot: "bg-[#B45309]",
    label: "Pending",
  };
};

export const paymentTypeCfg = (raw = "") => {
  const normalizedTitle = String(raw || "").toUpperCase();

  if (normalizedTitle.includes("WALLET")) {
    return {
      Icon: Wallet,
      iconBg: "bg-[#EFF6FF] text-[#1D5FA5]",
    };
  }

  if (normalizedTitle.includes("SUBSCRIPTION")) {
    return {
      Icon: RefreshCw,
      iconBg: "bg-[#EBF7F1] text-[#1A7A4A]",
    };
  }

  return {
    Icon: CreditCard,
    iconBg: "bg-[#FFFBEB] text-[#B45309]",
  };
};

export const getMonthEndDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
};

export const getNextSubscriptionDueDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 10);
};

export const toPaymentsViewState = (data) => ({
  summary: {
    monthlyDue: Number(data?.summary?.monthlyDue || 0),
    overdueAmount: Number(data?.summary?.overdueAmount || 0),
    overdueBaseAmount: Number(data?.summary?.overdueBaseAmount || 0),
    overduePenaltyAmount: Number(data?.summary?.overduePenaltyAmount || 0),
    walletBalance: Number(data?.summary?.walletBalance || 0),
    dueInDays: data?.summary?.dueInDays == null ? null : Number(data.summary.dueInDays),
    beneficiary: data?.summary?.beneficiary || null,
    payableTillDate: Number(data?.summary?.payableTillDate || 0),
    billingSummaryAmount: Number(
      data?.summary?.billingSummaryAmount ??
        data?.summary?.payableTillDate ??
        data?.summary?.monthlyDue ??
        0
    ),
  },
  history: Array.isArray(data?.history) ? data.history : [],
});
