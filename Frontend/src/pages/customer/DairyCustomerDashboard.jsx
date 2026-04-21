import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import { useCustomerDashboard } from "../../hooks/useCustomerDashboard";
import {
  cancelCustomerOneTimeOrder,
  createCustomerOneTimeOrder,
  createCustomerPaymentOrder,
  fetchCustomerDashboard,
  reportCustomerDeliveryIssue,
  saveCustomerSubscription,
  verifyCustomerPayment,
} from "../../api/customer/customer.api.js";
import { fetchPublicDairyById } from "../../api/public.api.js";
import {
  PlusCircle,
  PauseCircle,
  PlayCircle,
  Truck,
  CreditCard,
  CheckCircle,
  Clock,
  User,
  ChevronRight,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const ACTIONS = [
  {
    key: "add",
    label: "Add Extra",
    Icon: PlusCircle,
    bg: "bg-[#FFF4E2]",
    text: "text-[#B8641A]",
    border: "border-[#EFD7B3]",
    route: null,
  },
  {
    key: "pause",
    label: "Pause",
    Icon: PauseCircle,
    bg: "bg-[#FFF1E4]",
    text: "text-[#C86A2B]",
    border: "border-[#F0D1B2]",
    route: null,
  },
  {
    key: "deliveries",
    label: "Deliveries",
    Icon: Truck,
    bg: "bg-[#EEF5E7]",
    text: "text-[#4A7C2F]",
    border: "border-[#DDE8D1]",
    route: "/customer/dashboard/deliveries",
  },
  {
    key: "pay",
    label: "Pay Bill",
    Icon: CreditCard,
    bg: "bg-[#FDECEA]",
    text: "text-[#C0392B]",
    border: "border-[#F2D0C8]",
    route: "/customer/dashboard/payments",
  },
];

const getBillingDueText = (dueInDays) => {
  if (dueInDays === null || dueInDays === undefined) return "Due date not set";
  if (dueInDays < 0) return `Overdue by ${Math.abs(dueInDays)} days`;
  if (dueInDays === 0) return "Due today";
  return `Due in ${dueInDays} days`;
};

const getDateInputValue = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTomorrowDateInput = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getDateInputValue(tomorrow);
};

const normalizeProducts = (dairy = {}) => {
  const explicitItems = Array.isArray(dairy?.productItems) ? dairy.productItems : [];
  if (explicitItems.length > 0) {
    return explicitItems
      .map((item) => ({
        id: item.id || item.name,
        name: String(item.name || "").trim(),
        ratePerUnit: Number(item.ratePerUnit || 0),
        stockQuantity: Number(item.stockQuantity || 0),
        unit: item.unit || "LITER",
      }))
      .filter((item) => item.name && item.ratePerUnit > 0);
  }

  const legacyProducts = dairy?.products || {};
  return Object.keys(legacyProducts).map((name) => ({
    id: name,
    name,
    ratePerUnit: Number(legacyProducts[name] || 0),
    stockQuantity: Number.POSITIVE_INFINITY,
    unit: "LITER",
  }));
};

const normalizeProductUnit = (unit) => {
  const normalized = String(unit || "").trim().toUpperCase();
  if (!normalized) return "UNIT";
  if (["L", "LTR", "LITER", "LITRE", "LITERS", "LITRES"].includes(normalized)) {
    return "LITER";
  }
  if (["KG", "KGS", "KILOGRAM", "KILOGRAMS"].includes(normalized)) {
    return "KG";
  }
  return normalized;
};

const getProductUnitLabel = (unit, { short = false, lowercase = false } = {}) => {
  const normalized = normalizeProductUnit(unit);

  let label = normalized;
  if (normalized === "LITER") {
    label = short ? "L" : "Liter";
  } else if (normalized === "KG") {
    label = short ? "kg" : "KG";
  }

  return lowercase ? label.toLowerCase() : label;
};

const getProductQuantityStep = (unit) => {
  const normalized = normalizeProductUnit(unit);
  if (normalized === "KG") return "0.25";
  if (normalized === "LITER") return "0.5";
  return "1";
};

const getDefaultProductQuantity = (product, fallbackQuantity = "1") => {
  const fallback = Number(fallbackQuantity);
  if (Number.isFinite(fallback) && fallback > 0) {
    return formatMeasureValue(fallback);
  }

  return getProductQuantityStep(product?.unit);
};

const formatMeasureValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  if (Number.isInteger(numeric)) return String(numeric);
  return numeric.toFixed(2).replace(/\.?0+$/, "");
};

const isProductOutOfStock = (stockQuantity) => {
  const stock = Number(stockQuantity);
  return Number.isFinite(stock) && stock <= 0;
};

const getStoredCustomerAddress = () => {
  const storedUser = localStorage.getItem("user");
  if (!storedUser) return "";

  try {
    const parsed = JSON.parse(storedUser);
    return String(parsed?.user?.address || parsed?.address || "").trim();
  } catch {
    return "";
  }
};

const normalizeAddExtraPaymentOption = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (["SUBSCRIPTION", "ADD_TO_SUBSCRIPTION", "MONTHLY_BILL"].includes(normalized)) {
    return "ADD_TO_SUBSCRIPTION";
  }
  if (["COD", "CASH"].includes(normalized)) {
    return "PAY_NOW_CASH";
  }
  return "PAY_NOW_ONLINE";
};

const getAddExtraOrderPaymentMethod = (option) => {
  if (option === "ADD_TO_SUBSCRIPTION") return "MONTHLY_BILL";
  if (option === "PAY_NOW_CASH") return "COD";
  return "PAY_NOW";
};

const normalizeAddExtraSlot = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized.startsWith("EVE")) return "Evening";
  return "Morning";
};

const formatTomorrowExtraStatus = (status) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "PENDING_APPROVAL") return "Approval Pending";
  if (normalized === "PENDING") return "Scheduled";
  if (normalized === "DELIVERED") return "Delivered";
  if (normalized === "FAILED") return "Failed";
  if (normalized === "SKIPPED") return "Skipped";
  if (normalized === "CANCELLED") return "Cancelled";
  return "Scheduled";
};

const getTomorrowExtraStatusClasses = (status) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "DELIVERED") return "bg-[#EEF5E7] text-[#4A7C2F]";
  if (normalized === "FAILED" || normalized === "CANCELLED") {
    return "bg-[#FDECEA] text-[#C0392B]";
  }
  if (normalized === "PENDING_APPROVAL") return "bg-[#FFF1E4] text-[#C86A2B]";
  return "bg-[#FFF4E2] text-[#B8641A]";
};

const getTodayDeliveryMeta = (delivery = {}) => {
  const status = String(delivery?.status || "").toUpperCase();
  const hasAgent = Boolean(delivery?.agent?.name || delivery?.agentId);

  if (status === "DELIVERED") {
    return {
      title: "Delivered Successfully",
      tone: "success",
      helperText: "Your order was delivered successfully.",
    };
  }

  if (status === "PENDING_APPROVAL") {
    return {
      title: "Approval Pending",
      tone: "approval",
      helperText: "Your one-time order is waiting for dairy admin approval.",
    };
  }

  if (status === "CANCELLED") {
    return {
      title: "Order Cancelled",
      tone: "failed",
      helperText: "This one-time order was cancelled and remains in your history.",
    };
  }

  if (status === "FAILED") {
    return {
      title: "Delivery Failed",
      tone: "failed",
      helperText: "This delivery could not be completed today.",
    };
  }

  if (status === "NOT_SUBSCRIBED") {
    return {
      title: "No Delivery Scheduled Today",
      tone: "idle",
      helperText: "Start a subscription or place a one-time order to get a delivery.",
    };
  }

  if (status === "NOT_SCHEDULED") {
    return {
      title: "No Delivery Scheduled Today",
      tone: "idle",
      helperText: "Your subscription is active, but there is no delivery planned for today.",
    };
  }

  if (status === "PENDING" && !hasAgent) {
    return {
      title: "Delivery Partner Not Assigned",
      tone: "pending",
      helperText: "We are assigning a delivery partner for your order.",
    };
  }

  return {
    title: "Delivery Pending",
    tone: "pending",
    helperText: "Your order is scheduled and awaiting delivery.",
  };
};

