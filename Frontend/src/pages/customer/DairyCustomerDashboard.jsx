import React, { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import { useCustomerDashboard } from "../../hooks/useCustomerDashboard";
import {
  createCustomerOneTimeOrder,
  fetchCustomerDashboard,
  reportCustomerDeliveryIssue,
  saveCustomerSubscription,
} from "../../api/customer/customer.api.js";
import { fetchPublicDairyById } from "../../api/public.api.js";
import {
  PlusCircle,
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
  Banknote,
  Receipt,
} from "lucide-react";
import { ACTIONS, headingFont } from "../../constants/customer.js";
import {
  formatCurrency,
  getBillingDueText,
  getTomorrowDateInput,
  normalizeProducts,
  getProductUnitLabel,
  getProductQuantityStep,
  getDefaultProductQuantity,
  isProductOutOfStock,
  getStoredCustomerAddress,
  buildUpiPaymentLink,
  normalizeAddExtraPaymentOption,
  getAddExtraOrderPaymentMethod,
  normalizeAddExtraSlot,
  formatTomorrowExtraStatus,
  getTomorrowExtraStatusClasses,
  getTodayDeliveryMeta,
  getPreferredExtraProductName,
  getPreferredExtraQuantity,
  getDailyDeliverySummary,
  toSubscriptionPayload,
} from "../../utils/customerDashboard.js";
import { ReportIssueModal } from "../../components/customer/ReportIssueModal.jsx";
import { PauseSubscriptionModal } from "../../components/customer/PauseSubscriptionModal.jsx";

const getProductImage = (type) => {
  const t = String(type || "").toUpperCase();
  switch (t) {
    case "MILK":
      return <img src="/images/products/milk.png" alt="Milk" width="48" height="48" loading="lazy" className="h-full w-full object-contain" />;
    case "CURD":
      return <img src="/images/products/curd.png" alt="Curd" width="48" height="48" loading="lazy" className="h-full w-full object-contain" />;
    case "PANEER":
      return <img src="/images/products/paneer.png" alt="Paneer" width="48" height="48" loading="lazy" className="h-full w-full object-contain" />;
    case "GHEE":
      return <img src="/images/products/ghee.png" alt="Ghee" width="48" height="48" loading="lazy" className="h-full w-full object-contain" />;
    default:
      return <img src="/images/products/other.png" alt="Other" width="48" height="48" loading="lazy" className="h-full w-full object-contain" />;
  }
};

export default function DairyCustomerDashboard() {
  const navigate = useNavigate();
  const { data, loading, error } = useCustomerDashboard();

  const [dashboardData, setDashboardData] = useState(null);
  const [savingPause, setSavingPause] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pausingSub, setPausingSub] = useState(false);
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
  const [addExtraUpiIntent, setAddExtraUpiIntent] = useState(null);
  const [addExtraUpiForm, setAddExtraUpiForm] = useState({
    utrNumber: "",
    payerUpiId: "",
    screenshotFile: null,
  });
  const [addExtraUpiSubmitting, setAddExtraUpiSubmitting] = useState(false);
  const [addExtraForm, setAddExtraForm] = useState({
    selectedProducts: [],
    quantities: {},
    paymentMethod: "PAY_NOW_ONLINE",
    address: "",
    slot: "Morning",
  });
  const [addExtraStep, setAddExtraStep] = useState(1);
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
    { id: "PAY_NOW_ONLINE", label: "Pay Online" },
    { id: "PAY_NOW_CASH", label: "Cash / COD" },
    ...(canAddExtraToSubscriptionBill
      ? [{ id: "ADD_TO_SUBSCRIPTION", label: "Add to Bill" }]
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
  const formattedTomorrowQty = tomorrow?.quantity
    ? String(tomorrow.quantity).toLowerCase().includes("l")
      ? tomorrow.quantity
      : `${tomorrow.quantity} L`
    : "-";
  const tomorrowTitle = hasSubscription
    ? `${formattedTomorrowQty} · ${subscription?.milkType || "Milk"}`
    : "Extra orders for tomorrow";
  const tomorrowSubtitle = hasSubscription
    ? `${tomorrow?.slot || "-"} slot`
    : `${tomorrowExtraOrders.length} extra ${tomorrowExtraOrders.length === 1 ? "item" : "items"} added`;
  const formattedSubQty = subscription?.quantity
    ? String(subscription.quantity).toLowerCase().includes("l")
      ? subscription.quantity
      : `${subscription.quantity} L`
    : "-";

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
  const formattedAddExtraTotal = formatCurrency(addExtraTotal);
  const addExtraSubmitLabel = addExtraSubmitting
    ? "Placing extra orders..."
    : selectedAddExtraOrderLines.length === 0
      ? "Select items to continue"
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

  const resetAddExtraFlowState = () => {
    setAddExtraError("");
    setShowDuplicateExtraConfirm(false);
    setAddExtraSubmitting(false);
    setAddExtraUpiSubmitting(false);
    setAddExtraUpiIntent(null);
    setAddExtraUpiForm({ utrNumber: "", payerUpiId: "", screenshotFile: null });
    setAddExtraForm({
      selectedProducts: [],
      quantities: {},
      paymentMethod: "PAY_NOW_ONLINE",
      address: "",
      slot: "Morning",
    });
    setAddExtraStep(1);
    setAddExtraDairy(null);
    setAddExtraProducts([]);
  };

  const closeAddExtraModal = () => {
    if (addExtraSubmitting) return;
    setShowAddExtraModal(false);
    resetAddExtraFlowState();
  };

  const cancelExtraUpiPayment = () => {
    if (addExtraUpiSubmitting) return;
    setShowAddExtraModal(false);
    resetAddExtraFlowState();
    showToast("Payment details were discarded.", "warning");
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
    const _preferredProductName = getPreferredExtraProductName({ subscription, tomorrow, today });
    const _preferredQuantity = getPreferredExtraQuantity({ subscription, tomorrow, today });

    setAddExtraStep(1);
    setAddExtraError("");
    setShowDuplicateExtraConfirm(false);
    setShowAddExtraModal(true);
    setAddExtraForm({
      selectedProducts: [],
      quantities: {},
      paymentMethod: preferredPaymentMethod,
      address: preferredAddress,
      slot: preferredSlot,
    });

    if (String(addExtraDairy?.id || "") === String(linkedExtraDairyId) && addExtraProducts.length) {
      setAddExtraForm((prev) => ({
        ...prev,
        selectedProducts: [],
        quantities: {},
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
        upiId: dairy?.upi_id || dairy?.upiId || null,
      };

      setAddExtraDairy(resolvedDairy);
      setAddExtraProducts(products);

      setAddExtraForm((prev) => ({
        ...prev,
        selectedProducts: [],
        quantities: {},
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

      if (addExtraForm.paymentMethod === "PAY_NOW_ONLINE") {
        setAddExtraUpiIntent({
          dairyId: linkedExtraDairyId,
          items: selectedAddExtraOrderLines.map((line) => ({
            milkType: line.product.name,
            quantity: line.quantity,
          })),
          deliveryDate: nextExtraDeliveryDate,
          slot: addExtraForm.slot,
          paymentMethod: getAddExtraOrderPaymentMethod(addExtraForm.paymentMethod),
          address: addExtraForm.address.trim(),
          isExtraOrder: true,
          allowDuplicate,
          amount: addExtraTotal,
          dairyName: addExtraDairy?.name || linkedExtraDairyName || "Dairy",
          upiId: addExtraDairy?.upiId || null,
          beneficiary: {
            dairyName: addExtraDairy?.name || linkedExtraDairyName || "Dairy",
            upiId: addExtraDairy?.upiId || null,
          },
          upiLink: buildUpiPaymentLink({
            upiId: addExtraDairy?.upiId || null,
            amount: addExtraTotal,
            name: addExtraDairy?.name || linkedExtraDairyName || "Dairy",
            note: `DairyStream one-time order ${nextExtraDeliveryLabel}`,
          }),
        });
        setAddExtraUpiForm({ utrNumber: "", payerUpiId: "", screenshotFile: null });
        setShowAddExtraModal(true);
        return;
      }

      for (const line of selectedAddExtraOrderLines) {
        await createCustomerOneTimeOrder({
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
      refreshDashboard().catch(() => { });
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

  const submitExtraUpiVerification = async () => {
    if (!addExtraUpiIntent) return;

    const utrNumber = String(addExtraUpiForm.utrNumber || "").trim();
    if (!utrNumber) {
      setAddExtraError("Enter the UTR/reference number after payment.");
      return;
    }

    setAddExtraUpiSubmitting(true);
    setAddExtraError("");

    try {
      await createCustomerOneTimeOrder({
        ...addExtraUpiIntent,
        utrNumber,
        payerUpiId: addExtraUpiForm.payerUpiId,
        screenshotFile: addExtraUpiForm.screenshotFile,
      });
      resetAddExtraFlowState();
      setShowAddExtraModal(false);
      showToast("UPI payment submitted for dairy verification.", "success");
      refreshDashboard().catch(() => { });
    } catch (err) {
      setAddExtraError(
        err?.response?.data?.message || err?.message || "Unable to submit UPI verification."
      );
    } finally {
      setAddExtraUpiSubmitting(false);
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

    if (isPaused) {
      setSavingPause(true);
      setPendingSubscriptionStatus("ACTIVE");
      try {
        const result = await saveCustomerSubscription({
          action: "RESUME",
          dairyId: subscription.dairyId,
        });
        const resolvedStatus = String(result?.subscription?.status || "ACTIVE").toUpperCase();
        setPendingSubscriptionStatus(resolvedStatus);
        syncLocalSubscriptionStatus(resolvedStatus);
        showToast("Subscription resumed! Daily deliveries will resume.", "success");
        refreshDashboard().catch(() => {});
      } catch (err) {
        setPendingSubscriptionStatus("PAUSED");
        syncLocalSubscriptionStatus("PAUSED");
        showToast(err?.message || "Failed to resume subscription.", "error");
      } finally {
        setSavingPause(false);
      }
    } else {
      setShowPauseModal(true);
    }
  };

  const handleConfirmPause = async ({ durationType, startDate, endDate }) => {
    if (!subscription?.dairyId || pausingSub) return;
    setPausingSub(true);

    try {
      const result = await saveCustomerSubscription({
        action: "PAUSE",
        dairyId: subscription.dairyId,
        durationType,
        startDate,
        endDate,
      });

      const resolvedStatus = String(result?.subscription?.status || "PAUSED").toUpperCase();
      setPendingSubscriptionStatus(resolvedStatus);
      syncLocalSubscriptionStatus(resolvedStatus);
      setShowPauseModal(false);
      showToast("Subscription paused successfully.", "warning");
      refreshDashboard().catch(() => {});
    } catch (err) {
      showToast(err?.message || "Failed to pause subscription.", "error");
    } finally {
      setPausingSub(false);
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
        <div className="space-y-5 lg:space-y-8 xl:space-y-5 animate-pulse" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {/* Header Banner Skeleton */}
          <div className="rounded-[24px] border border-[#EDE8DF] bg-[linear-gradient(180deg,#F8F2E9_0%,#FFFDF8_100%)] p-4 sm:p-6 xl:rounded-[34px] xl:p-[30px]">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_400px] xl:items-start xl:gap-8">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-4 w-28 rounded-full bg-[#E7DAC6]" />
                <div className="h-9 w-64 rounded-xl bg-[#E7DAC6]" />
                <div className="h-5 w-44 rounded-lg bg-[#E7DAC6]/60" />
              </div>
              <div className="w-full rounded-[18px] border border-[#E7DDCF] bg-white/90 p-4 h-[72px] sm:h-[84px] xl:h-[96px] xl:rounded-[22px]" />
            </div>
          </div>

          {/* Today's Delivery Card Skeleton */}
          <div className="rounded-[24px] bg-[#EDE8DF]/40 p-4 sm:rounded-[28px] sm:p-7 xl:min-h-[200px] xl:px-[30px] xl:py-[31px]">
            <div className="h-4 w-32 rounded-full bg-[#E7DAC6] mb-4" />
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-[14px] sm:h-14 sm:w-14 sm:rounded-[18px] bg-[#E7DAC6]" />
              <div className="flex-1 space-y-2.5">
                <div className="h-7 w-48 rounded-xl bg-[#E7DAC6]" />
                <div className="h-4 w-36 rounded-lg bg-[#E7DAC6]" />
              </div>
            </div>
          </div>

          {/* Grid Layout Cards Skeleton */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="h-[120px] rounded-[24px] bg-white border border-[#EDE8DF] p-5 space-y-3">
              <div className="h-8 w-8 rounded-lg bg-[#E7DAC6]" />
              <div className="h-4 w-24 rounded bg-[#E7DAC6]" />
            </div>
            <div className="h-[120px] rounded-[24px] bg-white border border-[#EDE8DF] p-5 space-y-3">
              <div className="h-8 w-8 rounded-lg bg-[#E7DAC6]" />
              <div className="h-4 w-24 rounded bg-[#E7DAC6]" />
            </div>
          </div>
        </div>
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
      <div className="space-y-5 lg:space-y-8 xl:space-y-5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {toast && (
          <div
            className={`fixed inset-x-3 top-4 z-50 flex items-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-semibold shadow-[0_16px_40px_rgba(84,52,16,0.14)] transition-all sm:left-auto sm:right-5 sm:top-5 sm:max-w-md ${toast.type === "success"
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

        <div className="rounded-[22px] border border-[#F0EBE1] bg-[linear-gradient(180deg,#FAF5EF_0%,#FDFBF7_100%)] p-4 shadow-xs sm:p-5 xl:rounded-[26px] xl:px-6 xl:py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_380px] xl:items-center xl:gap-8">
            <div className="min-w-0 max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B0997D]">
                Customer Overview
              </p>
              <h1
                className="mt-1.5 text-[24px] font-semibold leading-tight text-[#2C1A0E] sm:text-[32px] xl:mt-2 xl:text-[36px]"
                style={headingFont}
              >
                {greeting}, <span className="text-[#B8641A]">{customerName}</span>
              </h1>
              <p className="mt-1 text-xs text-[#7C6A5A] sm:text-sm">
                Member of{" "}
                <span className="font-semibold text-[#524134]">{dairyName}</span>
              </p>
            </div>

            <div className="w-full rounded-xl border border-[#F0EBE1] bg-white/90 px-4 py-3 shadow-xs xl:justify-self-end xl:px-5 xl:py-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B0997D]">
                Plan Status
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                    !subscription
                      ? "bg-[#F5F0E8] text-[#7C6A5A]"
                      : isPaused
                        ? "border border-[#F0D1B2] bg-[#FFF1E4] text-[#C86D27]"
                        : "border border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]"
                  }`}
                >
                  {subscription ? (isPaused ? "Paused" : "Active") : "Inactive"}
                </span>
                <span className="text-xs font-medium text-[#524134]">
                  {subscription
                    ? `${formattedSubQty} · ${String(subscription.milkType || "Milk").replace(/^(\d+)([a-zA-Z])/, "$1 $2")}`
                    : "No active subscription"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {today && (
          <div className="relative overflow-hidden rounded-[22px] border border-[#5C3D1E]/10 bg-[linear-gradient(135deg,#2C2416_0%,#4A3820_60%,#6B4F2A_100%)] p-4 sm:p-6 xl:rounded-[26px] xl:px-7 xl:py-6">
            <div
              className={`pointer-events-none absolute inset-0 rounded-[22px] ${
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
            <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/5" />

            <p className="relative mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
              TODAY&apos;S DELIVERY
            </p>

            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between xl:gap-8">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3.5 sm:gap-4">
                  <div
                    className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14 xl:h-14 xl:w-14 ${
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
                    <h3 className="mb-1.5 text-[20px] font-semibold leading-tight text-white sm:text-[24px] xl:text-[26px]" style={headingFont}>
                      {todayMeta.title}
                    </h3>
                    <p className="mb-1.5 text-sm font-semibold text-white/95 sm:text-base">
                      {today.quantity || "-"} · {today.product || "Milk"}
                    </p>
                    <p className="text-xs leading-relaxed text-white/80 sm:text-sm">
                      {todayMeta.helperText}
                    </p>
                  </div>
                </div>

                {today?.agent?.name && (
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-white/70 sm:mt-5">
                    <span className="flex items-center gap-1.5">
                      <User size={13} />
                      Agent: <strong className="font-semibold text-white/90">{today.agent.name}</strong> {today.agent.phone ? `(${today.agent.phone})` : ""}
                    </span>
                    {today.time && todayMeta.tone === "success" && (
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} />
                        Dropped at Doorstep - {today.time}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex w-full flex-col gap-2 self-start lg:w-auto lg:min-w-[240px]">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const orderId = String(today?.deliveryId || today?.id || "").trim();
                      if (!orderId) return;
                      navigate(`/customer/track/${orderId}`, { state: { delivery: today } });
                    }}
                    disabled={
                      !today?.canTrackAgent ||
                      ["NOT_SUBSCRIBED", "NOT_SCHEDULED", "PENDING_APPROVAL", "PENDING_VERIFICATION", "FAILED", "CANCELLED"].includes(
                        String(today?.status || "").toUpperCase()
                      )
                    }
                    className="w-full rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-[#2C1A0E] shadow-sm transition hover:bg-[#FAF5EF] disabled:cursor-not-allowed disabled:opacity-40"
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
                    className="w-full rounded-xl border border-white/30 bg-transparent px-3 py-2.5 text-xs font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
                  >
                    {reportingIssue ? "Reporting..." : "Report Issue"}
                  </button>
                </div>

                {hasIssue && (
                  <div className="grid gap-1.5">
                    <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-rose-500">
                        Reported Issue
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-rose-800">
                        {today.customerIssue}
                      </p>
                    </div>

                    {(hasAdminAction || issueStatus === "OPEN") && (
                      <div
                        className={`rounded-lg border px-3 py-1.5 ${
                          hasAdminAction
                            ? "border-emerald-100 bg-emerald-50"
                            : "border-amber-100 bg-amber-50"
                        }`}
                      >
                        <p
                          className={`text-[9px] font-bold uppercase tracking-wider ${
                            hasAdminAction ? "text-emerald-500" : "text-amber-500"
                          }`}
                        >
                          {hasAdminAction ? "Action Taken" : "Issue Status"}
                        </p>
                        <p
                          className={`mt-0.5 text-xs font-medium ${
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

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
          {ACTIONS.map((action) => {
            const { key, label, bg, text, border } = action;
            const ActionIcon = action.Icon;
            const isPay = key === "pay";

            return (
              <button
                key={key}
                onClick={() => handleAction(key)}
                disabled={key === "pause" && !canTogglePause}
                className={`group relative flex flex-col justify-between rounded-xl border bg-[#FDFBF7] p-4 text-left min-h-[114px] transition-all hover:-translate-y-0.5 hover:shadow-xs disabled:cursor-not-allowed disabled:opacity-50 sm:p-5 ${
                  isPay
                    ? "border-[#F0D1B2] bg-[#FAF5EF]/60 hover:bg-[#FAF5EF]"
                    : border
                }`}
              >
                <div className="w-full">
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${bg} ${text}`}>
                    {key === "pause" && isPaused ? <PlayCircle size={18} /> : <ActionIcon size={18} />}
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-sm font-semibold leading-tight text-[#2C1A0E] ${isPay ? "text-[#B8641A]" : ""}`}>
                      {key === "pause" ? pauseToggleLabel : label}
                    </span>
                    <ChevronRight size={14} className="flex-shrink-0 text-[#B0997D] transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
                <p className="mt-1 text-xs leading-normal text-[#7C6A5A]">
                  {key === "pause"
                    ? pauseToggleHelper
                    : key === "add"
                      ? "Choose extra products"
                      : key === "deliveries"
                        ? "Review delivery history"
                        : "Settle outstanding balance"}
                </p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-6">
          <div className="flex flex-col rounded-2xl border border-[#F0EBE1] bg-[#FDFBF7] p-5">
            {showTomorrowCard ? (
              <div>
                <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#B0997D]">
                  TOMORROW
                </p>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#FFF4E2] text-[#B8641A]">
                      {hasSubscription ? <Truck size={18} /> : <PlusCircle size={18} />}
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-[#2C1A0E] sm:text-[17px]">{tomorrowTitle}</h4>
                      <p className="mt-0.5 text-xs text-[#7C6A5A]">{tomorrowSubtitle}</p>

                      {hasTomorrowExtras && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {tomorrowExtraOrders.map((order) => (
                            <div
                              key={order.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#F0EBE1] bg-[#FAF5EF] px-2.5 py-1"
                            >
                              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#FFF4E2] text-[10px] font-bold text-[#B8641A]">
                                +
                              </span>
                              <span className="text-xs font-semibold text-[#2C1A0E]">
                                {order.quantity || "-"} {order.product || "Milk"}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getTomorrowExtraStatusClasses(
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
                      className="rounded-lg border border-[#EDE8DF] bg-white px-3 py-1.5 text-xs font-medium text-[#524134] transition hover:bg-[#FAF5EF] hover:text-[#2C1A0E]"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#B0997D]">
                  TOMORROW
                </p>
                <div className="rounded-xl border border-dashed border-[#E7DAC6] bg-[#FAF5EF] p-4 text-center">
                  <p className="text-sm font-semibold text-[#2C1A0E]">No active subscription</p>
                  <p className="mt-1 text-xs text-[#7C6A5A]">
                    Subscribe to schedule your next delivery automatically.
                  </p>
                  <button
                    onClick={() => navigate("/customer/dashboard/subscriptions")}
                    className="mt-3 inline-flex items-center rounded-lg bg-[#B8641A] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#9F5313]"
                  >
                    Start Subscription
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-[#F0EBE1] pt-3.5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#B0997D]">
                SUBSCRIPTION
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#2C1A0E]">
                  {subscription
                    ? `${subscription.milkType || "Milk"} · ${formattedSubQty} Daily`
                    : "No active subscription"}
                </p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    !subscription
                      ? "bg-[#F5F0E8] text-[#7C6A5A]"
                      : isPaused
                        ? "bg-[#FFF1E4] text-[#C86D27]"
                        : "bg-[#EEF5E7] text-[#4A7C2F]"
                  }`}
                >
                  {subscription ? (isPaused ? "Paused" : "Active") : "Inactive"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#7C6A5A]">
                Start date: {subscription?.startDate || "Not available"}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={handlePauseResume}
                  disabled={!canTogglePause}
                  className={`flex h-9 items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isPaused
                      ? "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F] hover:bg-[#E3EED8]"
                      : "border-[#F2D0C8] bg-[#FDECEA] text-[#C0392B] hover:bg-[#F8DDD6]"
                  }`}
                >
                  {pauseToggleLabel}
                </button>
                <button
                  onClick={() => navigate("/customer/dashboard/subscriptions")}
                  className="flex h-9 items-center justify-center rounded-lg border border-[#F0D1B2] bg-[#FFF1E4] px-3 py-2 text-xs font-semibold text-[#B8641A] transition hover:bg-[#FFE8D6]"
                >
                  Modify Plan
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-[#F0EBE1] bg-[#FDFBF7] p-5">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#B0997D]">
                BILLING SUMMARY
              </p>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[32px] font-semibold tracking-tight text-[#2C1A0E] sm:text-[36px]" style={headingFont}>
                  {formatCurrency(billing.monthlyDue)}
                </span>
                {billing.dueInDays != null && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      billing.dueInDays < 0
                        ? "border border-[#F2D0C8] bg-[#FDECEA] text-[#C0392B]"
                        : "border border-[#F0D1B2] bg-[#FFF1E4] text-[#B8641A]"
                    }`}
                  >
                    {getBillingDueText(billing.dueInDays)}
                  </span>
                )}
              </div>

              <div className="my-4 space-y-2 border-y border-[#F0EBE1] py-3">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-[#7C6A5A]">Wallet Balance</span>
                  <span className="font-semibold text-[#2C1A0E]">
                    {formatCurrency(billing.walletBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-[#7C6A5A]">Payment Mode</span>
                  <span className="font-medium text-[#524134]">
                    {subscription?.paymentMethod || "UPI"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-[#7C6A5A]">Status</span>
                  <span
                    className={`font-semibold ${
                      billing.monthlyDue > 0 ? "text-[#C86D27]" : "text-[#4A7C2F]"
                    }`}
                  >
                    {billing.monthlyDue > 0 ? "Overdue / Pending" : "Clear"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => navigate("/customer/dashboard/payments")}
                className="w-full rounded-xl bg-[#2C2416] py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#4A3820] hover:opacity-95 active:scale-[0.98]"
              >
                Pay Now
              </button>
              <button
                onClick={() => navigate("/customer/dashboard/payments")}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#EDE8DF] bg-white py-2 text-xs font-semibold text-[#7C6A5A] transition-all duration-150 hover:border-[#D4B896] hover:bg-[#FAF5EF] hover:text-[#2C1A0E] active:scale-[0.98]"
              >
                View Full Invoice <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-[18px] border border-[#F2D0C8] bg-[#FDECEA] px-4 py-3 text-sm text-[#C0392B]">
            {error}
          </div>
        )}

        {showAddExtraModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2C2416]/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6 animate-in fade-in duration-150">
            <div className="flex h-[100svh] max-h-[100svh] w-full max-w-5xl flex-col overflow-hidden rounded-none border border-[#E7DAC6] bg-[#FFFDF7] shadow-[0_28px_80px_rgba(44,26,14,0.28)] sm:max-h-[92vh] sm:rounded-[28px] animate-in zoom-in-95 duration-200 ease-out">
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
                  <div className="mt-3.5 flex items-center gap-2 xl:hidden">
                    <span className={`inline-flex items-center justify-center rounded-full text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 ${addExtraStep === 1 ? "bg-[#FFF4E2] text-[#B8641A]" : "bg-[#F5F0E8] text-[#8B7355]"}`}>
                      1. Products {addExtraStep > 1 && "✓"}
                    </span>
                    <span className="text-[#EDE8DF]">/</span>
                    <span className={`inline-flex items-center justify-center rounded-full text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 ${addExtraStep === 2 ? "bg-[#FFF4E2] text-[#B8641A]" : "bg-[#F5F0E8] text-[#8B7355]"}`}>
                      2. Details & Order
                    </span>
                  </div>
                </div>

                <button
                  onClick={closeAddExtraModal}
                  disabled={addExtraSubmitting}
                  className="rounded-full border border-[#EDE8DF] bg-white p-2 text-[#8B7355] transition hover:border-[#D4B896] hover:text-[#5C3D1E] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 flex flex-col xl:grid xl:grid-cols-[minmax(0,1.35fr)_360px]">
                <div className={`min-h-0 flex flex-col ${addExtraStep === 1 ? "flex-1" : "hidden xl:flex xl:flex-1"}`}>
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
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

                        <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 xl:grid-cols-3">
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
                                className={`rounded-[20px] border p-3 text-left transition-all duration-300 flex flex-col sm:flex-row gap-2.5 group items-start sm:items-center relative ${isDisabled
                                    ? "cursor-not-allowed border-[#F2EDE4] bg-[#FBF7F0] opacity-60"
                                    : isSelected
                                      ? "border-[#B8641A] bg-[#FFF4E2] shadow-[0_12px_24px_rgba(184,100,26,0.08)] ring-2 ring-[#B8641A]/10"
                                      : "border-[#EDE8DF] bg-white hover:-translate-y-0.5 hover:border-[#D4B896] hover:shadow-[0_12px_24px_rgba(100,72,35,0.08)]"
                                  }`}
                              >
                                {/* Product Image with solid warm neutral background */}
                                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl p-1.5 shadow-xs border border-[#EDE8DF] bg-[#FAF7F2] overflow-hidden">
                                  {getProductImage(product.type)}
                                </div>

                                <div className="flex-1 min-w-0 w-full">
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="min-w-0 w-full">
                                      <p className="text-xs sm:text-sm font-bold leading-tight text-[#2C1A0E] truncate group-hover:text-[#B8641A] transition-colors">{product.name}</p>
                                      <p className="mt-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C4A882]">
                                        {getProductUnitLabel(product.unit)}
                                      </p>
                                    </div>
                                  </div>

                                  <p className="mt-1.5 text-base sm:text-lg font-black leading-none text-[#B8641A]">
                                    ₹{Number(product.ratePerUnit || 0).toFixed(2)}
                                  </p>
                                </div>

                                {isSelected && (
                                  <span className="absolute top-2 right-2 rounded-full bg-[#B8641A] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-white">
                                    Selected
                                  </span>
                                )}
                                {!isSelected && !isDisabled && (
                                  <span className="absolute top-2 right-2 rounded-full border border-[#EDE8DF] bg-white px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-[#8B7355] opacity-0 group-hover:opacity-100 transition-opacity">
                                    Add
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                  {/* Sticky Mobile Step 1 Continue button */}
                  <div className="shrink-0 border-t border-[#F2EDE4] bg-white p-4 shadow-[0_-8px_30px_rgba(44,26,14,0.06)] xl:hidden">
                    <button
                      type="button"
                      onClick={() => setAddExtraStep(2)}
                      disabled={selectedAddExtraOrderLines.length === 0}
                      className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#B8641A] py-3.5 text-sm font-bold text-white shadow-lg hover:bg-[#9F5313] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Continue to Details ({selectedAddExtraOrderLines.length} selected)
                    </button>
                  </div>
                </div>

                <div className={`min-h-0 border-t border-[#F2EDE4] bg-[#FBF7F0] xl:border-l xl:border-t-0 ${addExtraStep === 2 ? "flex flex-col flex-1" : "hidden xl:flex xl:flex-col xl:h-full"}`}>
                  <div className="flex flex-col flex-1 min-h-0 xl:h-full">
                    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
                      {addExtraError && (
                        <div className="rounded-[16px] border border-[#F2D0C8] bg-[#FDECEA] px-4 py-3 text-sm text-[#C0392B]">
                          {addExtraError}
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="rounded-[16px] border border-[#E7DAC6] bg-[#FFF8EC] px-4 py-3 text-sm font-medium text-[#8B7355] flex items-center gap-2.5">
                          <Truck size={16} className="text-[#B8641A] shrink-0" />
                          <span>
                            Tomorrow delivery: <span className="font-bold text-[#5C3D1E]">Daily delivery ({dailyDeliverySummary})</span> +
                          </span>
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">
                            Selected Products
                          </label>
                          {selectedAddExtraOrderLines.length === 0 ? (
                            <div className="flex min-h-[110px] items-center justify-center rounded-[16px] border border-dashed border-[#E7DAC6] bg-white px-4 py-4 text-center text-sm font-semibold text-[#8B7355]">
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
                                    className="rounded-2xl border border-[#EDE8DF] bg-white p-3.5 flex gap-3 shadow-sm hover:border-[#D4B896] transition-all"
                                  >
                                    {/* Product image wrapper */}
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-1 shadow-xs border border-[#EDE8DF] bg-[#FAF7F2] overflow-hidden">
                                      {getProductImage(line.product.type)}
                                    </div>

                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="truncate text-xs font-extrabold text-[#2C1A0E]">
                                            {line.product.name}
                                          </p>
                                          <p className="text-[10px] text-[#8B7355]">
                                            ₹{Number(line.product.ratePerUnit || 0).toFixed(2)} per {unitLower}
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
                                          className="rounded-lg border border-red-100 bg-red-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-red-600 transition hover:bg-red-100/60"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                      <div className="mt-2.5 flex items-center justify-between gap-3 bg-slate-50/50 p-2 rounded-xl border border-[#EDE8DF]/60">
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const nextVal = Math.max(quantityStep, Number(line.quantityValue || 0) - quantityStep);
                                              setAddExtraForm((prev) => ({
                                                ...prev,
                                                quantities: {
                                                  ...(prev.quantities || {}),
                                                  [line.product.name]: nextVal,
                                                },
                                              }));
                                            }}
                                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#EDE8DF] bg-white text-[#8B7355] transition hover:border-[#D4B896] hover:text-[#5C3D1E] active:scale-95"
                                          >
                                            -
                                          </button>
                                          <span className="min-w-[32px] text-center text-xs font-bold text-[#2C1A0E]">
                                            {line.quantityValue} {unitShort}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const nextVal = Number(line.quantityValue || 0) + quantityStep;
                                              setAddExtraForm((prev) => ({
                                                ...prev,
                                                quantities: {
                                                  ...(prev.quantities || {}),
                                                  [line.product.name]: nextVal,
                                                },
                                              }));
                                            }}
                                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#EDE8DF] bg-white text-[#8B7355] transition hover:border-[#D4B896] hover:text-[#5C3D1E] active:scale-95"
                                          >
                                            +
                                          </button>
                                        </div>
                                        <p className="text-right text-xs font-black text-[#B8641A]">
                                          ₹{Number.isFinite(line.lineTotal) ? line.lineTotal.toFixed(2) : "0.00"}
                                        </p>
                                      </div>
                                      {(line.isOutOfStock || line.exceedsStock) && (
                                        <p className="mt-1.5 text-[10px] font-semibold text-[#C0392B]">
                                          {line.isOutOfStock
                                            ? `${line.product.name} is out of stock`
                                            : `Requested quantity is more than available ${unitLower} stock`}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 border-t border-[#E7DAC6] bg-[#FBF7F0] p-4 pb-8 sm:p-7 shrink-0 shadow-[0_-8px_30px_rgba(44,26,14,0.06)] xl:shadow-none">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">
                          Payment Option
                        </label>
                        <div className="grid grid-cols-3 gap-2">
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
                              className={`flex flex-col min-h-[74px] items-center justify-center gap-1.5 rounded-[12px] border px-1.5 py-2 text-center text-[10px] sm:text-xs font-bold leading-tight transition ${addExtraForm.paymentMethod === method.id
                                  ? "border-[#B8641A] bg-[#FFF4E2] text-[#B8641A]"
                                  : "border-[#EDE8DF] bg-white text-[#8B7355] hover:border-[#D4B896] hover:text-[#5C3D1E]"
                                }`}
                            >
                              {method.id === "PAY_NOW_ONLINE" && <CreditCard size={18} />}
                              {method.id === "PAY_NOW_CASH" && <Banknote size={18} />}
                              {method.id === "ADD_TO_SUBSCRIPTION" && <Receipt size={18} />}
                              <span>{method.label}</span>
                            </button>
                          ))}
                        </div>
                        {!canAddExtraToSubscriptionBill && (
                          <p className="mt-1.5 text-[10px] font-medium text-[#8B7355] leading-tight">
                            Add to Subscription Bill is available only for customers with an active subscription in this dairy.
                          </p>
                        )}
                        {addExtraForm.paymentMethod === "ADD_TO_SUBSCRIPTION" && (
                          <p className="mt-1.5 text-[10px] font-medium text-[#8B7355] leading-tight">
                            This extra order will be added to your subscription bill.
                          </p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => handleSubmitExtraOrder(false)}
                          disabled={!canSubmitAddExtraOrder}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#B8641A_0%,#8F4D12_100%)] px-4 py-3.5 text-sm font-bold text-white shadow-[0_16px_30px_rgba(143,77,18,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_34px_rgba(143,77,18,0.28)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0"
                        >
                          {addExtraSubmitting ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <PlusCircle size={15} />
                          )}
                          <span>{addExtraSubmitLabel}</span>
                        </button>

                        <div className="flex gap-2.5">
                          <button
                            type="button"
                            onClick={() => setAddExtraStep(1)}
                            disabled={addExtraSubmitting}
                            className="flex-1 rounded-[16px] border border-[#EDE8DF] bg-[#FFFDF7] px-4 py-2.5 text-sm font-bold text-[#8B7355] transition hover:border-[#D4B896] hover:text-[#5C3D1E] xl:hidden"
                          >
                            Back to Products
                          </button>
                          <button
                            type="button"
                            onClick={closeAddExtraModal}
                            disabled={addExtraSubmitting}
                            className={`rounded-[16px] border border-[#EDE8DF] bg-white px-4 py-2.5 text-sm font-semibold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E] disabled:cursor-not-allowed disabled:opacity-60 ${
                              addExtraStep === 2 ? "flex-1 xl:w-full xl:flex-initial" : "w-full"
                            }`}
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
          </div>
        )}

        {addExtraUpiIntent && (
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(20,10,4,0.58)] px-0 py-0 sm:items-center sm:px-4 sm:py-6"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                cancelExtraUpiPayment();
              }
            }}
          >
            <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[24px] bg-white shadow-[0_30px_90px_rgba(30,16,8,0.24)] sm:rounded-[24px]">
              <div className="flex items-start justify-between gap-4 border-b border-[#F2EAE0] px-5 py-5 sm:px-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B8641A]">
                    Direct UPI Payment
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold text-[#1E1008]" style={headingFont}>
                    Submit payment details for {formatCurrency(addExtraUpiIntent.amount)}
                  </h3>
                  <p className="mt-1 text-sm text-[#8B7355]">
                    Complete the transfer in your UPI app, then submit the UTR/reference number for dairy verification.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cancelExtraUpiPayment}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F2EB] text-[#8B7355] transition hover:bg-[#EDE4D8] disabled:opacity-50"
                  disabled={addExtraUpiSubmitting}
                  aria-label="Close UPI payment"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)]">
                <div className="rounded-2xl border border-[#EDE8DF] bg-[#FFFDF8] p-4 text-center">
                  {addExtraUpiIntent.upiLink ? (
                    <>
                      <div className="mx-auto inline-flex rounded-xl bg-white p-3 shadow-sm">
                        <QRCodeSVG value={addExtraUpiIntent.upiLink} size={196} includeMargin />
                      </div>
                      <p className="mt-3 break-words text-xs font-semibold text-[#7B6247]">
                        {addExtraUpiIntent.beneficiary?.upiId}
                      </p>
                      <p className="mt-1 text-[11px] text-[#B89970]">Scan with any UPI app</p>
                    </>
                  ) : (
                    <div className="flex min-h-[264px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#E7DAC6] bg-white px-4 py-6">
                      <p className="text-sm font-bold text-[#5C3D1E]">Payment details ready</p>
                      <p className="text-xs text-[#8B7355]">
                        Enter the UTR/reference number after completing the transfer.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {addExtraError && (
                    <div className="rounded-[14px] border border-[#F2D0C8] bg-[#FDECEA] px-4 py-3 text-sm text-[#C0392B]">
                      {addExtraError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["UPI App", addExtraUpiIntent.intents?.upi],
                      ["Google Pay", addExtraUpiIntent.intents?.googlePay],
                      ["PhonePe", addExtraUpiIntent.intents?.phonePe],
                      ["Paytm", addExtraUpiIntent.intents?.paytm],
                    ].map(([label, href]) => (
                      <a
                        key={label}
                        href={href || addExtraUpiIntent.upiLink}
                        className="rounded-xl border border-[#E5DCCF] bg-[#FAFAF7] px-3 py-3 text-center text-xs font-black text-[#5C3D1E] no-underline transition hover:border-[#B8641A] hover:bg-[#FFF3E2]"
                      >
                        {label}
                      </a>
                    ))}
                  </div>

                  <label className="block">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#A88763]">
                      UTR / Reference Number
                    </span>
                    <input
                      value={addExtraUpiForm.utrNumber}
                      onChange={(event) =>
                        setAddExtraUpiForm((prev) => ({
                          ...prev,
                          utrNumber: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="Enter UPI reference number"
                      className="mt-2 w-full rounded-xl border border-[#E7DAC6] bg-white px-4 py-3 text-sm font-semibold text-[#2C1A0E] outline-none focus:border-[#B8641A] focus:ring-4 focus:ring-[#F4E1CB]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#A88763]">
                      Your UPI ID Optional
                    </span>
                    <input
                      value={addExtraUpiForm.payerUpiId}
                      onChange={(event) =>
                        setAddExtraUpiForm((prev) => ({
                          ...prev,
                          payerUpiId: event.target.value,
                        }))
                      }
                      placeholder="name@bank"
                      className="mt-2 w-full rounded-xl border border-[#E7DAC6] bg-white px-4 py-3 text-sm font-semibold text-[#2C1A0E] outline-none focus:border-[#B8641A] focus:ring-4 focus:ring-[#F4E1CB]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#A88763]">
                      Payment Screenshot Optional
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) =>
                        setAddExtraUpiForm((prev) => ({
                          ...prev,
                          screenshotFile: event.target.files?.[0] || null,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-[#E7DAC6] bg-white px-4 py-3 text-sm font-semibold text-[#2C1A0E]"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={submitExtraUpiVerification}
                    disabled={addExtraUpiSubmitting || !String(addExtraUpiForm.utrNumber || "").trim()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C1A0E] px-5 py-3 text-sm font-black text-white transition hover:bg-[#B8641A] disabled:bg-[#D8C8B2]"
                  >
                    {addExtraUpiSubmitting ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CreditCard size={15} />
                    )}
                    Submit Order
                  </button>
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
                  ? `${selectedDuplicateExtraProductNames.join(", ")} already ${selectedDuplicateExtraProductNames.length === 1 ? "has" : "have"
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

        <PauseSubscriptionModal
          isOpen={showPauseModal}
          onClose={() => setShowPauseModal(false)}
          onConfirm={handleConfirmPause}
          submitting={pausingSub}
        />
      </div>
    </CustomerLayout>
  );
}
