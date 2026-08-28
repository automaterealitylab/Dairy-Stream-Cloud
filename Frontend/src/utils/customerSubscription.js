/* ======================================================
   CUSTOMER SUBSCRIPTION — PURE HELPERS & CONSTANTS
   Extracted from pages/customer/CustomerSubscription.jsx
====================================================== */

export const headingFont = { fontFamily: "'Lora', serif" };
export const fmtCurrency = (amount) => `Rs.${Number(amount || 0).toFixed(2)}`;

export const EMPTY_FORM = {
  dairyId: null,
  product: 'Buffalo Milk',
  quantity: 1,
  slot: 'Morning',
  timeRange: '6:00 - 9:00 AM',
  status: 'ACTIVE',
  approvalStatus: 'PENDING',
  assignedAgentId: null,
  startDate: '',
  address: '',
  paymentMethod: 'UPI',
  deliveryDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
};

export const DAY_OPTIONS = [
  { key: 'MONDAY', label: 'Monday' },
  { key: 'TUESDAY', label: 'Tuesday' },
  { key: 'WEDNESDAY', label: 'Wednesday' },
  { key: 'THURSDAY', label: 'Thursday' },
  { key: 'FRIDAY', label: 'Friday' },
  { key: 'SATURDAY', label: 'Saturday' },
  { key: 'SUNDAY', label: 'Sunday' },
];

const isMilkLikeProduct = (item = {}) => {
  const normalizedType = String(item.type || 'MILK').trim().toUpperCase();
  const normalizedName = String(item.name || '').trim().toUpperCase();
  return normalizedType.includes('MILK') || normalizedName.includes('MILK');
};

export const normalizeSubscriptionProducts = (dairy = {}) => {
  const explicitItems = Array.isArray(dairy?.productItems) ? dairy.productItems : [];
  if (explicitItems.length > 0) {
    return explicitItems
      .map((item) => ({
        id: item.id || item.name,
        name: String(item.name || '').trim(),
        type: String(item.type || 'MILK').trim().toUpperCase(),
        ratePerUnit: Number(item.ratePerUnit || 0),
        stockQuantity: Number(item.stockQuantity || 0),
      }))
      .filter((item) => item.name && isMilkLikeProduct(item));
  }

  const legacyProducts = dairy?.products || {};
  return Object.keys(legacyProducts).map((name) => ({
    id: name,
    name,
    type: 'MILK',
    ratePerUnit: Number(legacyProducts[name] || 0),
    stockQuantity: Number.POSITIVE_INFINITY,
  }));
};

export const normalizeDeliveryDays = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(
      value
        .map((day) => String(day || '').trim().toUpperCase())
        .filter(Boolean)
    )];
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return [...new Set(
          parsed
            .map((day) => String(day || '').trim().toUpperCase())
            .filter(Boolean)
        )];
      }
    } catch {
      return [...new Set(
        value
          .split(',')
          .map((day) => day.trim().toUpperCase())
          .filter(Boolean)
      )];
    }
  }

  return [];
};

// ✅ UI Mapper
export const toUiSubscription = (record) => {
  if (!record) return null;
  const slot = record.delivery_slot || 'Morning';
  const resolvedDeliveryDays = normalizeDeliveryDays(record.delivery_days);
  return {
    dairyId: record.dairy_id ?? null,
    product: record.milk_type || 'Milk',
    quantity: Number(record.quantity_liters || 0),
    slot,
    timeRange: slot === 'Evening' ? '5:00 - 8:00 PM' : '6:00 - 9:00 AM',
    status: (record.status || 'ACTIVE').toUpperCase(),
    approvalStatus: (record.approval_status || 'PENDING').toUpperCase(),
    assignedAgentId: record.assigned_agent_id ?? null,
    startDate: record.start_date || '',
    address: record.address || '',
    paymentMethod: record.payment_method || 'UPI',
    deliveryDays:
      resolvedDeliveryDays.length > 0
        ? resolvedDeliveryDays
        : DAY_OPTIONS.map((day) => day.key),
  };
};

// ✅ Payload Mapper
export const toSavePayload = (model, overrides = {}) => {
  const next = { ...model, ...overrides };
  return {
    dairyId: next.dairyId,
    milkType: next.product,
    quantity: Number(next.quantity),
    slot: next.slot,
    startDate: next.startDate || undefined,
    address: next.address || '',
    paymentMethod: next.paymentMethod || 'UPI',
    deliveryDays: normalizeDeliveryDays(next.deliveryDays),
    status: (next.status || 'ACTIVE').toUpperCase(),
    approvalStatus: (next.approvalStatus || 'PENDING').toUpperCase(),
    assignedAgentId: next.assignedAgentId ?? null,
  };
};
