import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle,
  CheckCircle2,
  Home,
  History,
  List,
  Loader2,
  Map as MapIcon,
  Package,
  Phone,
  User,
  X,
  XCircle,
} from "lucide-react";
import DeliveryDetailsModal from "../../components/agent/DeliveryDetailsModal";
const DeliveryProofModal = lazy(() => import("../../components/agent/DeliveryProofModal"));
import FailedReasonModal from "../../components/agent/FailedReasonModal";
import {
  fetchAssignedAgentDeliveries,
  flushAgentOfflineQueue,
  updateAssignedAgentDeliveryStatus,
} from "../../api/agent/agent.api";
import {
  getCachedAssignedAgentDeliveries,
  getPendingAgentSyncCount,
  subscribeToAgentOfflineState,
} from "../../api/agent/offlineSync";
import {
  buildBuildingTaskGroups,
  buildDynamicPropertyHierarchy,
  buildFloorGroups,
  calculateDetailedDeliverySummary,
  formatQuantity,
  getBuildingName,
  getCompactDeliverySummary,
  getQuantityValue,
  getProductLabel,
  isMilkProduct,
} from "../../utils/agentTaskGrouping";

const headingFont = { fontFamily: "'Lora', serif" };

const NavTab = ({ icon, label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex min-w-[64px] flex-col items-center gap-1 rounded-[18px] px-2 py-2 transition ${
      active ? "text-[#B8641A]" : "text-[#8B7355]"
    }`}
  >
    {icon}
    <span className="text-[8px] font-black uppercase tracking-[0.16em]">{label}</span>
    {active && <div className="h-1 w-1 rounded-full bg-[#B8641A]" />}
  </button>
);

const getStatusTone = (status) => {
  switch (String(status || "").toUpperCase()) {
    case "COMPLETED":
      return "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]";
    case "FAILED":
      return "border-[#F2D0C8] bg-[#FDECEA] text-[#C0392B]";
    default:
      return "border-[#F0D1B2] bg-[#FFF1E4] text-[#B8641A]";
  }
};

const getCustomerProductSummary = (delivery = {}) => {
  const primaryLabel = getProductLabel(delivery);
  const primaryQuantity = getQuantityValue(delivery?.quantity ?? delivery?.quantity_liters);
  const primaryIsMilk = isMilkProduct(delivery);
  const baseQuantity = primaryIsMilk
    ? `${formatQuantity(primaryQuantity)} L`
    : `x ${formatQuantity(primaryQuantity || 1)}`;

  const segments = [`Milk type: ${primaryLabel || "-"}`, `Quantity: ${baseQuantity}`];

  const extras = Array.isArray(delivery?.extraProducts)
    ? delivery.extraProducts
    : Array.isArray(delivery?.extras)
    ? delivery.extras
    : Array.isArray(delivery?.addOns)
    ? delivery.addOns
    : Array.isArray(delivery?.orderItems)
    ? delivery.orderItems
    : [];

  extras.forEach((extra) => {
    const label = String(
      extra?.name || extra?.product || extra?.productName || extra?.itemName || extra?.label || ""
    ).trim();
    if (!label || label.toLowerCase() === String(primaryLabel || "").toLowerCase()) return;

    const qty = getQuantityValue(extra?.quantity ?? extra?.qty ?? extra?.units ?? 1);
    segments.push(`${label} x ${formatQuantity(qty || 1)}`);
  });

  const extrasText = segments.slice(2).join(", ");
  return extrasText ? `${segments[0]} | ${segments[1]} | Extras: ${extrasText}` : `${segments[0]} | ${segments[1]}`;
};

const getDeliveryStatusPriority = (status) => {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PENDING" || normalized === "OUT_FOR_DELIVERY" || normalized === "IN_TRANSIT") return 0;
  if (normalized === "FAILED") return 1;
  if (normalized === "COMPLETED") return 2;
  return 3;
};

const mergeCustomerDeliveries = (deliveries = []) => {
  const lines = deliveries.map((delivery) => getCustomerProductSummary(delivery));
  const mergedSummary = lines.join(" | ");
  const primaryDelivery =
    [...deliveries].sort(
      (left, right) =>
        getDeliveryStatusPriority(left?.status) - getDeliveryStatusPriority(right?.status) ||
        String(left?.id || "").localeCompare(String(right?.id || ""))
    )[0] || null;

  const totalAmountDue = deliveries.reduce((total, delivery) => {
    const due = Number(delivery?.amountDue || 0);
    return total + (Number.isFinite(due) && due > 0 ? due : 0);
  }, 0);

  const requiresPaymentCollection = deliveries.some((delivery) => {
    const status = String(delivery?.status || "").toUpperCase();
    return (
      Boolean(delivery?.requiresPaymentCollection) &&
      (status === "PENDING" || status === "OUT_FOR_DELIVERY" || status === "IN_TRANSIT")
    );
  });

  return {
    primaryDelivery,
    mergedSummary,
    mergedCount: deliveries.length,
    requiresPaymentCollection,
    totalAmountDue,
  };
};

const playBeepSound = (type = "success") => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === "success") {
      // Cheerful high-pitch double beep
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
      oscillator.start();

      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5
      gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime + 0.08);

      oscillator.stop(audioCtx.currentTime + 0.22);
    } else {
      // Lower warning tone for failure
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); // Low G3
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.35);
    }
  } catch (error) {
    console.error("Failed to play notification sound:", error);
  }
};

/**
 * Compact Operational Delivery Card (Target height: ~75px - 90px)
 * Priority:
 * 1. Flat / Room / Unit number (PRIMARY, bold amber/dark)
 * 2. Customer name (SECONDARY) + Call icon
 * 3. Delivery Requirement (TERTIARY, bold compact product & packet line)
 * 4. Status indicator
 * 5. Direct Quick Delivery Actions (✓ & ✕ touch targets min 44px)
 * Tap on card body opens full DeliveryDetailsModal if needed.
 */
const BuildingDeliveryTaskCard = ({
  customer,
  isSubmitting,
  onMarkDelivered,
  onMarkNotDelivered,
  onOpenDetails,
}) => {
  const delivery = customer.primaryDelivery || customer.deliveries?.[0] || {};
  const deliveryStatus = String(delivery?.status || "PENDING").toUpperCase();
  const isPending =
    deliveryStatus === "PENDING" ||
    deliveryStatus === "OUT_FOR_DELIVERY" ||
    deliveryStatus === "IN_TRANSIT";
  const isCompleted = deliveryStatus === "COMPLETED";
  const isFailed = deliveryStatus === "FAILED";

  const customerPhone = String(
    delivery?.phoneNumber ||
      delivery?.phone_number ||
      delivery?.customerPhone ||
      delivery?.customer_phone ||
      delivery?.mobile ||
      ""
  ).trim();
  const dialNumber = customerPhone.replace(/[^\d+]/g, "");

  const compactRequirement = useMemo(
    () => getCompactDeliverySummary(customer.deliveries || [delivery]),
    [customer.deliveries, delivery]
  );

  const completedTime = useMemo(() => {
    const timestamp = delivery?.completedAt || delivery?.updated_at;
    if (!timestamp || timestamp === "-") return "";
    try {
      const d = new Date(timestamp);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }
    } catch {
      /* ignore */
    }
    return String(timestamp).slice(0, 8);
  }, [delivery?.completedAt, delivery?.updated_at]);

  return (
    <div
      onClick={() => onOpenDetails && onOpenDetails(customer)}
      className={`group relative flex items-center justify-between gap-2.5 rounded-[16px] border p-2.5 px-3.5 transition cursor-pointer select-none ${
        isCompleted
          ? "border-[#DDE8D1] bg-[#FAFDF8] shadow-[0_2px_8px_rgba(74,124,47,0.04)] opacity-85 hover:opacity-100"
          : isFailed
          ? "border-[#F2D0C8] bg-[#FFFDFC] shadow-[0_2px_8px_rgba(192,57,43,0.04)]"
          : "border-[#EDE8DF] bg-white shadow-[0_4px_14px_rgba(92,61,30,0.05)] hover:border-[#E0D3C1] hover:shadow-[0_6px_18px_rgba(92,61,30,0.08)]"
      }`}
    >
      {/* LEFT: Info Column (Name [Preference] -> Flat No [BIG] -> Requirement) */}
      <div className="min-w-0 flex-1 py-0.5">
        {/* Row 1: Customer Name (Primary Preference) & Call Icon */}
        <div className="flex items-center gap-1.5 min-w-0">
          <h4 className="text-[14px] sm:text-[15px] font-bold leading-tight text-[#2C1A0E] truncate">
            {customer.customerName}
          </h4>
          {dialNumber ? (
            <a
              href={`tel:${dialNumber}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#EEF5E7] text-[#4A7C2F] hover:bg-[#DDE8D1] transition shrink-0"
              title={`Call ${customer.customerName}`}
            >
              <Phone size={11} />
            </a>
          ) : null}
        </div>

        {/* Row 2: Flat / Unit Number (BIG & High-Contrast) & Payment Due Badge */}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[16px] sm:text-[17px] font-black tracking-tight text-[#B8641A] leading-tight">
            {customer.unitLabel || (customer.flatLabel ? `Flat ${customer.flatLabel}` : "Unit")}
          </span>
          {customer.requiresPaymentCollection && isPending && (
            <span className="rounded-full border border-[#F0D9B9] bg-[#FFF4E2] px-1.5 py-0.2 text-[9px] font-black tracking-tight text-[#B8641A] shrink-0">
              Collect Rs {Number(customer.totalAmountDue || 0).toFixed(0)}
            </span>
          )}
        </div>

        {/* Row 3: Delivery Requirement (Prominent & Compact) */}
        <p className="mt-0.5 text-[12px] font-extrabold text-[#7A4515] leading-tight truncate">
          {compactRequirement || "Milk / Product"}
        </p>
      </div>

      {/* RIGHT: Quick Direct Actions or Status */}
      <div className="shrink-0 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {isCompleted && (
          <div className="flex flex-col items-end text-right pl-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#DDE8D1] bg-[#EEF5E7] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#4A7C2F]">
              <CheckCircle2 size={12} />
              Delivered
            </span>
            {completedTime && (
              <span className="mt-0.5 text-[9px] font-semibold text-[#8B7355]">
                {completedTime}
              </span>
            )}
          </div>
        )}

        {isFailed && (
          <div className="flex flex-col items-end text-right pl-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#F2D0C8] bg-[#FDECEA] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#C0392B]">
              <XCircle size={12} />
              Failed
            </span>
            {customer.primaryDelivery?.failedReason && (
              <span
                className="mt-0.5 max-w-[90px] truncate text-[9px] font-semibold text-[#A33A2B]"
                title={customer.primaryDelivery.failedReason}
              >
                {customer.primaryDelivery.failedReason}
              </span>
            )}
          </div>
        )}

        {isPending && (
          <div className="flex items-center gap-1.5">
            {/* Mark Delivered Direct Button */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onMarkDelivered}
              className="flex h-11 min-w-[44px] px-2.5 items-center justify-center gap-1 rounded-[12px] bg-[#4A7C2F] text-white shadow-sm transition hover:bg-[#3D6826] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#A6C495]"
              title={customer.requiresPaymentCollection ? "Collect & Deliver" : "Mark Delivered"}
              aria-label="Mark Delivered"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Check size={18} strokeWidth={3} />
                  {customer.requiresPaymentCollection && (
                    <span className="text-[10px] font-black uppercase tracking-tight">Collect</span>
                  )}
                </>
              )}
            </button>

            {/* Not Delivered Direct Button */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onMarkNotDelivered}
              className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#F2D0C8] bg-[#FFF5F4] text-[#C0392B] transition hover:bg-[#FDECEA] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              title="Not Delivered"
              aria-label="Not Delivered"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AgentBuildingTasksPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const buildingName = decodeURIComponent(params.buildingName || "");

  const [deliveries, setDeliveries] = useState(() => getCachedAssignedAgentDeliveries({ today: true }));
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [failedDelivery, setFailedDelivery] = useState(null);
  const [proofDelivery, setProofDelivery] = useState(null);
  const [submittingCustomerKey, setSubmittingCustomerKey] = useState(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getPendingAgentSyncCount());

  useEffect(() => {
    const loadDeliveries = async () => {
      try {
        const payload = await fetchAssignedAgentDeliveries({ today: true });
        setDeliveries(payload || []);
      } catch {
        setDeliveries([]);
      }
    };
    loadDeliveries();
  }, []);

  useEffect(() => {
    const reload = async () => {
      setIsOnline(true);
      await flushAgentOfflineQueue();
      setPendingSyncCount(getPendingAgentSyncCount());
      try {
        const payload = await fetchAssignedAgentDeliveries({ today: true });
        setDeliveries(payload || []);
      } catch {
        /* ignore */
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setPendingSyncCount(getPendingAgentSyncCount());
    };

    const unsubscribe = subscribeToAgentOfflineState(() => {
      setPendingSyncCount(getPendingAgentSyncCount());
      setDeliveries(getCachedAssignedAgentDeliveries({ today: true }));
    });

    window.addEventListener("online", reload);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener("online", reload);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const buildingDeliveries = useMemo(
    () => deliveries.filter((delivery) => getBuildingName(delivery) === buildingName),
    [buildingName, deliveries]
  );

  const hierarchy = useMemo(
    () => buildDynamicPropertyHierarchy(buildingDeliveries),
    [buildingDeliveries]
  );

  const [selectedWing, setSelectedWing] = useState("ALL");
  const [hasInteractedInSession, setHasInteractedInSession] = useState(false);

  // Real-time Building Summary stats (derived directly from hierarchy)
  const buildingStats = useMemo(() => {
    const total = hierarchy.totalCount;
    const completed = hierarchy.completedCount;
    const failed = hierarchy.failedCount;
    const pending = hierarchy.pendingCount;
    const totalMilkLiters = buildingDeliveries.reduce((sum, d) => {
      if (isMilkProduct(d)) {
        return sum + getQuantityValue(d?.quantity ?? d?.quantity_liters);
      }
      return sum;
    }, 0);

    const isAllDone = total > 0 && pending === 0;

    return {
      total,
      completed,
      failed,
      pending,
      totalMilkLiters,
      isAllDone,
    };
  }, [hierarchy, buildingDeliveries]);

  // Section 22: Automatic Back Navigation after all building deliveries are completed
  useEffect(() => {
    if (hasInteractedInSession && buildingStats.isAllDone && buildingStats.total > 0) {
      const timer = setTimeout(() => {
        navigate("/agent/working", { replace: true });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasInteractedInSession, buildingStats.isAllDone, buildingStats.total, navigate]);

  const resolveDeliveryForModal = useCallback(
    (delivery) => {
      const targetId = String(delivery?.id || "").trim();
      if (!targetId) return null;

      const latest = deliveries.find((item) => String(item?.id) === targetId) || delivery;
      const normalizedStatus = String(latest?.status || "").toUpperCase();
      const status = normalizedStatus === "IN_TRANSIT" ? "OUT_FOR_DELIVERY" : normalizedStatus || "PENDING";

      return {
        ...latest,
        status,
      };
    },
    [deliveries]
  );

  useEffect(() => {
    const selectedDeliveryId = String(location.state?.selectedDeliveryId || "").trim();
    if (!selectedDeliveryId || !buildingDeliveries.length) return;

    const matchedDelivery = buildingDeliveries.find(
      (delivery) => String(delivery.id) === selectedDeliveryId
    );
    if (!matchedDelivery) return;

    setSelectedDelivery(resolveDeliveryForModal(matchedDelivery));
    navigate(location.pathname, { replace: true, state: null });
  }, [buildingDeliveries, location.pathname, location.state, navigate, resolveDeliveryForModal]);

  useEffect(() => {
    if (!selectedDelivery?.id) return;
    const refreshed = resolveDeliveryForModal(selectedDelivery);
    if (!refreshed) return;

    if (String(refreshed?.status || "") !== String(selectedDelivery?.status || "")) {
      setSelectedDelivery((prev) => ({
        ...refreshed,
        mergedDeliveries: prev?.mergedDeliveries || [],
        mergedCount: prev?.mergedCount || 1,
        mergedSummary: prev?.mergedSummary || "",
        totalAmountDue: prev?.totalAmountDue || 0,
        requiresPaymentCollection: Boolean(prev?.requiresPaymentCollection),
      }));
    }
  }, [deliveries, selectedDelivery, resolveDeliveryForModal]);

  // Open full details modal if agent taps Details button
  const handleOpenDetails = useCallback(
    (customer) => {
      const baseDelivery = customer?.primaryDelivery || customer?.delivery || customer?.deliveries?.[0] || null;
      const resolved = resolveDeliveryForModal(baseDelivery);
      if (!resolved) return;

      const mergedDeliveries = Array.isArray(customer?.deliveries)
        ? customer.deliveries.map((item) => resolveDeliveryForModal(item)).filter(Boolean)
        : [];

      setSelectedDelivery({
        ...resolved,
        mergedDeliveries,
        mergedCount: Number(customer?.mergedCount || mergedDeliveries.length || 1),
        mergedSummary: customer?.mergedSummary || "",
        totalAmountDue: Number(customer?.totalAmountDue || 0),
        requiresPaymentCollection: Boolean(customer?.requiresPaymentCollection),
      });
    },
    [resolveDeliveryForModal]
  );

  // Direct Mark Delivered from Card
  const handleDirectMarkDelivered = useCallback(
    async (customer) => {
      const baseDelivery = customer?.primaryDelivery || customer?.deliveries?.[0];
      if (!baseDelivery) return;

      const requiresCollection = Boolean(customer?.requiresPaymentCollection);
      const isBuyOnce = customer?.deliveries?.some(
        (d) => String(d?.deliveryType || "").toUpperCase() === "BUY ONCE"
      );

      // If payment collection or Buy-Once proof is required, route to proof modal
      if (requiresCollection || (isBuyOnce && !baseDelivery.deliveryProofType)) {
        const mergedDeliveries = Array.isArray(customer.deliveries)
          ? customer.deliveries.map((item) => resolveDeliveryForModal(item)).filter(Boolean)
          : [];
        setProofDelivery({
          ...baseDelivery,
          mergedDeliveries,
          mergedCount: customer.mergedCount || mergedDeliveries.length || 1,
          mergedSummary: customer.mergedSummary || "",
          totalAmountDue: customer.totalAmountDue || 0,
          requiresPaymentCollection: requiresCollection,
        });
        return;
      }

      // Prevent duplicate clicks
      if (submittingCustomerKey) return;
      const customerKey = customer.id;
      setSubmittingCustomerKey(customerKey);

      const deliveryIds = Array.from(
        new Set(
          (customer.deliveries || [baseDelivery])
            .map((item) => String(item?.id || "").trim())
            .filter(Boolean)
        )
      );
      if (!deliveryIds.length) {
        setSubmittingCustomerKey(null);
        return;
      }

      const nowTime = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

      // Immediate optimistic update
      setHasInteractedInSession(true);
      setDeliveries((prev) =>
        prev.map((d) =>
          deliveryIds.includes(String(d.id))
            ? {
                ...d,
                status: "COMPLETED",
                completedAt: nowTime,
                updated_at: new Date().toISOString(),
              }
            : d
        )
      );

      playBeepSound("success");

      try {
        await Promise.all(
          deliveryIds.map((deliveryId) =>
            updateAssignedAgentDeliveryStatus({
              deliveryId,
              status: "COMPLETED",
              reason: "DELIVERED",
            })
          )
        );
      } catch (err) {
        console.error("Direct mark delivered error:", err);
      } finally {
        setSubmittingCustomerKey(null);
      }
    },
    [resolveDeliveryForModal, submittingCustomerKey]
  );

  // Direct Not Delivered from Card -> opens reason selector
  const handleDirectMarkNotDelivered = useCallback(
    (customer) => {
      const baseDelivery = customer?.primaryDelivery || customer?.deliveries?.[0];
      if (!baseDelivery) return;
      const mergedDeliveries = Array.isArray(customer?.deliveries)
        ? customer.deliveries.map((item) => resolveDeliveryForModal(item)).filter(Boolean)
        : [];
      setFailedDelivery({
        ...baseDelivery,
        mergedDeliveries,
        mergedCount: customer.mergedCount || mergedDeliveries.length || 1,
      });
    },
    [resolveDeliveryForModal]
  );

  const handleCompleteWithProof = (delivery) => setProofDelivery(delivery);

  const handleProofSubmit = async ({ proofType, proofOtp, imagePreview, collectionMethod }) => {
    if (!proofDelivery?.id) return;
    const mergedItems = Array.isArray(proofDelivery?.mergedDeliveries) ? proofDelivery.mergedDeliveries : [];
    const fallbackLinkedItems = deliveries.filter((item) => {
      const sameCustomer =
        String(item?.customerName || "").trim().toLowerCase() ===
        String(proofDelivery?.customerName || "").trim().toLowerCase();
      const sameAddress =
        String(item?.address || "").trim().toLowerCase() ===
        String(proofDelivery?.address || "").trim().toLowerCase();
      const sameDate = String(item?.date || "") === String(proofDelivery?.date || "");
      return sameCustomer && sameAddress && sameDate;
    });
    const deliveryIds = Array.from(
      new Set(
        [proofDelivery, ...mergedItems, ...fallbackLinkedItems]
          .map((item) => String(item?.id || "").trim())
          .filter(Boolean)
      )
    );
    if (!deliveryIds.length) return;
    const proofNote = proofType === "OTP" ? `OTP_CONFIRMED:${proofOtp}` : "PHOTO_ATTACHED";

    const nowTime = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    setHasInteractedInSession(true);
    setDeliveries((prev) =>
      prev.map((d) =>
        deliveryIds.includes(String(d.id))
          ? {
              ...d,
              status: "COMPLETED",
              completedAt: nowTime,
              deliveryProofType: proofType,
              deliveryProofOtp: proofType === "OTP" ? proofOtp : null,
              deliveryProofImage: proofType === "PHOTO" ? imagePreview : null,
              paymentCollectionMethod: collectionMethod || d?.paymentCollectionMethod || "",
              updated_at: new Date().toISOString(),
            }
          : d
      )
    );
    setProofDelivery(null);
    playBeepSound("success");

    try {
      await Promise.all(
        deliveryIds.map((deliveryId) =>
          updateAssignedAgentDeliveryStatus({
            deliveryId,
            status: "COMPLETED",
            proofType,
            proofOtp,
            proofImage: proofType === "PHOTO" ? imagePreview : "",
            reason: proofNote,
            collectionMethod,
          })
        )
      );
    } catch {
      /* ignore */
    }
  };

  const handleFailClick = (delivery) => setFailedDelivery(delivery);

  const handleFailedSubmit = async ({ reason }) => {
    if (!failedDelivery?.id) return;
    const mergedItems = Array.isArray(failedDelivery?.mergedDeliveries) ? failedDelivery.mergedDeliveries : [];
    const deliveryIds = Array.from(
      new Set(
        [failedDelivery, ...mergedItems]
          .map((item) => String(item?.id || "").trim())
          .filter(Boolean)
      )
    );

    setHasInteractedInSession(true);
    setDeliveries((prev) =>
      prev.map((d) =>
        deliveryIds.includes(String(d.id))
          ? { ...d, status: "FAILED", failedReason: reason, updated_at: new Date().toISOString() }
          : d
      )
    );
    setFailedDelivery(null);
    playBeepSound("failure");

    try {
      await Promise.all(
        deliveryIds.map((deliveryId) =>
          updateAssignedAgentDeliveryStatus({ deliveryId, status: "FAILED", reason })
        )
      );
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="agent-safe-top min-h-screen bg-[#FFFDF7] px-4 pb-32 text-[#2C1A0E]">
      <div className="mx-auto max-w-md space-y-5">
        {/* Header with Navigation */}
        <section className="rounded-[20px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFF3E8_100%)] p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate("/agent/working")}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E7DAC6] bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#8B7355] transition hover:bg-[#FAF7F2]"
            >
              <ArrowLeft size={13} />
              Back
            </button>
            <div className="text-right flex items-center gap-2">
              <span className="text-[11px] font-black text-[#B8641A]">{buildingStats.pending} Pending</span>
              <span className="text-[#C4B29E]">•</span>
              <span className="text-[11px] font-bold text-[#4A7C2F]">{buildingStats.completed} Done</span>
            </div>
          </div>
          <h1 className="mt-1 text-lg font-black leading-tight text-[#2C1A0E]" style={headingFont}>
            {buildingName || "Building"}
          </h1>
        </section>

        {!isOnline || pendingSyncCount > 0 ? (
          <div className="rounded-[16px] border border-[#E7DAC6] bg-white px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#8B5E34] shadow-sm">
            {!isOnline
              ? `Offline mode${pendingSyncCount > 0 ? ` • ${pendingSyncCount} updates waiting` : ""}`
              : `${pendingSyncCount} updates waiting to sync`}
          </div>
        ) : null}

        {buildingStats.isAllDone && (
          <div className="rounded-[18px] border border-[#DDE8D1] bg-[#EEF5E7] p-3 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-[#4A7C2F]" />
                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#4A7C2F]">
                  All Deliveries Completed
                </span>
              </div>
              {hasInteractedInSession && (
                <span className="text-[10px] font-bold text-[#4A7C2F]/80">Returning to Tasks...</span>
              )}
            </div>
            {hasInteractedInSession && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/agent/working")}
                  className="rounded-full bg-[#4A7C2F] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-[#3D6826]"
                >
                  Go to Tasks Now
                </button>
                <button
                  type="button"
                  onClick={() => setHasInteractedInSession(false)}
                  className="rounded-full border border-[#DDE8D1] bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#4A7C2F] transition hover:bg-[#EEF5E7]"
                >
                  Stay on Page
                </button>
              </div>
            )}
          </div>
        )}

        {/* Compact 1-Row Summary Pill Strip */}
        <div className="flex items-center justify-between rounded-[14px] border border-[#EDE8DF] bg-white px-3 py-2 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <span><strong className="font-black text-[#2C1A0E]">{buildingStats.total}</strong> <span className="text-[9px] font-bold uppercase text-[#8B7355]">Total</span></span>
            <span><strong className="font-black text-[#B8641A]">{buildingStats.pending}</strong> <span className="text-[9px] font-bold uppercase text-[#8B7355]">Pending</span></span>
            <span><strong className="font-black text-[#4A7C2F]">{buildingStats.completed}</strong> <span className="text-[9px] font-bold uppercase text-[#8B7355]">Done</span></span>
            {buildingStats.failed > 0 && (
              <span><strong className="font-black text-[#C0392B]">{buildingStats.failed}</strong> <span className="text-[9px] font-bold uppercase text-[#8B7355]">Failed</span></span>
            )}
          </div>
          <span className="text-xs font-black text-[#B8641A]">
            {formatQuantity(buildingStats.totalMilkLiters)} L
          </span>
        </div>

        {/* Wing Selector Tabs (only shown if wings exist and there are multiple wings) */}
        {hierarchy.hasWings && hierarchy.wings.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedWing("ALL")}
              className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] transition shrink-0 ${
                selectedWing === "ALL"
                  ? "bg-[#B8641A] text-white shadow-sm"
                  : "border border-[#E7DAC6] bg-white text-[#8B7355] hover:bg-[#FAF7F2]"
              }`}
            >
              All Wings ({hierarchy.pendingCount})
            </button>
            {hierarchy.wings.map((wing) => (
              <button
                key={wing.wingName}
                type="button"
                onClick={() => setSelectedWing(wing.wingName)}
                className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] transition shrink-0 ${
                  selectedWing === wing.wingName
                    ? "bg-[#B8641A] text-white shadow-sm"
                    : wing.isCompleted
                    ? "border border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F] hover:bg-[#E6F2DB]"
                    : "border border-[#E7DAC6] bg-white text-[#8B7355] hover:bg-[#FAF7F2]"
                }`}
              >
                {wing.wingName} ({wing.isCompleted ? "✓" : wing.pendingCount})
              </button>
            ))}
          </div>
        )}

        {/* Delivery Queue (High-Density List) */}
        <div className="space-y-4">
          {hierarchy.totalCount === 0 ? (
            <div className="rounded-[20px] border border-[#EDE8DF] bg-white p-8 text-center shadow-sm">
              <Package className="mx-auto mb-2 text-[#D4B896]" size={32} />
              <p className="text-xs font-bold text-[#A88763]">No delivery tasks found for this building</p>
            </div>
          ) : hierarchy.hasWings ? (
            hierarchy.wings
              .filter((wing) => selectedWing === "ALL" || wing.wingName === selectedWing)
              .map((wing) => (
                <div key={wing.wingName} className="space-y-3 pt-1">
                  {/* Wing Section Header */}
                  <div className="border-b border-[#EBDCC8] pb-1.5 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#A88763]">Wing / Section</span>
                      <h2 className="text-base font-black text-[#2C1A0E] leading-tight">{wing.wingName}</h2>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${
                        wing.isCompleted
                          ? "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]"
                          : "border-[#F0D1B2] bg-[#FFF1E4] text-[#B8641A]"
                      }`}
                    >
                      {wing.isCompleted ? "✓ Completed" : `${wing.pendingCount} Pending`}
                    </span>
                  </div>

                  {/* Floor sections */}
                  <div className="space-y-3">
                    {wing.floors.map((floor) => (
                      <section key={floor.floorLabel} className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6B5B3E]">
                            {floor.floorLabel}
                          </h3>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${
                              floor.isCompleted
                                ? "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]"
                                : "border-[#F0D1B2] bg-[#FFF1E4] text-[#B8641A]"
                            }`}
                          >
                            {floor.isCompleted ? "✓ Completed" : `${floor.pendingCount} Pending`}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {floor.units.map((unit) =>
                            unit.customers.map((customer) => (
                              <BuildingDeliveryTaskCard
                                key={customer.id}
                                customer={customer}
                                isSubmitting={submittingCustomerKey === customer.id}
                                onMarkDelivered={() => handleDirectMarkDelivered(customer)}
                                onMarkNotDelivered={() => handleDirectMarkNotDelivered(customer)}
                                onOpenDetails={() => handleOpenDetails(customer)}
                              />
                            ))
                          )}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              ))
          ) : (
            <div className="space-y-3">
              {hierarchy.floors.map((floor) => (
                <section key={floor.floorLabel} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6B5B3E]">
                      {floor.floorLabel}
                    </h3>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${
                        floor.isCompleted
                          ? "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]"
                          : "border-[#F0D1B2] bg-[#FFF1E4] text-[#B8641A]"
                      }`}
                    >
                      {floor.isCompleted ? "✓ Completed" : `${floor.pendingCount} Pending`}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {floor.units.map((unit) =>
                      unit.customers.map((customer) => (
                        <BuildingDeliveryTaskCard
                          key={customer.id}
                          customer={customer}
                          isSubmitting={submittingCustomerKey === customer.id}
                          onMarkDelivered={() => handleDirectMarkDelivered(customer)}
                          onMarkNotDelivered={() => handleDirectMarkNotDelivered(customer)}
                          onOpenDetails={() => handleOpenDetails(customer)}
                        />
                      ))
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Navigation */}
      <div className="fixed bottom-6 left-1/2 z-50 flex w-[94%] max-w-md -translate-x-1/2 items-center justify-around rounded-full border border-[#E7DAC6] bg-[#FFFDF7]/95 p-2 shadow-[0_18px_40px_rgba(92,61,30,0.14)] backdrop-blur-md">
        <NavTab icon={<Home size={18} />} label="Home" onClick={() => navigate("/agent/dashboard")} />
        <NavTab
          icon={<MapIcon size={18} />}
          label="Map"
          onClick={() => navigate("/agent/dashboard", { state: { section: "MAP" } })}
        />
        <NavTab icon={<List size={18} />} label="Tasks" active onClick={() => navigate("/agent/working")} />
        <NavTab icon={<History size={18} />} label="History" onClick={() => navigate("/agent/history")} />
        <NavTab icon={<User size={18} />} label="Profile" onClick={() => navigate("/agent/profile")} />
      </div>

      {/* Full Details Modal (Accessible via Details button) */}
      {selectedDelivery && (
        <DeliveryDetailsModal
          delivery={selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
          onCompleteRequest={(delivery) => {
            setSelectedDelivery(null);
            handleCompleteWithProof(delivery);
          }}
          onMarkFailed={(delivery) => {
            setSelectedDelivery(null);
            handleFailClick(delivery);
          }}
        />
      )}

      {/* Not Delivered / Failed Reason Modal */}
      {failedDelivery && (
        <FailedReasonModal
          delivery={failedDelivery}
          onSubmit={handleFailedSubmit}
          onClose={() => setFailedDelivery(null)}
        />
      )}

      {/* Payment / Proof Modal for Buy-Once COD deliveries */}
      {proofDelivery && (
        <Suspense fallback={null}>
          <DeliveryProofModal
            delivery={proofDelivery}
            onClose={() => setProofDelivery(null)}
            onSubmit={handleProofSubmit}
          />
        </Suspense>
      )}
    </div>
  );
};

export default AgentBuildingTasksPage;
