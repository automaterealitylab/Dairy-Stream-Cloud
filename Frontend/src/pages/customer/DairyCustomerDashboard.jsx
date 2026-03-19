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
  MapPin,
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

const formatUpcomingMessage = (alert) => {
  if (!alert?.date) return "";
  const parts = [];
  if (alert.product) parts.push(alert.product);
  if (alert.quantity) parts.push(alert.quantity);
  const itemSummary = parts.join(" ");
  return `Upcoming delivery scheduled${
    itemSummary ? `: ${itemSummary}` : ""
  } on ${alert.date}.`;
};

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

const formatProductStockLabel = (stockQuantity, unit) => {
  const stock = Number(stockQuantity);
  if (!Number.isFinite(stock)) return "Unlimited";
  if (stock <= 0) return "Out of stock";
  return `${formatMeasureValue(stock)} ${getProductUnitLabel(unit, { short: true })} available`;
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

const normalizeAddExtraPaymentMethod = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "COD" || normalized === "CASH" ? "COD" : "PAY_NOW";
};

const normalizeAddExtraSlot = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized.startsWith("EVE")) return "Evening";
  return "Morning";
};

const getTodayDeliveryMeta = (delivery = {}) => {
  const status = String(delivery?.status || "").toUpperCase();
  const hasAgent = Boolean(delivery?.agent?.name);

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
  const [bannerVisible, setBannerVisible] = useState(true);
  const [savingPause, setSavingPause] = useState(false);
  const [pendingSubscriptionStatus, setPendingSubscriptionStatus] = useState(null);
  const [toast, setToast] = useState(null);
  const [showAddExtraModal, setShowAddExtraModal] = useState(false);
  const [addExtraLoading, setAddExtraLoading] = useState(false);
  const [addExtraSubmitting, setAddExtraSubmitting] = useState(false);
  const [addExtraError, setAddExtraError] = useState("");
  const [addExtraDairy, setAddExtraDairy] = useState(null);
  const [addExtraProducts, setAddExtraProducts] = useState([]);
  const [showDuplicateExtraConfirm, setShowDuplicateExtraConfirm] = useState(false);
  const [addExtraForm, setAddExtraForm] = useState({
    milkType: "",
    quantity: "1",
    paymentMethod: "PAY_NOW",
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
  const upcomingMsg = useMemo(
    () => formatUpcomingMessage(resolvedData?.alerts?.upcomingDelivery),
    [resolvedData?.alerts?.upcomingDelivery]
  );

  useEffect(() => {
    setBannerVisible(true);
  }, [upcomingMsg]);

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
  const todayMeta = getTodayDeliveryMeta(today);
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
  const nextExtraDeliveryLabel = new Date(`${nextExtraDeliveryDate}T00:00:00`).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
  const selectedAddExtraProduct = useMemo(
    () => addExtraProducts.find((item) => item.name === addExtraForm.milkType) || null,
    [addExtraProducts, addExtraForm.milkType]
  );
  const addExtraQuantity = Number(addExtraForm.quantity || 0);
  const addExtraAvailableStock = useMemo(() => {
    if (!selectedAddExtraProduct) return 0;
    const stock = Number(selectedAddExtraProduct.stockQuantity);
    return Number.isFinite(stock) ? stock : Number.POSITIVE_INFINITY;
  }, [selectedAddExtraProduct]);
  const isAddExtraStockLimited = Number.isFinite(addExtraAvailableStock);
  const isAddExtraOutOfStock = isAddExtraStockLimited && addExtraAvailableStock <= 0;
  const doesAddExtraExceedStock =
    isAddExtraStockLimited && addExtraQuantity > addExtraAvailableStock;
  const selectedAddExtraUnitShort = getProductUnitLabel(selectedAddExtraProduct?.unit, {
    short: true,
  });
  const selectedAddExtraUnitLower = getProductUnitLabel(selectedAddExtraProduct?.unit, {
    lowercase: true,
  });
  const selectedAddExtraQuantityStep = getProductQuantityStep(selectedAddExtraProduct?.unit);
  const addExtraTotal = Number(
    (Number(selectedAddExtraProduct?.ratePerUnit || 0) * Number(addExtraForm.quantity || 0)).toFixed(2)
  );
  const addExtraFooterSummary = selectedAddExtraProduct
    ? `${formatMeasureValue(addExtraQuantity || 0)} ${selectedAddExtraUnitShort} ${
        selectedAddExtraProduct.name
      } \u2022 ${addExtraForm.slot} slot \u2022 ${nextExtraDeliveryLabel}`
    : `Extra order for ${nextExtraDeliveryLabel} \u2022 ${addExtraForm.slot} slot`;
  const canSubmitAddExtraOrder =
    !addExtraLoading &&
    !addExtraSubmitting &&
    Boolean(selectedAddExtraProduct) &&
    !isAddExtraOutOfStock &&
    !doesAddExtraExceedStock;

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
      await cancelCustomerOneTimeOrder({ orderId, paymentId });
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
    const preferredPaymentMethod = normalizeAddExtraPaymentMethod(subscription?.paymentMethod);
    const preferredSlot = normalizeAddExtraSlot(subscription?.slot || tomorrow?.slot || "Morning");

    setAddExtraError("");
    setShowDuplicateExtraConfirm(false);
    setShowAddExtraModal(true);
    setAddExtraForm({
      milkType: "",
      quantity: "1",
      paymentMethod: preferredPaymentMethod,
      address: preferredAddress,
      slot: preferredSlot,
    });

    if (String(addExtraDairy?.id || "") === String(linkedExtraDairyId) && addExtraProducts.length) {
      const defaultProduct =
        addExtraProducts.find((item) => !isProductOutOfStock(item.stockQuantity))?.name ||
        addExtraProducts[0]?.name ||
        "";
      setAddExtraForm((prev) => ({
        ...prev,
        milkType: defaultProduct,
        quantity: "1",
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
        products.find((item) => !isProductOutOfStock(item.stockQuantity))?.name ||
        products[0]?.name ||
        "";

      setAddExtraForm((prev) => ({
        ...prev,
        milkType: defaultProduct,
        quantity: "1",
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
    if (!selectedAddExtraProduct) {
      setAddExtraError("Please select a product.");
      return;
    }
    if (!Number.isFinite(addExtraQuantity) || addExtraQuantity <= 0) {
      setAddExtraError("Quantity must be greater than zero.");
      return;
    }
    if (doesAddExtraExceedStock) {
      setAddExtraError(`Only ${addExtraAvailableStock} available for ${selectedAddExtraProduct.name}.`);
      return;
    }
    if (!String(addExtraForm.address || "").trim() || String(addExtraForm.address || "").trim().length < 10) {
      setAddExtraError("Please enter a detailed delivery address.");
      return;
    }

    setAddExtraSubmitting(true);
    setAddExtraError("");

    try {
      const response = await createCustomerOneTimeOrder({
        dairyId: linkedExtraDairyId,
        milkType: selectedAddExtraProduct.name,
        quantity: addExtraQuantity,
        deliveryDate: nextExtraDeliveryDate,
        slot: addExtraForm.slot,
        paymentMethod: addExtraForm.paymentMethod,
        address: addExtraForm.address.trim(),
        pricePerLiter: Number(selectedAddExtraProduct.ratePerUnit || 0),
        isExtraOrder: true,
        allowDuplicate,
      });

      setShowDuplicateExtraConfirm(false);

      if (addExtraForm.paymentMethod === "PAY_NOW") {
        const orderId = response?.order?.id || null;
        const paymentId = getExtraOrderPaymentId(response);

        if (!orderId || !paymentId) {
          await rollbackCancelledExtraOrder({ orderId, paymentId });
          setAddExtraError("Could not start payment. The extra order was not placed.");
          return;
        }

        let paymentResult = null;
        try {
          paymentResult = await processExtraOnlinePayment(paymentId, selectedAddExtraProduct.name);
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
          showToast("Extra order placed for tomorrow.", "success");
          setShowAddExtraModal(false);
          refreshDashboard().catch(() => {});
          return;
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

      showToast("Extra order placed for tomorrow.", "success");
      setShowAddExtraModal(false);
      refreshDashboard().catch(() => {});
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
      <div className="space-y-8 lg:space-y-10" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {toast && (
          <div
            className={`fixed right-5 top-5 z-50 flex items-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-semibold shadow-[0_16px_40px_rgba(84,52,16,0.14)] transition-all ${
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

        <div className="rounded-[30px] border border-[#EDE8DF] bg-[#F5F0E8] p-5 shadow-[0_20px_60px_rgba(84,52,16,0.08)] sm:p-7 xl:p-9">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                Customer Overview
              </p>
              <h1
                className="mt-2 text-[32px] font-semibold leading-tight text-[#2C1A0E] sm:text-[38px]"
                style={headingFont}
              >
                {greeting}, <span className="text-[#B8641A]">{customerName}</span>
              </h1>
              <p className="mt-2 text-sm text-[#8B7355]">
                Member of{" "}
                <span className="font-bold text-[#5C3D1E]">{dairyName}</span>
              </p>
            </div>

            <div className="self-start rounded-[18px] border border-[#EDE8DF] bg-[#FFFDF7] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                Plan Status
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
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
                <span className="text-xs text-[#8B7355]">
                  {subscription
                    ? `${subscription.quantity || "-"} L ${subscription.milkType || "Milk"}`
                    : "No active subscription"}
                </span>
              </div>
            </div>
          </div>

          {bannerVisible && upcomingMsg && (
            <div className="mt-7 flex items-start justify-between gap-3 rounded-[20px] border border-[#EFD7B3] bg-[#FFF8EC] px-4 py-4">
              <div className="flex items-start gap-2.5 text-sm text-[#8C5A1A]">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-[#B8641A]" />
                {upcomingMsg}
              </div>
              <button
                onClick={() => setBannerVisible(false)}
                className="ml-3 flex-shrink-0 rounded-full p-1 text-[#C4A882] transition hover:bg-white hover:text-[#8B7355]"
              >
                <X size={16} />
              </button>
            </div>
          )}

        {today && (
          <div className="relative mt-8 overflow-hidden rounded-[28px] border border-[#5C3D1E]/10 bg-[linear-gradient(135deg,#2C2416_0%,#4A3820_60%,#6B4F2A_100%)] p-7 sm:p-8">
            <div
              className={`absolute inset-0 rounded-[28px] pointer-events-none ${
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

            <p className="relative mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">
              Today&apos;s Delivery
            </p>
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div
                className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px] ${
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
                  <CheckCircle size={28} />
                ) : (
                  <AlertCircle size={28} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="mb-1 text-[28px] font-semibold leading-tight text-white" style={headingFont}>
                  {todayMeta.title}
                </h3>
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-semibold text-white/80">
                    {today.quantity || "-"} - {today.product || "Milk"}
                  </p>
                  <p className="text-sm font-medium text-white/85">{todayMeta.helperText}</p>
                  {today?.agent?.name && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-white/70">
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
              <div className="flex flex-col gap-2 self-start">
                <button
                  onClick={() =>
                    navigate("/customer/dashboard/track/agent", { state: { delivery: today } })
                  }
                  disabled={
                    !today?.canTrackAgent ||
                    ["NOT_SUBSCRIBED", "NOT_SCHEDULED", "PENDING_APPROVAL", "FAILED"].includes(
                      String(today?.status || "").toUpperCase()
                    )
                  }
                  className="rounded-[14px] border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Track Agent
                </button>
                <button
                  onClick={() => navigate("/customer/dashboard/deliveries")}
                  disabled={
                    !Number.isFinite(Number(today?.deliveryId ?? today?.id)) ||
                    ["NOT_SUBSCRIBED", "NOT_SCHEDULED"].includes(
                      String(today?.status || "").toUpperCase()
                    )
                  }
                  className="rounded-[14px] border border-[#F2D0C8]/70 bg-[#FDECEA] px-4 py-2.5 text-xs font-bold text-[#A33A2B] transition hover:bg-[#F8DDD6]"
                >
                  Report Issue
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-5">
          {ACTIONS.map(({ key, label, Icon, bg, text, border }) => (
            <button
              key={key}
              onClick={() => handleAction(key)}
              disabled={key === "pause" && !canTogglePause}
              className={`rounded-[20px] border bg-[#FFFDF7] px-4 py-4 text-left transition hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(100,72,35,0.08)] disabled:cursor-not-allowed disabled:opacity-50 ${border}`}
            >
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] ${bg} ${text}`}>
                {key === "pause" && isPaused ? <PlayCircle size={20} /> : <Icon size={20} />}
              </div>
              <span className="text-sm font-bold text-[#2C1A0E]">
                {key === "pause" ? pauseToggleLabel : label}
              </span>
              <p className="mt-1 text-xs text-[#B89970]">
                {key === "pause"
                  ? pauseToggleHelper
                  : key === "add"
                  ? "Choose extra products for tomorrow"
                  : key === "deliveries"
                  ? "Review delivery history"
                  : "Open payment center"}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-6 rounded-[24px] border border-[#EDE8DF] bg-[#FFFDF7] p-6 sm:p-7">
            {tomorrow && hasSubscription ? (
              <div>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                  Tomorrow
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#FFF4E2] text-[#B8641A]">
                    <Truck size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-[#2C1A0E]">
                      {tomorrow.quantity || "-"} {subscription?.milkType || "Milk"}
                    </p>
                    <p className="mt-0.5 text-sm text-[#8B7355]">{tomorrow.slot || "-"} slot</p>
                  </div>
                  <button
                    onClick={() => navigate("/customer/dashboard/subscriptions")}
                    className="flex-shrink-0 rounded-[12px] border border-[#EDE8DF] bg-white px-3 py-1.5 text-xs font-bold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E]"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                  Tomorrow
                </p>
                <div className="rounded-[18px] border border-dashed border-[#E7DAC6] bg-[#FBF7F0] px-4 py-5">
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

            <div className="border-t border-[#F2EDE4] pt-5">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                Subscription
              </p>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-[#5C3D1E]">
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
              <div className="flex gap-2">
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

          <div className="rounded-[24px] border border-[#EDE8DF] bg-[#FFFDF7] p-6 sm:p-7">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
              Billing Summary
            </p>
            <div className="mb-1">
              <span className="text-4xl font-semibold tracking-tight text-[#2C1A0E]" style={headingFont}>
                Rs.{billing.monthlyDue ?? 0}
              </span>
            </div>
            {billing.dueInDays != null && (
              <p className="mb-4 text-xs font-semibold text-[#C0392B]">
                {getBillingDueText(billing.dueInDays)}
              </p>
            )}
            <div className="mb-5 space-y-0">
              {[
                { label: "Wallet Balance", value: `Rs.${billing.walletBalance ?? 0}` },
                { label: "Last Payment", value: "Not available" },
                { label: "Payment Mode", value: subscription?.paymentMethod || "UPI" },
                { label: "Status", value: billing.monthlyDue > 0 ? "Pending" : "Clear", highlight: true },
              ].map(({ label, value, highlight }) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-[#F2EDE4] py-2.5 last:border-none"
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
              className="mb-2 w-full rounded-[16px] bg-[#2C2416] py-3 text-sm font-bold text-white transition hover:bg-[#4A3820]"
            >
              Pay Now
            </button>
            <button
              onClick={() => navigate("/customer/dashboard/payments")}
              className="flex w-full items-center justify-center gap-1.5 rounded-[16px] border border-[#EDE8DF] bg-white py-2.5 text-xs font-semibold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E]"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C2416]/45 px-4 py-6 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-[#E7DAC6] bg-[#FFFDF7] shadow-[0_28px_80px_rgba(44,26,14,0.28)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#F2EDE4] px-6 py-5 sm:px-7">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                    Next-Day Extra Order
                  </p>
                  <h3
                    className="mt-2 text-[28px] font-semibold leading-tight text-[#2C1A0E]"
                    style={headingFont}
                  >
                    Add Products From{" "}
                    <span className="text-[#B8641A]">
                      {addExtraDairy?.name || linkedExtraDairyName || "Your Dairy"}
                    </span>
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm text-[#8B7355]">
                    Choose a product, set the quantity, and place it for {nextExtraDeliveryLabel}.
                    The request will appear in your delivery history and the dairy owner&apos;s
                    approval queue.
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

              <div className="min-h-0 flex-1 grid lg:grid-cols-[minmax(0,1.35fr)_360px]">
                <div className="min-h-0 overflow-y-auto p-6 sm:p-7">
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

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {addExtraProducts.map((product) => {
                          const isSelected = addExtraForm.milkType === product.name;
                          const isDisabled = isProductOutOfStock(product.stockQuantity);

                          return (
                            <button
                              key={product.id}
                              type="button"
                              disabled={isDisabled}
                              onClick={() =>
                                setAddExtraForm((prev) => ({
                                  ...prev,
                                  milkType: product.name,
                                }))
                              }
                              className={`rounded-[20px] border px-4 py-4 text-left transition ${
                                isDisabled
                                  ? "cursor-not-allowed border-[#F2EDE4] bg-[#FBF7F0] opacity-60"
                                  : isSelected
                                  ? "border-[#B8641A] bg-[#FFF4E2] shadow-[0_16px_30px_rgba(184,100,26,0.12)]"
                                  : "border-[#EDE8DF] bg-white hover:-translate-y-0.5 hover:border-[#D4B896] hover:shadow-[0_12px_24px_rgba(100,72,35,0.08)]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-base font-bold text-[#2C1A0E]">{product.name}</p>
                                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#C4A882]">
                                    {getProductUnitLabel(product.unit)}
                                  </p>
                                </div>
                                {isSelected && (
                                  <span className="rounded-full bg-[#B8641A] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                                    Selected
                                  </span>
                                )}
                              </div>

                              <p className="mt-5 text-[28px] font-bold leading-none text-[#B8641A]">
                                Rs.{Number(product.ratePerUnit || 0).toFixed(2)}
                              </p>
                              <p className="mt-1 text-xs text-[#8B7355]">
                                Per {getProductUnitLabel(product.unit, { lowercase: true })}
                              </p>
                              <p
                                className={`mt-4 text-xs font-semibold ${
                                  isDisabled ? "text-[#C0392B]" : "text-[#4A7C2F]"
                                }`}
                              >
                                {formatProductStockLabel(product.stockQuantity, product.unit)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="min-h-0 border-t border-[#F2EDE4] bg-[#FBF7F0] lg:border-l lg:border-t-0">
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-7">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                    Order Summary
                      </p>

                  {addExtraError && (
                    <div className="mt-4 rounded-[16px] border border-[#F2D0C8] bg-[#FDECEA] px-4 py-3 text-sm text-[#C0392B]">
                      {addExtraError}
                    </div>
                  )}

                  <div className="mt-4 rounded-[20px] border border-[#EDE8DF] bg-white p-4">
                    {selectedAddExtraProduct ? (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#C4A882]">
                              Selected Product
                            </p>
                            <p className="mt-2 text-lg font-bold text-[#2C1A0E]">
                              {selectedAddExtraProduct.name}
                            </p>
                          </div>
                          <span className="rounded-full bg-[#FFF4E2] px-3 py-1 text-xs font-bold text-[#B8641A]">
                            Rs.{Number(selectedAddExtraProduct.ratePerUnit || 0).toFixed(2)}
                          </span>
                        </div>

                        <div className="mt-4 space-y-2 text-sm text-[#8B7355]">
                          <p>
                            Quantity unit:{" "}
                            {getProductUnitLabel(selectedAddExtraProduct.unit, {
                              lowercase: true,
                            })}
                          </p>
                          <p>Delivery date: {nextExtraDeliveryLabel}</p>
                          <p>Delivery slot: {addExtraForm.slot}</p>
                          <p>
                            Stock:{" "}
                            {formatProductStockLabel(
                              selectedAddExtraProduct.stockQuantity,
                              selectedAddExtraProduct.unit
                            )}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-[#8B7355]">
                        Select a product card to prepare your extra order.
                      </div>
                    )}
                  </div>

                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">
                        Quantity ({selectedAddExtraUnitShort})
                      </label>
                      <input
                        type="number"
                        min={selectedAddExtraQuantityStep}
                        step={selectedAddExtraQuantityStep}
                        value={addExtraForm.quantity}
                        onChange={(event) =>
                          setAddExtraForm((prev) => ({
                            ...prev,
                            quantity: event.target.value,
                          }))
                        }
                        className="w-full rounded-[16px] border border-[#EDE8DF] bg-white px-4 py-3 text-sm font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A]"
                      />
                      {selectedAddExtraProduct && (
                        <p
                          className={`mt-2 text-xs font-semibold ${
                            isAddExtraOutOfStock || doesAddExtraExceedStock
                              ? "text-[#C0392B]"
                              : "text-[#4A7C2F]"
                          }`}
                        >
                          {isAddExtraOutOfStock
                            ? `${selectedAddExtraProduct.name} is out of stock`
                            : doesAddExtraExceedStock
                            ? `Requested quantity is more than available ${selectedAddExtraUnitLower} stock`
                            : `Available stock: ${formatProductStockLabel(
                                selectedAddExtraProduct.stockQuantity,
                                selectedAddExtraProduct.unit
                              )}`}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">
                        Payment Method
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "PAY_NOW", label: "Online" },
                          { id: "COD", label: "Cash" },
                        ].map((method) => (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() =>
                              setAddExtraForm((prev) => ({
                                ...prev,
                                paymentMethod: method.id,
                              }))
                            }
                            className={`rounded-[14px] border px-3 py-2.5 text-sm font-bold transition ${
                              addExtraForm.paymentMethod === method.id
                                ? "border-[#B8641A] bg-[#FFF4E2] text-[#B8641A]"
                                : "border-[#EDE8DF] bg-white text-[#8B7355] hover:border-[#D4B896] hover:text-[#5C3D1E]"
                            }`}
                          >
                            {method.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">
                        Delivery Address
                      </label>
                      <div className="relative">
                        <MapPin
                          size={14}
                          className="pointer-events-none absolute left-4 top-4 text-[#C4A882]"
                        />
                        <textarea
                          rows={4}
                          value={addExtraForm.address}
                          onChange={(event) =>
                            setAddExtraForm((prev) => ({
                              ...prev,
                              address: event.target.value,
                            }))
                          }
                          placeholder="Enter delivery address"
                          className="w-full rounded-[16px] border border-[#EDE8DF] bg-white py-3 pl-10 pr-4 text-sm text-[#2C1A0E] outline-none transition focus:border-[#B8641A]"
                        />
                      </div>
                    </div>

                  </div>

                  <div className="space-y-3 border-t border-[#E7DAC6] bg-[#FBF7F0] p-6 sm:p-7">
                    <div className="rounded-[18px] bg-[#2C2416] p-4 text-white">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-white/70">Grand Total</span>
                        <span className="text-[28px] font-bold leading-none">
                          Rs.{Number.isFinite(addExtraTotal) ? addExtraTotal.toFixed(2) : "0.00"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-white/60">
                        Extra order for {nextExtraDeliveryLabel} • {addExtraForm.slot} slot
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSubmitExtraOrder(false)}
                      disabled={
                        addExtraLoading ||
                        addExtraSubmitting ||
                        !selectedAddExtraProduct ||
                        isAddExtraOutOfStock ||
                        doesAddExtraExceedStock
                      }
                      className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#B8641A] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#9F5313] disabled:cursor-not-allowed disabled:bg-[#D8C8B2] disabled:text-white/70"
                    >
                      {addExtraSubmitting ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <PlusCircle size={15} />
                      )}
                      {addExtraSubmitting
                        ? "Placing extra order..."
                        : addExtraForm.paymentMethod === "PAY_NOW"
                        ? "Pay & Add Extra"
                        : "Add Extra Order"}
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

        {showAddExtraModal && showDuplicateExtraConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 px-4">
            <div className="w-full max-w-md rounded-[24px] border border-[#E7DAC6] bg-[#FFFDF7] p-6 shadow-[0_24px_60px_rgba(44,26,14,0.28)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                Duplicate Order
              </p>
              <h4 className="mt-2 text-xl font-semibold text-[#2C1A0E]" style={headingFont}>
                Same product already added for tomorrow
              </h4>
              <p className="mt-2 text-sm text-[#8B7355]">
                Do you want to place another extra order for the same product and date?
              </p>

              <div className="mt-5 flex gap-3">
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
                  {addExtraSubmitting ? "Ordering..." : "Order Again"}
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