const getPreferredExtraProductName = ({ subscription, tomorrow, today }) =>
  String(
    subscription?.milkType ||
      tomorrow?.product ||
      today?.product ||
      ""
  ).trim();

const getPreferredExtraQuantity = ({ subscription, tomorrow, today }) => {
  const rawQuantity = subscription?.quantity ?? tomorrow?.quantity ?? today?.quantity ?? 1;
  const numericQuantity = Number.parseFloat(String(rawQuantity).replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    return "1";
  }

  return formatMeasureValue(numericQuantity);
};

const getDailyDeliverySummary = ({ subscription, tomorrow, today }) => {
  const scheduledQuantity = String(tomorrow?.quantity || today?.quantity || "").trim();
  const scheduledProduct = String(tomorrow?.product || today?.product || "").trim();

  if (scheduledQuantity && scheduledProduct) {
    return `${scheduledQuantity} ${scheduledProduct}`;
  }

  const subscriptionProduct = String(subscription?.milkType || "").trim();
  const subscriptionQuantity = getPreferredExtraQuantity({ subscription, tomorrow: null, today: null });

  if (subscriptionProduct) {
    return `${subscriptionQuantity}L ${subscriptionProduct}`;
  }

  return "1L Milk";
};

const toSubscriptionPayload = (subscription, nextStatus) => ({
  dairyId: subscription?.dairyId,
  milkType: subscription?.milkType || "Milk",
  quantity: Number(subscription?.quantity || 1),
  slot: subscription?.slot || "Morning",
  startDate: subscription?.startDate || undefined,
  address: subscription?.address || "",
  paymentMethod: subscription?.paymentMethod || "UPI",
  status: nextStatus,
});

