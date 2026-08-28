// Pure helpers and static config for the Admin Payments page.

export const mapPlanName = (plan) => {
  const normalized = String(plan || "").trim().toUpperCase();
  const mapping = {
    STARTER: "STARTER",
    GROWTH: "GROWTH",
    PREMIUM: "PREMIUM",
  };
  return mapping[normalized] || normalized || "STARTER";
};

export const isCollectibleStatus = (status) => {
  const normalized = String(status || "").toUpperCase();
  return normalized === "PENDING" || normalized === "OVERDUE";
};

export const getPaymentDayKey = (value) => {
  if (!value) return "unknown-date";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatPaymentDate = (value) => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-GB");
};

export const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const getWhatsAppPhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  return digits;
};

export const buildWhatsAppBillUrl = ({ phone, customer, amount, date, status, paymentCount, dairyName }) => {
  const normalizedStatus = String(status || "").toUpperCase();
  const isDue = normalizedStatus === "PENDING" || normalizedStatus === "OVERDUE" || normalizedStatus === "MIXED";
  const effectiveDairyName = dairyName || "your dairy";
  const messageLines = isDue
    ? [
        `Hello ${customer || "Customer"},`,
        `This is a payment reminder from ${effectiveDairyName}.`,
        "",
        `Due amount: ${formatCurrency(amount)}`,
        `Bill date: ${formatPaymentDate(date)}`,
        paymentCount > 1 ? `Payments included: ${paymentCount}` : null,
        "",
        "Please clear this due bill at your earliest convenience.",
        "Thank you.",
      ]
    : [
        `Hello ${customer || "Customer"},`,
        `This is a payment update from ${effectiveDairyName}.`,
        "",
        `Amount: ${formatCurrency(amount)}`,
        `Date: ${formatPaymentDate(date)}`,
        `Status: ${normalizedStatus || "PAID"}`,
        "",
        "Thank you.",
      ];

  const message = messageLines.filter(Boolean).join("\n");
  const phoneNumber = getWhatsAppPhone(phone);
  return phoneNumber
    ? `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
};

export const getGroupStatus = (items) => {
  const statuses = [...new Set(items.map((item) => String(item.status || "").toUpperCase()))];

  if (statuses.length === 1) return statuses[0];
  if (statuses.includes("OVERDUE")) return "OVERDUE";
  if (statuses.includes("PENDING")) return "PENDING";
  if (statuses.includes("PAID")) return "PAID";
  return "MIXED";
};

export const buildGroupedPayments = (payments) =>
  payments
    .reduce((groups, payment) => {
      const dayKey = getPaymentDayKey(payment.date);
      const groupKey = `${payment.customerId || payment.customer || "unknown"}-${dayKey}`;
      const existingGroup = groups.find((group) => group.groupKey === groupKey);

      if (existingGroup) {
        existingGroup.items.push(payment);
        existingGroup.totalAmount += Number(payment.amount || 0);
        existingGroup.collectibleAmount += isCollectibleStatus(payment.status)
          ? Number(payment.amount || 0)
          : 0;
        return groups;
      }

      groups.push({
        groupKey,
        customerId: payment.customerId,
        customer: payment.customer,
        phone: payment.phone,
        date: payment.date,
        items: [payment],
        totalAmount: Number(payment.amount || 0),
        collectibleAmount: isCollectibleStatus(payment.status) ? Number(payment.amount || 0) : 0,
      });
      return groups;
    }, [])
    .map((group) => ({
      ...group,
      items: [...group.items].sort(
        (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      ),
      status: getGroupStatus(group.items),
      hasCollectibleItems: group.items.some((item) => isCollectibleStatus(item.status)),
      displayAmount: group.items.some((item) => isCollectibleStatus(item.status))
        ? group.collectibleAmount
        : group.totalAmount,
    }));

export const planOptions = [
  {
    value: "STARTER",
    label: "Starter",
    monthlyPrice: 499,
    yearlyPrice: 4990,
    features: [
      "Basic customer and product management",
      "Manual delivery scheduling",
      "Limited payment tracking dashboard",
      "Single dairy admin access",
    ],
    popular: false,
  },
  {
    value: "GROWTH",
    label: "Growth",
    monthlyPrice: 1499,
    yearlyPrice: 14990,
    features: [
      "Customer, agent, and subscription management",
      "Delivery approvals and route assignment",
      "UPI payment tracking and verification queue",
      "Performance dashboard with delivery analytics",
    ],
    popular: true,
  },
  {
    value: "PREMIUM",
    label: "Enterprise",
    monthlyPrice: 2499,
    yearlyPrice: 24990,
    features: [
      "Everything in Growth plan",
      "Procurement and supplier management",
      "Push notifications and ETA visibility",
      "Offline-ready delivery operations support",
    ],
    popular: false,
  },
];

export const getPlanLabel = (planValue) =>
  planOptions.find((option) => option.value === planValue)?.label || planValue || "Starter";
