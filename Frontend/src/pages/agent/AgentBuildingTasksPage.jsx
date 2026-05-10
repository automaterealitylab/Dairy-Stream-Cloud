import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Home, History, List, Map, Package, User } from "lucide-react";
import DeliveryDetailsModal from "../../components/agent/DeliveryDetailsModal";
import DeliveryProofModal from "../../components/agent/DeliveryProofModal";
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
  buildFloorGroups,
  formatQuantity,
  getBuildingName,
  getQuantityValue,
  getProductLabel,
  isMilkProduct,
} from "../../utils/agentTaskGrouping";

const headingFont = { fontFamily: "'Lora', serif" };

const NavTab = ({ icon, label, active, onClick }) => (
  <button
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

const CustomerRow = ({ customer, onOpen }) => {
  const delivery = customer.delivery;

  return (
    <button
      type="button"
      onClick={() => onOpen(delivery)}
      className="w-full rounded-[24px] border border-[#EDE8DF] bg-white px-3 py-2.5 text-left shadow-[0_14px_35px_rgba(92,61,30,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(92,61,30,0.11)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A88763]">
            Flat {customer.flatLabel}
          </p>
          <h3 className="mt-0.5 text-base font-black leading-tight text-[#2C1A0E]">{customer.customerName}</h3>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getStatusTone(
            delivery?.status
          )}`}
        >
          {delivery?.status || "PENDING"}
        </span>
      </div>
      <p className="mt-1 truncate whitespace-nowrap text-sm font-semibold leading-tight text-[#6B5B3E]">
        {getCustomerProductSummary(delivery)}
      </p>
    </button>
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
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getPendingAgentSyncCount());

  useEffect(() => {
    const loadDeliveries = async () => {
      try {
        const payload = await fetchAssignedAgentDeliveries({ today: true });
        setDeliveries(payload || []);
      } catch (_err) {
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
      } catch (_err) {}
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

  const buildingSummary = useMemo(
    () => buildBuildingTaskGroups(buildingDeliveries)[0] || null,
    [buildingDeliveries]
  );

  const floorGroups = useMemo(() => buildFloorGroups(buildingDeliveries), [buildingDeliveries]);

  const resolveDeliveryForModal = useCallback((delivery) => {
    const targetId = String(delivery?.id || "").trim();
    if (!targetId) return null;

    const latest = deliveries.find((item) => String(item?.id) === targetId) || delivery;
    const normalizedStatus = String(latest?.status || "").toUpperCase();
    const status = normalizedStatus === "IN_TRANSIT" ? "OUT_FOR_DELIVERY" : normalizedStatus || "PENDING";

    return {
      ...latest,
      status,
    };
  }, [deliveries]);

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
      setSelectedDelivery(refreshed);
    }
  }, [deliveries, selectedDelivery, resolveDeliveryForModal]);

  const handleCompleteWithProof = (delivery) => setProofDelivery(delivery);

  const handleProofSubmit = async ({ proofType, proofOtp, imagePreview }) => {
    if (!proofDelivery?.id) return;
    const deliveryId = proofDelivery.id;
    const proofNote = proofType === "OTP" ? `OTP_CONFIRMED:${proofOtp}` : "PHOTO_ATTACHED";

    setDeliveries((prev) =>
      prev.map((d) =>
        String(d.id) === String(deliveryId)
          ? {
              ...d,
              status: "COMPLETED",
              deliveryProofType: proofType,
              deliveryProofOtp: proofType === "OTP" ? proofOtp : null,
              deliveryProofImage: proofType === "PHOTO" ? imagePreview : null,
            }
          : d
      )
    );
    setProofDelivery(null);

    try {
      await updateAssignedAgentDeliveryStatus({
        deliveryId,
        status: "COMPLETED",
        proofType,
        proofOtp,
        proofImage: proofType === "PHOTO" ? imagePreview : "",
        reason: proofNote,
      });
    } catch (_err) {}
  };

  const handleFailClick = (delivery) => setFailedDelivery(delivery);

  const handleFailedSubmit = async ({ reason }) => {
    if (!failedDelivery?.id) return;
    const deliveryId = failedDelivery.id;
    setDeliveries((prev) =>
      prev.map((d) => (String(d.id) === String(deliveryId) ? { ...d, status: "FAILED", failedReason: reason } : d))
    );
    setFailedDelivery(null);

    try {
      await updateAssignedAgentDeliveryStatus({ deliveryId, status: "FAILED", reason });
    } catch (_err) {}
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] px-4 pb-32 text-[#2C1A0E]">
      <div className="mx-auto max-w-md space-y-5">
        <section className="rounded-[28px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFF3E8_100%)] px-4 py-3 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <button
            type="button"
            onClick={() => navigate("/agent/working")}
            className="inline-flex items-center gap-2 rounded-full border border-[#E7DAC6] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#8B7355]"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <p className="mt-2.5 text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">Building Details</p>
          <h1 className="mt-1.5 text-[28px] font-black leading-none text-[#2C1A0E]" style={headingFont}>
            {buildingName || "Building"}
          </h1>
          <p className="mt-1 text-sm font-semibold leading-tight text-[#6B5B3E]">
            Flats and customers arranged floor by floor
          </p>
        </section>

        {!isOnline || pendingSyncCount > 0 ? (
          <div className="rounded-[22px] border border-[#E7DAC6] bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#8B5E34] shadow-sm">
            {!isOnline
              ? `Offline mode${pendingSyncCount > 0 ? ` • ${pendingSyncCount} updates waiting` : ""}`
              : `${pendingSyncCount} updates waiting to sync`}
          </div>
        ) : null}

        {buildingSummary && (
          <section className="rounded-[28px] border border-[#EDE8DF] bg-white p-4 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-[#B8641A]" />
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">Delivery Summary</p>
            </div>
            <div className="mt-3 flex gap-1.5">
              <div className="min-w-0 flex-1 rounded-[16px] border border-[#E7DAC6] bg-[#FFF8EF] px-2 py-1.5">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#A88763]">
                  Deliveries
                </p>
                <p className="mt-0.5 text-sm font-black leading-none text-[#2C1A0E]">
                  {buildingSummary.deliveries.length}
                </p>
                <p className="mt-0 text-[10px] font-semibold leading-tight text-[#6B5B3E]">
                  Total milk {formatQuantity(buildingSummary.milkTotal)} L
                </p>
              </div>

              <div className="min-w-0 flex-1 rounded-[16px] border border-[#DDE8D1] bg-[#EEF5E7] px-2 py-1.5">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#6B8A4A]">
                  Milk Types
                </p>
                <p className="mt-0.5 text-[11px] font-black leading-tight text-[#2C1A0E]">
                  {buildingSummary.milkTypes.length
                    ? buildingSummary.milkTypes.map((item) => item.label).join(", ")
                    : "No milk items"}
                </p>
              </div>

              <div className="min-w-0 flex-1 rounded-[16px] border border-[#F0D9B9] bg-[#FFF4E2] px-2 py-1.5">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#B8641A]">
                  Other Products
                </p>
                <p className="mt-0.5 text-[11px] font-black leading-tight text-[#2C1A0E]">
                  {buildingSummary.otherProducts.length
                    ? buildingSummary.otherProducts.map((item) => item.label).join(", ")
                    : "No extra products"}
                </p>
              </div>
            </div>
          </section>
        )}

        <div className="space-y-4">
          {floorGroups.length === 0 ? (
            <div className="rounded-[28px] border border-[#EDE8DF] bg-white p-12 text-center shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
              <Package className="mx-auto mb-3 text-[#D4B896]" size={40} />
              <p className="text-sm font-bold text-[#A88763]">No flats found for this building</p>
            </div>
          ) : (
            floorGroups.map((floor) => (
              <section
                key={floor.floorLabel}
                className="rounded-[28px] border border-[#EDE8DF] bg-[#FFFCF7] p-3 shadow-[0_14px_35px_rgba(92,61,30,0.07)]"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A88763]">Floor</p>
                    <h2 className="mt-1 text-lg font-black text-[#2C1A0E]">{floor.floorLabel}</h2>
                  </div>
                  <span className="rounded-full border border-[#E7DAC6] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#8B7355]">
                    {floor.customers.length} flats
                  </span>
                </div>

                <div className="space-y-2">
                  {floor.customers.map((customer) => (
                    <CustomerRow
                      key={customer.id}
                      customer={customer}
                      onOpen={(delivery) => {
                        const resolved = resolveDeliveryForModal(delivery);
                        setSelectedDelivery(resolved);
                      }}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 z-50 flex w-[94%] max-w-md -translate-x-1/2 items-center justify-around rounded-full border border-[#E7DAC6] bg-[#FFFDF7]/95 p-2 shadow-[0_18px_40px_rgba(92,61,30,0.14)] backdrop-blur-md">
        <NavTab icon={<Home size={18} />} label="Home" onClick={() => navigate("/agent/dashboard")} />
        <NavTab
          icon={<Map size={18} />}
          label="Map"
          onClick={() => navigate("/agent/dashboard", { state: { section: "MAP" } })}
        />
        <NavTab icon={<List size={18} />} label="Tasks" active onClick={() => navigate("/agent/working")} />
        <NavTab icon={<History size={18} />} label="History" onClick={() => navigate("/agent/history")} />
        <NavTab icon={<User size={18} />} label="Profile" onClick={() => navigate("/agent/profile")} />
      </div>

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
      {failedDelivery && <FailedReasonModal delivery={failedDelivery} onSubmit={handleFailedSubmit} onClose={() => setFailedDelivery(null)} />}
      {proofDelivery && <DeliveryProofModal delivery={proofDelivery} onClose={() => setProofDelivery(null)} onSubmit={handleProofSubmit} />}
    </div>
  );
};

export default AgentBuildingTasksPage;