export default function DairyCustomerDashboard() {
  const navigate = useNavigate();
  const { data, loading, error } = useCustomerDashboard();

  const [dashboardData, setDashboardData] = useState(null);
  const [savingPause, setSavingPause] = useState(false);
  const [pendingSubscriptionStatus, setPendingSubscriptionStatus] = useState(null);
  const [toast, setToast] = useState(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueText, setIssueText] = useState("");
  const [reportingIssue, setReportingIssue] = useState(false);
  const [showAddExtraModal, setShowAddExtraModal] = useState(false);
  const [addExtraLoading, setAddExtraLoading] = useState(false);
  const [addExtraSubmitting, setAddExtraSubmitting] = useState(false);
  const [addExtraError, setAddExtraError] = useState("");
  const [addExtraDairy, setAddExtraDairy] = useState(null);
  const [addExtraProducts, setAddExtraProducts] = useState([]);
  const [showDuplicateExtraConfirm, setShowDuplicateExtraConfirm] = useState(false);
  const [addExtraForm, setAddExtraForm] = useState({
    selectedProducts: [],
    quantities: {},
    paymentMethod: "PAY_NOW_ONLINE",
    address: "",
    slot: "Morning",
  });
  const toastTimeoutRef = useRef(null);

  useEffect(() => {
    if (data) {
      setDashboardData(data);
    }
  }, [data]);

  useEffect(() => {
    if (loading) return undefined;

    let cancelled = false;

    const refreshDashboard = async () => {
      try {
        const fresh = await fetchCustomerDashboard({ force: true });
        if (!cancelled) {
          setDashboardData(fresh);
        }
      } catch {
        // Ignore refresh failures and keep current dashboard visible.
      }
    };

    const interval = window.setInterval(refreshDashboard, 30000);
    const handleFocus = () => {
      refreshDashboard();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loading]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const resolvedData = dashboardData || data;
  const customer = resolvedData?.customer || {};
  const today = resolvedData?.todayDelivery || null;
  const tomorrow = resolvedData?.tomorrowDelivery || null;
  const billing = resolvedData?.billing || {};
  const subscription = resolvedData?.subscription || null;
  const oneTimeOrders = Array.isArray(resolvedData?.oneTimeOrders) ? resolvedData.oneTimeOrders : [];

  const customerName = customer?.name || "Customer";
  const dairyName = customer?.dairy || customer?.dairyName || "Not assigned";
  const fallbackGuestDairyId = localStorage.getItem("guest_dairy_id");
  const fallbackGuestDairyName = localStorage.getItem("guest_dairy_name");
  const linkedExtraDairyId =
    subscription?.dairyId ||
    customer?.dairyId ||
    oneTimeOrders[0]?.dairyId ||
    fallbackGuestDairyId ||
    null;
  const linkedExtraDairyName =
    subscription?.dairyName ||
    customer?.dairyName ||
    oneTimeOrders[0]?.dairyName ||
    fallbackGuestDairyName ||
    dairyName;
  const actualSubscriptionStatus = String(subscription?.status || "").toUpperCase();
  const effectiveSubscriptionStatus = pendingSubscriptionStatus || actualSubscriptionStatus;
  const isPaused = effectiveSubscriptionStatus === "PAUSED";
  const canTogglePause = Boolean(subscription?.dairyId) && !savingPause;
  const hasSubscription = Boolean(subscription?.dairyId);
  const canAddExtraToSubscriptionBill =
    Boolean(subscription?.dairyId) &&
    linkedExtraDairyId != null &&
    String(subscription.dairyId) === String(linkedExtraDairyId);
  const addExtraPaymentOptions = [
    { id: "PAY_NOW_ONLINE", label: "Pay Now Online" },
    { id: "PAY_NOW_CASH", label: "Cash on Delivery" },
    ...(canAddExtraToSubscriptionBill
      ? [{ id: "ADD_TO_SUBSCRIPTION", label: "Add to Subscription Bill" }]
      : []),
  ];
  const todayMeta = getTodayDeliveryMeta(today);
  const hasIssue = Boolean(String(today?.customerIssue || "").trim());
  const issueStatus = String(today?.issueStatus || "").toUpperCase();
  const hasAdminAction = Boolean(String(today?.issueAdminAction || "").trim());
  const reportId = Number(today?.deliveryId ?? today?.id);
  const canReportIssue =
    Number.isFinite(reportId) &&
    reportId > 0 &&
    !["NOT_SUBSCRIBED", "NOT_SCHEDULED"].includes(String(today?.status || "").toUpperCase());
  const pauseToggleLabel = savingPause
    ? pendingSubscriptionStatus === "PAUSED"
      ? "Pausing..."
      : pendingSubscriptionStatus === "ACTIVE"
      ? "Resuming..."
      : isPaused
      ? "Resume"
      : "Pause"
    : isPaused
    ? "Resume"
    : "Pause";
  const pauseToggleHelper = savingPause
    ? pendingSubscriptionStatus === "PAUSED"
      ? "Updating your plan status"
      : pendingSubscriptionStatus === "ACTIVE"
      ? "Restarting daily deliveries"
      : "Updating your plan status"
    : isPaused
    ? "Restart daily deliveries"
    : "Temporarily stop deliveries";
  const nextExtraDeliveryDate = getTomorrowDateInput();
  const tomorrowExtraOrders = Array.isArray(tomorrow?.extraOrders) ? tomorrow.extraOrders : [];
  const hasTomorrowExtras = tomorrowExtraOrders.length > 0;
  const showTomorrowCard = Boolean(hasSubscription || hasTomorrowExtras);
  const tomorrowTitle = hasSubscription
    ? `${tomorrow?.quantity || "-"} ${subscription?.milkType || "Milk"}`
    : "Extra orders for tomorrow";
  const tomorrowSubtitle = hasSubscription
    ? `${tomorrow?.slot || "-"} slot`
    : `${tomorrowExtraOrders.length} extra ${tomorrowExtraOrders.length === 1 ? "item" : "items"} added`;

  useEffect(() => {
    if (canAddExtraToSubscriptionBill || addExtraForm.paymentMethod !== "ADD_TO_SUBSCRIPTION") {
      return;
    }

    setAddExtraForm((prev) =>
      prev.paymentMethod === "ADD_TO_SUBSCRIPTION"
        ? {
            ...prev,
            paymentMethod: "PAY_NOW_ONLINE",
          }
        : prev
    );
  }, [addExtraForm.paymentMethod, canAddExtraToSubscriptionBill]);
  const nextExtraDeliveryLabel = new Date(`${nextExtraDeliveryDate}T00:00:00`).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
  const selectedAddExtraProducts = useMemo(
    () =>
      (addExtraForm.selectedProducts || [])
        .map((name) => addExtraProducts.find((item) => item.name === name))
        .filter(Boolean),
    [addExtraProducts, addExtraForm.selectedProducts]
  );
  const dailyDeliverySummary = getDailyDeliverySummary({ subscription, tomorrow, today });
  const selectedAddExtraOrderLines = useMemo(
    () =>
      selectedAddExtraProducts.map((product) => {
        const quantity = Number(addExtraForm.quantities?.[product.name] || 0);
        const availableStock = Number(product.stockQuantity);
        const stockQuantity = Number.isFinite(availableStock)
          ? availableStock
          : Number.POSITIVE_INFINITY;
        const isStockLimited = Number.isFinite(stockQuantity);

        return {
          product,
          quantity,
          quantityValue: addExtraForm.quantities?.[product.name] || "",
          availableStock: stockQuantity,
          isOutOfStock: isStockLimited && stockQuantity <= 0,
          exceedsStock: isStockLimited && quantity > stockQuantity,
          lineTotal: Number((Number(product.ratePerUnit || 0) * Number(quantity || 0)).toFixed(2)),
        };
      }),
    [addExtraForm.quantities, selectedAddExtraProducts]
  );
  const invalidAddExtraLine = selectedAddExtraOrderLines.find(
    (line) =>
      !Number.isFinite(line.quantity) ||
      line.quantity <= 0 ||
      line.isOutOfStock ||
      line.exceedsStock
  );
  const selectedDuplicateExtraProductNames = selectedAddExtraProducts
    .filter((product) =>
      tomorrowExtraOrders.some(
        (order) =>
          String(order?.dairyId || "") === String(linkedExtraDairyId || "") &&
          String(order?.product || "").trim().toLowerCase() === product.name.toLowerCase()
      )
    )
    .map((product) => product.name);
  const addExtraTotal = Number(
    selectedAddExtraOrderLines
      .reduce((sum, line) => sum + Number(line.lineTotal || 0), 0)
      .toFixed(2)
  );
  const formattedAddExtraTotal = `Rs.${Number.isFinite(addExtraTotal) ? addExtraTotal.toFixed(2) : "0.00"}`;
  const addExtraSubmitLabel = addExtraSubmitting
    ? "Placing extra orders..."
    : addExtraForm.paymentMethod === "PAY_NOW_ONLINE"
    ? `Pay ${formattedAddExtraTotal} & Add Extras`
    : addExtraForm.paymentMethod === "PAY_NOW_CASH"
    ? `Add Extras for ${formattedAddExtraTotal} with Cash`
    : `Add ${formattedAddExtraTotal} to Subscription Bill`;
  const canSubmitAddExtraOrder =
    !addExtraLoading &&
    !addExtraSubmitting &&
    selectedAddExtraOrderLines.length > 0 &&
    !invalidAddExtraLine;

  useEffect(() => {
    if (!subscription?.dairyId) {
      setPendingSubscriptionStatus(null);
      return;
    }

    if (
      pendingSubscriptionStatus &&
      actualSubscriptionStatus &&
      pendingSubscriptionStatus === actualSubscriptionStatus
    ) {
      setPendingSubscriptionStatus(null);
    }
  }, [subscription?.dairyId, pendingSubscriptionStatus, actualSubscriptionStatus]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 3000);
  };

  const refreshDashboard = async () => {
    const fresh = await fetchCustomerDashboard({ force: true });
    setDashboardData(fresh);
  };

  const loadRazorpayCheckoutScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const getExtraOrderPaymentId = (response) =>
    response?.payment?.id ||
    response?.paymentId ||
    response?.order?.payment_id ||
    response?.order?.paymentId ||
    response?.order?.payment?.id ||
    null;

  const rollbackCancelledExtraOrder = async ({ orderId, paymentId }) => {
    if (!orderId || !paymentId) return false;

    try {
      await cancelCustomerOneTimeOrder({ orderId, paymentId, removeFromHistory: true });
      return true;
    } catch {
      return false;
    }
  };

  const processExtraOnlinePayment = async (paymentId, description) => {
    if (!paymentId) {
      throw new Error("Payment reference missing for online payment");
    }

    const scriptLoaded = await loadRazorpayCheckoutScript();
    if (!scriptLoaded) {
      throw new Error("Failed to load payment checkout");
    }

    const orderPayload = await createCustomerPaymentOrder({ paymentId });

    return new Promise((resolve, reject) => {
      const checkout = new window.Razorpay({
        key: orderPayload.keyId,
        amount: orderPayload.order.amount,
        currency: orderPayload.order.currency,
        name: "Dairy Stream",
        description: description || orderPayload.payment?.title || "Extra dairy order",
        order_id: orderPayload.order.id,
        handler: async (response) => {
          try {
            await verifyCustomerPayment({
              paymentId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            resolve({ paid: true });
          } catch (err) {
            const verificationError = new Error(
              err?.response?.data?.message || err?.message || "Payment verification failed"
            );
            verificationError.code = "PAYMENT_VERIFY_FAILED";
            reject(verificationError);
          }
        },
        modal: {
          ondismiss: () => resolve({ paid: false, dismissed: true }),
        },
        theme: { color: "#B8641A" },
      });

      checkout.on("payment.failed", (failedResponse) => {
        resolve({
          paid: false,
          failed: true,
          reason: failedResponse?.error?.description || "Payment failed",
        });
      });

      checkout.open();
    });
  };

  const closeAddExtraModal = () => {
    if (addExtraSubmitting) return;
    setShowAddExtraModal(false);
    setAddExtraError("");
    setShowDuplicateExtraConfirm(false);
  };

  const handleAddExtra = async () => {
    if (!linkedExtraDairyId) {
      showToast("No dairy is linked to your account yet.", "error");
      return;
    }

    const preferredAddress =
      String(subscription?.address || "").trim() && subscription?.address !== "-"
        ? String(subscription.address).trim()
        : getStoredCustomerAddress();
    const preferredPaymentMethod = canAddExtraToSubscriptionBill
      ? normalizeAddExtraPaymentOption(subscription?.paymentMethod)
      : "PAY_NOW_ONLINE";
    const preferredSlot = normalizeAddExtraSlot(subscription?.slot || tomorrow?.slot || "Morning");
    const preferredProductName = getPreferredExtraProductName({ subscription, tomorrow, today });
    const preferredQuantity = getPreferredExtraQuantity({ subscription, tomorrow, today });

    setAddExtraError("");
    setShowDuplicateExtraConfirm(false);
    setShowAddExtraModal(true);
    setAddExtraForm({
      selectedProducts: preferredProductName ? [preferredProductName] : [],
      quantities: preferredProductName ? { [preferredProductName]: preferredQuantity } : {},
      paymentMethod: preferredPaymentMethod,
      address: preferredAddress,
      slot: preferredSlot,
    });

    if (String(addExtraDairy?.id || "") === String(linkedExtraDairyId) && addExtraProducts.length) {
      const defaultProduct =
        addExtraProducts.find((item) => item.name === preferredProductName)?.name ||
        addExtraProducts.find((item) => !isProductOutOfStock(item.stockQuantity))?.name ||
        addExtraProducts[0]?.name ||
        "";
      const defaultProductItem = addExtraProducts.find((item) => item.name === defaultProduct);
      setAddExtraForm((prev) => ({
        ...prev,
        selectedProducts: defaultProduct ? [defaultProduct] : [],
        quantities: defaultProduct
          ? { [defaultProduct]: getDefaultProductQuantity(defaultProductItem, preferredQuantity) }
          : {},
        paymentMethod: preferredPaymentMethod,
        address: preferredAddress,
        slot: preferredSlot,
      }));
      return;
    }

    setAddExtraLoading(true);
    try {
      const response = await fetchPublicDairyById(linkedExtraDairyId);
      const dairy = response?.dairy || null;
      const products = normalizeProducts(dairy);
      const resolvedDairy = {
        id: dairy?.id || linkedExtraDairyId,
        name: dairy?.dairy_name || dairy?.name || linkedExtraDairyName || "Dairy",
      };

      setAddExtraDairy(resolvedDairy);
      setAddExtraProducts(products);

      const defaultProduct =
        products.find((item) => item.name === preferredProductName)?.name ||
        products.find((item) => !isProductOutOfStock(item.stockQuantity))?.name ||
        products[0]?.name ||
        "";
      const defaultProductItem = products.find((item) => item.name === defaultProduct);

      setAddExtraForm((prev) => ({
        ...prev,
        selectedProducts: defaultProduct ? [defaultProduct] : [],
        quantities: defaultProduct
          ? { [defaultProduct]: getDefaultProductQuantity(defaultProductItem, preferredQuantity) }
          : {},
        paymentMethod: preferredPaymentMethod,
        address: preferredAddress,
        slot: preferredSlot,
      }));

      if (!products.length) {
        setAddExtraError("No products are available in this dairy right now.");
      }
    } catch (err) {
      setAddExtraDairy({
        id: linkedExtraDairyId,
        name: linkedExtraDairyName || "Dairy",
      });
      setAddExtraProducts([]);
      setAddExtraError(err?.message || "Failed to load dairy products.");
    } finally {
      setAddExtraLoading(false);
    }
  };

  const handleSubmitExtraOrder = async (allowDuplicate = false) => {
    if (!linkedExtraDairyId) {
      setAddExtraError("No dairy is linked to your account.");
      return;
    }
    if (!selectedAddExtraOrderLines.length) {
      setAddExtraError("Please select at least one product.");
      return;
    }
    if (invalidAddExtraLine) {
      if (!Number.isFinite(invalidAddExtraLine.quantity) || invalidAddExtraLine.quantity <= 0) {
        setAddExtraError(`Quantity must be greater than zero for ${invalidAddExtraLine.product.name}.`);
        return;
      }
      if (invalidAddExtraLine.isOutOfStock) {
        setAddExtraError(`${invalidAddExtraLine.product.name} is out of stock.`);
        return;
      }
      if (invalidAddExtraLine.exceedsStock) {
        setAddExtraError(
          `Only ${invalidAddExtraLine.availableStock} available for ${invalidAddExtraLine.product.name}.`
        );
        return;
      }
    }
    if (!allowDuplicate && selectedDuplicateExtraProductNames.length > 0) {
      setShowDuplicateExtraConfirm(true);
      return;
    }
    if (!String(addExtraForm.address || "").trim() || String(addExtraForm.address || "").trim().length < 10) {
      setAddExtraError("Please enter a detailed delivery address.");
      return;
    }
    if (addExtraForm.paymentMethod === "ADD_TO_SUBSCRIPTION" && !canAddExtraToSubscriptionBill) {
      setAddExtraError(
        "Add to Subscription Bill is available only when you have an active subscription with this dairy."
      );
      return;
    }

    setAddExtraSubmitting(true);
    setAddExtraError("");

    try {
      setShowDuplicateExtraConfirm(false);

      for (const line of selectedAddExtraOrderLines) {
        const response = await createCustomerOneTimeOrder({
          dairyId: linkedExtraDairyId,
          milkType: line.product.name,
          quantity: line.quantity,
          deliveryDate: nextExtraDeliveryDate,
          slot: addExtraForm.slot,
          paymentMethod: getAddExtraOrderPaymentMethod(addExtraForm.paymentMethod),
          address: addExtraForm.address.trim(),
          pricePerLiter: Number(line.product.ratePerUnit || 0),
          isExtraOrder: true,
          allowDuplicate,
        });

        if (addExtraForm.paymentMethod !== "PAY_NOW_ONLINE") {
          continue;
        }

        const orderId = response?.order?.id || null;
        const paymentId = getExtraOrderPaymentId(response);

        if (!orderId || !paymentId) {
          await rollbackCancelledExtraOrder({ orderId, paymentId });
          setAddExtraError("Could not start payment. The extra order was not placed.");
          return;
        }

        let paymentResult = null;
        try {
          paymentResult = await processExtraOnlinePayment(paymentId, line.product.name);
        } catch (paymentErr) {
          if (paymentErr?.code === "PAYMENT_VERIFY_FAILED") {
            showToast("Payment received but verification failed. Check Payments.", "warning");
            setShowAddExtraModal(false);
            navigate("/customer/dashboard/payments");
            refreshDashboard().catch(() => {});
            return;
          }

          await rollbackCancelledExtraOrder({ orderId, paymentId });
          setAddExtraError(paymentErr?.message || "Payment cancelled. The extra order was not placed.");
          return;
        }

        if (paymentResult?.paid) {
          continue;
        }

        if (paymentResult?.dismissed || paymentResult?.failed) {
          await rollbackCancelledExtraOrder({ orderId, paymentId });
          setAddExtraError(
            paymentResult?.reason || "Payment was cancelled. The extra order was not placed."
          );
          return;
        }

        await rollbackCancelledExtraOrder({ orderId, paymentId });
        setAddExtraError("Payment was not completed. The extra order was not placed.");
        return;
      }

      const selectedCount = selectedAddExtraOrderLines.length;
      const productText = `extra product${selectedCount === 1 ? "" : "s"}`;
      showToast(
        addExtraForm.paymentMethod === "PAY_NOW_CASH"
          ? `${selectedCount} ${productText} placed for tomorrow. You can pay cash on delivery.`
          : addExtraForm.paymentMethod === "PAY_NOW_ONLINE"
          ? `${selectedCount} ${productText} placed for tomorrow.`
          : `${selectedCount} ${productText} placed for tomorrow. It will be added to your subscription bill.`,
        "success"
      );
      setShowAddExtraModal(false);
      refreshDashboard().catch(() => {});
      return;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Failed to place extra order.";
      if (!allowDuplicate && /already exists/i.test(message)) {
        setShowDuplicateExtraConfirm(true);
        return;
      }
      setAddExtraError(message);
    } finally {
      setAddExtraSubmitting(false);
    }
  };

  const syncLocalSubscriptionStatus = (nextStatus) => {
    setDashboardData((prev) => {
      const source = prev || data;
      if (!source?.subscription) return prev || source || null;

      return {
        ...source,
        subscription: {
          ...source.subscription,
          status: nextStatus,
        },
      };
    });
  };

  const handlePauseResume = async () => {
    if (!subscription?.dairyId) {
      showToast("No active subscription found.", "error");
      return;
    }

    const previousStatus = String(subscription?.status || "ACTIVE").toUpperCase();
    const nextStatus = isPaused ? "ACTIVE" : "PAUSED";
    setPendingSubscriptionStatus(nextStatus);
    setSavingPause(true);

    // Reflect the new state immediately on the home page, then confirm with the server.
    syncLocalSubscriptionStatus(nextStatus);

    try {
      const result = await saveCustomerSubscription(toSubscriptionPayload(subscription, nextStatus));
      const resolvedStatus = String(result?.subscription?.status || nextStatus).toUpperCase();
      setPendingSubscriptionStatus(resolvedStatus);
      syncLocalSubscriptionStatus(resolvedStatus);
      showToast(
        resolvedStatus === "ACTIVE" ? "Subscription resumed!" : "Subscription paused.",
        resolvedStatus === "ACTIVE" ? "success" : "warning"
      );
      refreshDashboard().catch(() => {
        // Keep the optimistic status if the follow-up refresh fails temporarily.
      });
    } catch (err) {
      setPendingSubscriptionStatus(previousStatus);
      syncLocalSubscriptionStatus(previousStatus);
      showToast(err?.message || "Failed to update subscription status.", "error");
    } finally {
      setSavingPause(false);
    }
  };

  const handleAction = (key) => {
    if (key === "add") {
      handleAddExtra();
      return;
    }

    if (key === "pause") {
      handlePauseResume();
      return;
    }

    const action = ACTIONS.find((item) => item.key === key);
    if (action?.route) {
      navigate(action.route);
    }
  };

  const openIssueModal = () => {
    if (!canReportIssue) {
      showToast("No valid delivery found to report.", "error");
      return;
    }

    setIssueText("");
    setShowIssueModal(true);
  };

  const submitIssue = async () => {
    const trimmedIssue = String(issueText || "").trim();

    if (!canReportIssue) {
      showToast("No valid delivery found to report.", "error");
      return;
    }

    if (trimmedIssue.length < 5) {
      showToast("Please enter at least 5 characters.", "error");
      return;
    }

    setReportingIssue(true);
    try {
      await reportCustomerDeliveryIssue({ deliveryId: reportId, issue: trimmedIssue });
      await refreshDashboard();
      setShowIssueModal(false);
      setIssueText("");
      showToast("Issue reported successfully.", "success");
    } catch (err) {
      showToast(err?.message || "Failed to report issue.", "error");
    } finally {
      setReportingIssue(false);
    }
  };

  if (loading && !resolvedData) {
    return (
      <CustomerLayout>
        <LoadingIndicator className="py-20" message="Loading your dashboard..." />
      </CustomerLayout>
    );
  }

  if (error && !resolvedData) {
    return (
      <CustomerLayout>
        <div className="py-20 text-center text-red-500">{error}</div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="space-y-5 lg:space-y-8" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {toast && (
          <div
            className={`fixed inset-x-3 top-4 z-50 flex items-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-semibold shadow-[0_16px_40px_rgba(84,52,16,0.14)] transition-all sm:left-auto sm:right-5 sm:top-5 sm:max-w-md ${
              toast.type === "success"
                ? "border-[#CFE4C2] bg-[#EEF5E7] text-[#4A7C2F]"
                : toast.type === "warning"
                ? "border-[#F0D1B2] bg-[#FFF1E4] text-[#B8641A]"
                : "border-[#F2D0C8] bg-[#FDECEA] text-[#C0392B]"
            }`}
          >
            {toast.type === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {toast.msg}
          </div>
        )}

        <div className="rounded-[24px] border-0 bg-transparent p-0 shadow-none sm:rounded-[30px] sm:bg-[#F5F0E8] sm:p-5 sm:shadow-[0_20px_60px_rgba(84,52,16,0.08)] xl:p-6">
          <div className="rounded-[26px] border-0 bg-[linear-gradient(180deg,#F8F2E9_0%,#FFFDF8_100%)] p-4 shadow-[0_10px_24px_rgba(84,52,16,0.04)] sm:p-6 xl:p-7">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,320px)] xl:items-start xl:gap-5">
              <div className="min-w-0 max-w-3xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">
                  Customer Overview
                </p>
                <h1
                  className="mt-2 text-[26px] font-semibold leading-[1.08] text-[#2C1A0E] sm:text-[38px] xl:text-[35px]"
                  style={headingFont}
                >
                  {greeting}, <span className="text-[#B8641A]">{customerName}</span>
                </h1>
                <p className="mt-2 text-sm text-[#8B7355]">
                  Member of{" "}
                  <span className="font-bold text-[#5C3D1E]">{dairyName}</span>
                </p>
              </div>

              <div className="w-full rounded-[18px] border border-[#E7DDCF] bg-white/90 px-4 py-3.5 backdrop-blur-sm xl:justify-self-end xl:py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C4A882]">
                  Plan Status
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      !subscription
                        ? "bg-[#F5F0E8] text-[#8B7355]"
                        : isPaused
                        ? "bg-[#FFF1E4] text-[#C86A2B]"
                        : "bg-[#EEF5E7] text-[#4A7C2F]"
                    }`}
                  >
                    {subscription ? (isPaused ? "Paused" : "Active") : "Inactive"}
                  </span>
                  <span className="text-xs font-medium text-[#8B7355]">
                    {subscription
                      ? `${subscription.quantity || "-"} L ${subscription.milkType || "Milk"}`
                      : "No active subscription"}
                  </span>
                </div>
              </div>
            </div>
          </div>

        {today && (
          <div className="relative mt-3 overflow-hidden rounded-[24px] border border-[#5C3D1E]/10 bg-[linear-gradient(135deg,#2C2416_0%,#4A3820_60%,#6B4F2A_100%)] p-4 sm:mt-4 sm:rounded-[28px] sm:p-7">
            <div
              className={`pointer-events-none absolute inset-0 rounded-[24px] sm:rounded-[28px] ${
                todayMeta.tone === "success"
                  ? "bg-[radial-gradient(circle_at_top_right,rgba(238,245,231,0.16),transparent_40%)]"
                  : todayMeta.tone === "approval"
                  ? "bg-[radial-gradient(circle_at_top_right,rgba(246,240,255,0.18),transparent_40%)]"
                  : todayMeta.tone === "failed"
                  ? "bg-[radial-gradient(circle_at_top_right,rgba(253,236,234,0.16),transparent_40%)]"
                  : todayMeta.tone === "idle"
                  ? "bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.09),transparent_40%)]"
                  : "bg-[radial-gradient(circle_at_top_right,rgba(255,241,228,0.18),transparent_40%)]"
              }`}
            />
            <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/5" />
            <div className="absolute -bottom-14 left-7 h-36 w-36 rounded-full bg-[#D28A40]/10" />

            <p className="relative mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/50 sm:mb-4">
              Today&apos;s Delivery
            </p>
            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] sm:h-14 sm:w-14 sm:rounded-[18px] ${
                      todayMeta.tone === "success"
                        ? "bg-[#EEF5E7] text-[#4A7C2F]"
                        : todayMeta.tone === "approval"
                        ? "bg-[#F6F0FF] text-[#7C4DAB]"
                        : todayMeta.tone === "failed"
                        ? "bg-[#FDECEA] text-[#C0392B]"
                        : todayMeta.tone === "idle"
                        ? "bg-white/10 text-white/80"
                        : "bg-[#FFF1E4] text-[#D98A2B]"
                    }`}
                  >
                    {todayMeta.tone === "success" ? (
                      <CheckCircle size={22} />
                    ) : (
                      <AlertCircle size={22} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1 text-[22px] font-semibold leading-tight text-white sm:text-[28px]" style={headingFont}>
                      {todayMeta.title}
                    </h3>
                    <div className="flex flex-col gap-1.5">
                      <p className="text-sm font-semibold text-white/80">
                        {today.quantity || "-"} - {today.product || "Milk"}
                      </p>
                      <p className="text-sm font-medium leading-6 text-white/85">
                        {todayMeta.helperText}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-1.5">
                  {today?.agent?.name && (
                    <p className="flex items-center gap-1.5 text-xs text-white/70">
                      <User size={11} />
                      Agent: {today.agent.name} {today.agent.phone ? `(${today.agent.phone})` : ""}
                    </p>
                  )}
                  {today.time && todayMeta.tone === "success" && (
                    <p className="flex items-center gap-1.5 text-xs text-white/70">
                      <Clock size={11} />
                      Dropped at Doorstep - {today.time}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 self-start lg:w-auto lg:min-w-[250px]">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      navigate("/customer/dashboard/track/agent", { state: { delivery: today } })
                    }
                    disabled={
                      !today?.canTrackAgent ||
                      ["NOT_SUBSCRIBED", "NOT_SCHEDULED", "PENDING_APPROVAL", "FAILED", "CANCELLED"].includes(
                        String(today?.status || "").toUpperCase()
                      )
                    }
                    className="w-full rounded-[13px] border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Track Agent
                  </button>
                  <button
                    onClick={openIssueModal}
                    disabled={
                      !Number.isFinite(Number(today?.deliveryId ?? today?.id)) ||
                      ["NOT_SUBSCRIBED", "NOT_SCHEDULED", "CANCELLED"].includes(
                        String(today?.status || "").toUpperCase()
                      )
                    }
                    className="w-full rounded-[13px] border border-[#F2D0C8]/70 bg-[#FDECEA] px-3 py-2.5 text-xs font-bold text-[#A33A2B] transition hover:bg-[#F8DDD6]"
                  >
                    {reportingIssue ? "Reporting..." : "Report Issue"}
                  </button>
                </div>

                {hasIssue && (
                  <div className="grid gap-2">
                    <div className="relative rounded-[12px] border border-rose-100 bg-rose-50 px-3 py-1.5 sm:rounded-[14px]">
                      <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-rose-400 sm:text-[9px] sm:tracking-[0.16em]">
                        Reported Issue
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium leading-3.5 text-rose-700 sm:text-xs">
                        {today.customerIssue}
                      </p>
                    </div>

                    {(hasAdminAction || issueStatus === "OPEN") && (
                      <div
                        className={`relative rounded-[12px] border px-3 py-1.5 sm:rounded-[14px] ${
                          hasAdminAction
                            ? "border-emerald-100 bg-emerald-50"
                            : "border-amber-100 bg-amber-50"
                        }`}
                      >
                        <p
                          className={`text-[8px] font-bold uppercase tracking-[0.14em] sm:text-[9px] sm:tracking-[0.16em] ${
                            hasAdminAction ? "text-emerald-500" : "text-amber-500"
                          }`}
                        >
                          {hasAdminAction ? "Action Taken" : "Issue Status"}
                        </p>
                        <p
                          className={`mt-0.5 text-[11px] font-medium leading-3.5 sm:text-xs ${
                            hasAdminAction ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          {hasAdminAction ? today.issueAdminAction : "Pending resolution"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-7 md:grid-cols-4 lg:gap-4">
          {ACTIONS.map((action) => {
            const { key, label, bg, text, border } = action;
            const ActionIcon = action.Icon;

            return (
              <button
                key={key}
                onClick={() => handleAction(key)}
                disabled={key === "pause" && !canTogglePause}
                className={`rounded-[18px] border bg-[#FFFDF7] px-3.5 py-4 text-left transition hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(100,72,35,0.08)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 ${border}`}
              >
                <div className={`mb-2.5 flex h-10 w-10 items-center justify-center rounded-[13px] ${bg} ${text} sm:h-11 sm:w-11`}>
                  {key === "pause" && isPaused ? <PlayCircle size={18} /> : <ActionIcon size={18} />}
                </div>
                <span className="text-[13px] font-bold text-[#2C1A0E] sm:text-sm">
                  {key === "pause" ? pauseToggleLabel : label}
                </span>
                <p className="mt-1 text-[11px] leading-5 text-[#B89970] sm:text-xs">
                  {key === "pause"
                    ? pauseToggleHelper
                    : key === "add"
                    ? "Choose extra products for tomorrow"
                    : key === "deliveries"
                    ? "Review delivery history"
                    : "Open payment center"}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:mt-7 lg:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
          <div className="space-y-4 rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF7] p-4 sm:space-y-5 sm:p-6">
            {showTomorrowCard ? (
              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">
                  Tomorrow
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[13px] bg-[#FFF4E2] text-[#B8641A] sm:h-11 sm:w-11">
                      {hasSubscription ? <Truck size={18} /> : <PlusCircle size={18} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-[#2C1A0E]">{tomorrowTitle}</p>
                      <p className="mt-0.5 text-sm text-[#8B7355]">{tomorrowSubtitle}</p>

                      {hasTomorrowExtras && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {tomorrowExtraOrders.map((order) => (
                            <div
                              key={order.id}
                              className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-[#F2EDE4] bg-[#FBF7F0] px-2.5 py-1.5"
                            >
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#FFF4E2] text-xs font-bold leading-none text-[#B8641A]">
                                +
                              </span>
                              <span className="text-xs font-bold text-[#5C3D1E]">
                                {order.quantity || "-"} {order.product || "Milk"}
                              </span>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${getTomorrowExtraStatusClasses(
                                  order.status
                                )}`}
                              >
                                {formatTomorrowExtraStatus(order.status)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {hasSubscription && (
                    <button
                      onClick={() => navigate("/customer/dashboard/subscriptions")}
                      className="w-full rounded-[12px] border border-[#EDE8DF] bg-white px-3 py-2 text-xs font-bold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E] sm:w-auto"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">
                  Tomorrow
                </p>
                <div className="rounded-[16px] border border-dashed border-[#E7DAC6] bg-[#FBF7F0] px-4 py-4.5">
                  <p className="text-sm font-bold text-[#5C3D1E]">No active subscription</p>
                  <p className="mt-1 text-xs text-[#A88763]">
                    Subscribe to schedule your next delivery automatically.
                  </p>
                  <button
                    onClick={() => navigate("/customer/dashboard/subscriptions")}
                    className="mt-3 inline-flex items-center rounded-[12px] bg-[#B8641A] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#9F5313]"
                  >
                    Start Subscription
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-[#F2EDE4] pt-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">
                Subscription
              </p>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-sm font-semibold leading-6 text-[#5C3D1E]">
                  {subscription
                    ? `${subscription.milkType || "Milk"} - ${subscription.quantity || "-"} L Daily`
                    : "No active subscription"}
                </p>
                <span
                  className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                    !subscription
                      ? "bg-[#F5F0E8] text-[#8B7355]"
                      : isPaused
                      ? "bg-[#FFF1E4] text-[#C86A2B]"
                      : "bg-[#EEF5E7] text-[#4A7C2F]"
                  }`}
                >
                  {subscription ? (isPaused ? "Paused" : "Active") : "Inactive"}
                </span>
              </div>
              <p className="mb-4 text-xs text-[#A88763]">
                Start date: {subscription?.startDate || "Not available"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handlePauseResume}
                  disabled={!canTogglePause}
                  className={`flex-1 rounded-[14px] border py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isPaused
                      ? "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F] hover:bg-[#E3EED8]"
                      : "border-[#F2D0C8] bg-[#FDECEA] text-[#C0392B] hover:bg-[#F8DDD6]"
                  }`}
                >
                  {pauseToggleLabel}
                </button>
                <button
                  onClick={() => navigate("/customer/dashboard/subscriptions")}
                  className="flex-1 rounded-[14px] border border-[#EFD7B3] bg-[#FFF4E2] py-2.5 text-xs font-bold text-[#B8641A] transition hover:bg-[#FCE8CB]"
                >
                  Modify Plan
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-[#EDE8DF] bg-[linear-gradient(180deg,#FFFDF7_0%,#FBF7F0_100%)] p-4 sm:p-6">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">
              Billing Summary
            </p>
            <div className="mb-1">
              <span className="text-[34px] font-semibold tracking-tight text-[#2C1A0E] sm:text-4xl" style={headingFont}>
                Rs.{billing.monthlyDue ?? 0}
              </span>
            </div>
            {billing.dueInDays != null && (
              <p className="mb-4 inline-flex rounded-full bg-[#FDECEA] px-3 py-1 text-xs font-semibold text-[#C0392B]">
                {getBillingDueText(billing.dueInDays)}
              </p>
            )}
            <div className="mb-4 space-y-0">
              {[
                { label: "Wallet Balance", value: `Rs.${billing.walletBalance ?? 0}` },
                { label: "Last Payment", value: "Not available" },
                { label: "Payment Mode", value: subscription?.paymentMethod || "UPI" },
                { label: "Status", value: billing.monthlyDue > 0 ? "Pending" : "Clear", highlight: true },
              ].map(({ label, value, highlight }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 border-b border-[#F2EDE4] py-2.5 last:border-none"
                >
                  <span className="text-xs text-[#8B7355]">{label}</span>
                  <span className={`text-xs font-semibold ${highlight ? "text-[#B8641A]" : "text-[#5C3D1E]"}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate("/customer/dashboard/payments")}
              className="mb-2 w-full rounded-[14px] bg-[#2C2416] py-2.5 text-sm font-bold text-white transition hover:bg-[#4A3820]"
            >
              Pay Now
            </button>
            <button
              onClick={() => navigate("/customer/dashboard/payments")}
              className="flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-[#EDE8DF] bg-white py-2.5 text-xs font-semibold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E]"
            >
              View Full Invoice <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-[18px] border border-[#F2D0C8] bg-[#FDECEA] px-4 py-3 text-sm text-[#C0392B]">
            {error}
          </div>
        )}

        {showAddExtraModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2C2416]/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
            <div className="flex h-[100svh] max-h-[100svh] w-full max-w-5xl flex-col overflow-hidden rounded-none border border-[#E7DAC6] bg-[#FFFDF7] shadow-[0_28px_80px_rgba(44,26,14,0.28)] sm:max-h-[92vh] sm:rounded-[28px]">
              <div className="flex items-start justify-between gap-4 border-b border-[#F2EDE4] px-4 py-4 sm:px-7 sm:py-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                    Next-Day Extra Order
                  </p>
                  <h3
                    className="mt-2 text-[24px] font-semibold leading-tight text-[#2C1A0E] sm:text-[28px]"
                    style={headingFont}
                  >
                    Add Products From{" "}
                    <span className="text-[#B8641A]">
                      {addExtraDairy?.name || linkedExtraDairyName || "Your Dairy"}
                    </span>
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm text-[#8B7355]">
                    Choose one or more products, set quantities, and place them for {nextExtraDeliveryLabel}.
                  </p>
                </div>

                <button
                  onClick={closeAddExtraModal}
                  disabled={addExtraSubmitting}
                  className="rounded-full border border-[#EDE8DF] bg-white p-2 text-[#8B7355] transition hover:border-[#D4B896] hover:text-[#5C3D1E] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 grid xl:grid-cols-[minmax(0,1.35fr)_360px]">
                <div className="min-h-0 overflow-y-auto p-4 sm:p-7">
                  {addExtraLoading ? (
                    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-[#E7DAC6] bg-[#FBF7F0]">
                      <Loader2 size={28} className="animate-spin text-[#B8641A]" />
                      <p className="text-sm font-semibold text-[#8B7355]">
                        Loading dairy products...
                      </p>
                    </div>
                  ) : !addExtraProducts.length ? (
                    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-[#E7DAC6] bg-[#FBF7F0] px-6 text-center">
                      <PlusCircle size={28} className="text-[#C4A882]" />
                      <p className="text-base font-semibold text-[#5C3D1E]">
                        No products available right now
                      </p>
                      <p className="max-w-md text-sm text-[#8B7355]">
                        Ask the dairy owner to add products in the catalog, then try again.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-5 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#FFF4E2] px-3 py-1 text-xs font-bold text-[#B8641A]">
                          Delivery: {nextExtraDeliveryLabel}
                        </span>
                        <span className="rounded-full bg-[#F5F0E8] px-3 py-1 text-xs font-bold text-[#8B7355]">
                          {addExtraForm.slot} slot
                        </span>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {addExtraProducts.map((product) => {
                          const isSelected = addExtraForm.selectedProducts?.includes(product.name);
                          const isDisabled = isProductOutOfStock(product.stockQuantity);

                          return (
                            <button
                              key={product.id}
                              type="button"
                              disabled={isDisabled}
                              onClick={() =>
                                setAddExtraForm((prev) => {
                                  const selectedProducts = prev.selectedProducts || [];
                                  const quantities = { ...(prev.quantities || {}) };

                                  if (selectedProducts.includes(product.name)) {
                                    delete quantities[product.name];
                                    return {
                                      ...prev,
                                      selectedProducts: selectedProducts.filter((name) => name !== product.name),
                                      quantities,
                                    };
                                  }

                                  return {
                                    ...prev,
                                    selectedProducts: [...selectedProducts, product.name],
                                    quantities: {
                                      ...quantities,
                                      [product.name]: quantities[product.name] || getDefaultProductQuantity(product),
                                    },
                                  };
                                })
                              }
                              className={`rounded-[18px] border px-4 py-3 text-left transition ${
                                isDisabled
                                  ? "cursor-not-allowed border-[#F2EDE4] bg-[#FBF7F0] opacity-60"
                                  : isSelected
                                  ? "border-[#B8641A] bg-[#FFF4E2] shadow-[0_16px_30px_rgba(184,100,26,0.12)]"
                                  : "border-[#EDE8DF] bg-white hover:-translate-y-0.5 hover:border-[#D4B896] hover:shadow-[0_12px_24px_rgba(100,72,35,0.08)]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[15px] font-bold leading-tight text-[#2C1A0E]">{product.name}</p>
                                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C4A882]">
                                    {getProductUnitLabel(product.unit)}
                                  </p>
                                </div>
                                {isSelected && (
                                  <span className="rounded-full bg-[#B8641A] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                                    Selected
                                  </span>
                                )}
                                {!isSelected && !isDisabled && (
                                  <span className="rounded-full border border-[#EDE8DF] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8B7355]">
                                    Add
                                  </span>
                                )}
                              </div>

                              <p className="mt-3 text-[24px] font-bold leading-none text-[#B8641A]">
                                Rs.{Number(product.ratePerUnit || 0).toFixed(2)}
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#8B7355]">
                                Per {getProductUnitLabel(product.unit, { lowercase: true })}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="min-h-0 border-t border-[#F2EDE4] bg-[#FBF7F0] xl:border-l xl:border-t-0">
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
                      {addExtraError && (
                        <div className="rounded-[16px] border border-[#F2D0C8] bg-[#FDECEA] px-4 py-3 text-sm text-[#C0392B]">
                          {addExtraError}
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="rounded-[16px] border border-[#E7DAC6] bg-[#FFF8EC] px-4 py-3 text-sm font-medium text-[#8B7355]">
                          Tomorrow delivery: Daily delivery ({dailyDeliverySummary}) +
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">
                            Selected Products
                          </label>
                          {selectedAddExtraOrderLines.length === 0 ? (
                            <div className="rounded-[16px] border border-dashed border-[#E7DAC6] bg-white px-4 py-4 text-sm font-semibold text-[#8B7355]">
                              Select products from the list to add them here.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {selectedAddExtraOrderLines.map((line) => {
                                const unitShort = getProductUnitLabel(line.product.unit, { short: true });
                                const unitLower = getProductUnitLabel(line.product.unit, { lowercase: true });
                                const quantityStep = getProductQuantityStep(line.product.unit);

                                return (
                                  <div
                                    key={line.product.id}
                                    className="rounded-[14px] border border-[#EDE8DF] bg-white px-3 py-2.5"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="truncate text-[13px] font-bold text-[#2C1A0E]">
                                          {line.product.name}
                                        </p>
                                        <p className="text-[11px] text-[#8B7355]">
                                          Rs.{Number(line.product.ratePerUnit || 0).toFixed(2)} per {unitLower}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setAddExtraForm((prev) => {
                                            const quantities = { ...(prev.quantities || {}) };
                                            delete quantities[line.product.name];
                                            return {
                                              ...prev,
                                              selectedProducts: (prev.selectedProducts || []).filter(
                                                (name) => name !== line.product.name
                                              ),
                                              quantities,
                                            };
                                          })
                                        }
                                        className="rounded-full border border-[#EDE8DF] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#8B7355] transition hover:border-[#D4B896] hover:text-[#5C3D1E]"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                                      <input
                                        type="number"
                                        min={quantityStep}
                                        step={quantityStep}
                                        value={line.quantityValue}
                                        onChange={(event) =>
                                          setAddExtraForm((prev) => ({
                                            ...prev,
                                            quantities: {
                                              ...(prev.quantities || {}),
                                              [line.product.name]: event.target.value,
                                            },
                                          }))
                                        }
                                        className="w-full rounded-[12px] border border-[#EDE8DF] bg-[#FFFDF7] px-3 py-2 text-sm font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A]"
                                      />
                                      <span className="min-w-7 text-xs font-bold text-[#8B7355]">
                                        {unitShort}
                                      </span>
                                      <p className="text-right text-[11px] font-bold text-[#B8641A]">
                                        Rs.{Number.isFinite(line.lineTotal) ? line.lineTotal.toFixed(2) : "0.00"}
                                      </p>
                                    </div>
                                    {(line.isOutOfStock || line.exceedsStock) && (
                                      <p className="mt-1.5 text-[11px] font-semibold text-[#C0392B]">
                                        {line.isOutOfStock
                                          ? `${line.product.name} is out of stock`
                                          : `Requested quantity is more than available ${unitLower} stock`}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">
                        Payment Option
                      </label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {addExtraPaymentOptions.map((method) => (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() =>
                              setAddExtraForm((prev) => ({
                                ...prev,
                                paymentMethod: method.id,
                              }))
                            }
                            className={`flex min-h-[84px] items-center justify-center rounded-[14px] border px-3 py-2.5 text-center text-sm font-bold leading-6 transition ${
                              addExtraForm.paymentMethod === method.id
                                ? "border-[#B8641A] bg-[#FFF4E2] text-[#B8641A]"
                                : "border-[#EDE8DF] bg-white text-[#8B7355] hover:border-[#D4B896] hover:text-[#5C3D1E]"
                            }`}
                          >
                            {method.label}
                          </button>
                        ))}
                      </div>
                      {!canAddExtraToSubscriptionBill && (
                        <p className="mt-2 text-xs font-medium text-[#8B7355]">
                          Add to Subscription Bill is available only for customers with an active subscription in this dairy.
                        </p>
                      )}
                      {addExtraForm.paymentMethod === "ADD_TO_SUBSCRIPTION" && (
                        <p className="mt-2 text-xs font-medium text-[#8B7355]">
                          This extra order will be added to your subscription bill.
                        </p>
                      )}
                    </div>

                      </div>

                  <div className="space-y-3 border-t border-[#E7DAC6] bg-[#FBF7F0] p-4 sm:p-7">
                    <button
                      type="button"
                      onClick={() => handleSubmitExtraOrder(false)}
                      disabled={!canSubmitAddExtraOrder}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#B8641A_0%,#8F4D12_100%)] px-4 py-3.5 text-sm font-bold text-white shadow-[0_16px_30px_rgba(143,77,18,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_34px_rgba(143,77,18,0.28)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:translate-y-0"
                    >
                      {addExtraSubmitting ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <PlusCircle size={15} />
                      )}
                      <span>{addExtraSubmitLabel}</span>
                    </button>

                    <button
                      type="button"
                      onClick={closeAddExtraModal}
                      disabled={addExtraSubmitting}
                      className="w-full rounded-[16px] border border-[#EDE8DF] bg-white px-4 py-2.5 text-sm font-semibold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showIssueModal && (
          <ReportIssueModal
            issueText={issueText}
            saving={reportingIssue}
            onClose={() => {
              if (reportingIssue) return;
              setShowIssueModal(false);
            }}
            onChange={setIssueText}
            onSubmit={submitIssue}
          />
        )}

        {showAddExtraModal && showDuplicateExtraConfirm && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/20 px-4 pb-4 sm:items-center sm:pb-0">
            <div className="w-full max-w-md rounded-[24px] border border-[#E7DAC6] bg-[#FFFDF7] p-5 shadow-[0_24px_60px_rgba(44,26,14,0.28)] sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                Duplicate Order
              </p>
              <h4 className="mt-2 text-xl font-semibold text-[#2C1A0E]" style={headingFont}>
                Some products are already added for tomorrow
              </h4>
              <p className="mt-2 text-sm text-[#8B7355]">
                {selectedDuplicateExtraProductNames.length > 0
                  ? `${selectedDuplicateExtraProductNames.join(", ")} already ${
                      selectedDuplicateExtraProductNames.length === 1 ? "has" : "have"
                    } an extra order for this date.`
                  : "One or more selected products already have an extra order for this date."}{" "}
                Do you want to place another extra order anyway?
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowDuplicateExtraConfirm(false)}
                  className="flex-1 rounded-[14px] border border-[#EDE8DF] bg-white px-4 py-2.5 text-sm font-semibold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={addExtraSubmitting}
                  onClick={() => handleSubmitExtraOrder(true)}
                  className="flex-1 rounded-[14px] bg-[#B8641A] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#9F5313] disabled:cursor-not-allowed disabled:bg-[#D8C8B2]"
                >
                  {addExtraSubmitting ? "Ordering..." : "Order Anyway"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </CustomerLayout>
  );
}

function ReportIssueModal({ issueText, saving, onClose, onChange, onSubmit }) {
  const presets = [
    "Milk packet damaged",
    "Quantity mismatch",
    "Delivery not received",
    "Late delivery",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 px-4 pb-4 sm:items-center sm:pb-0">
      <div className="w-full max-w-lg rounded-t-[28px] border border-gray-200 bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-red-400">
              Delivery Support
            </p>
            <h3 className="mt-2 text-xl font-bold text-gray-900">
              Report a delivery issue
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Mention missing items, damaged packets, delay, wrong quantity, or any delivery problem.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Describe the issue
          </label>
          <textarea
            rows={5}
            value={issueText}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Example: I received only 1 packet instead of 2, and one packet was leaking."
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-red-300 focus:bg-white"
          />
          <p className="mt-2 text-xs text-gray-400">Minimum 5 characters.</p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Submitting..." : "Submit Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}
