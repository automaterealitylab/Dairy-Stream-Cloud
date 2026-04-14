import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Home, History, List, Package, User } from "lucide-react";
import DeliveryDetailsModal from "../../components/agent/DeliveryDetailsModal";
import DeliveryProofModal from "../../components/agent/DeliveryProofModal";
import FailedReasonModal from "../../components/agent/FailedReasonModal";
import {
  fetchAssignedAgentDeliveries,
  updateAssignedAgentDeliveryStatus,
} from "../../api/agent/agent.api";
import {
  buildBuildingTaskGroups,
  buildFloorGroups,
  formatQuantity,
  getBuildingName,
  getProductLabel,
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

const CustomerRow = ({ customer, onOpen }) => {
  const delivery = customer.delivery;

  return (
    <button
      type="button"
      onClick={() => onOpen(delivery)}
      className="w-full rounded-[24px] border border-[#EDE8DF] bg-white p-4 text-left shadow-[0_14px_35px_rgba(92,61,30,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(92,61,30,0.11)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A88763]">
            Flat {customer.flatLabel}
          </p>
          <h3 className="mt-1 text-base font-black text-[#2C1A0E]">{customer.customerName}</h3>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getStatusTone(
            delivery?.status
          )}`}
        >
          {delivery?.status || "PENDING"}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-[#6B5B3E]">{getProductLabel(delivery)}</p>
    </button>
  );
};

const AgentBuildingTasksPage = () => {
  const navigate = useNavigate();
  const params = useParams();
  const buildingName = decodeURIComponent(params.buildingName || "");

  const [deliveries, setDeliveries] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [failedDelivery, setFailedDelivery] = useState(null);
  const [proofDelivery, setProofDelivery] = useState(null);

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

  const buildingDeliveries = useMemo(
    () => deliveries.filter((delivery) => getBuildingName(delivery) === buildingName),
    [buildingName, deliveries]
  );

  const buildingSummary = useMemo(
    () => buildBuildingTaskGroups(buildingDeliveries)[0] || null,
    [buildingDeliveries]
  );

  const floorGroups = useMemo(() => buildFloorGroups(buildingDeliveries), [buildingDeliveries]);

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
    <div className="min-h-screen bg-[#FFFDF7] px-4 pb-32 pt-5 text-[#2C1A0E]">
      <div className="mx-auto max-w-md space-y-5">
        <section className="rounded-[28px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFF3E8_100%)] px-5 py-4 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <button
            type="button"
            onClick={() => navigate("/agent/working")}
            className="inline-flex items-center gap-2 rounded-full border border-[#E7DAC6] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#8B7355]"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">Building Details</p>
          <h1 className="mt-2 text-[28px] font-black leading-none text-[#2C1A0E]" style={headingFont}>
            {buildingName || "Building"}
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#6B5B3E]">
            Flats and customers arranged floor by floor
          </p>
        </section>

        {buildingSummary && (
          <section className="rounded-[28px] border border-[#EDE8DF] bg-white p-4 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-[#B8641A]" />
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">Delivery Summary</p>
            </div>
            <p className="mt-3 text-sm font-semibold text-[#6B5B3E]">
              {buildingSummary.deliveries.length} deliveries | Total milk {formatQuantity(buildingSummary.milkTotal)} L
            </p>
            <p className="mt-2 text-sm font-semibold text-[#6B5B3E]">
              Milk types:{" "}
              {buildingSummary.milkTypes.length
                ? buildingSummary.milkTypes.map((item) => item.label).join(", ")
                : "No milk items"}
            </p>
            <p className="mt-2 text-sm font-semibold text-[#6B5B3E]">
              Other products:{" "}
              {buildingSummary.otherProducts.length
                ? buildingSummary.otherProducts.map((item) => item.label).join(", ")
                : "No extra products"}
            </p>
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
                className="rounded-[28px] border border-[#EDE8DF] bg-[#FFFCF7] p-4 shadow-[0_14px_35px_rgba(92,61,30,0.07)]"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A88763]">Floor</p>
                    <h2 className="mt-1 text-lg font-black text-[#2C1A0E]">{floor.floorLabel}</h2>
                  </div>
                  <span className="rounded-full border border-[#E7DAC6] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#8B7355]">
                    {floor.customers.length} flats
                  </span>
                </div>

                <div className="space-y-3">
                  {floor.customers.map((customer) => (
                    <CustomerRow
                      key={customer.id}
                      customer={customer}
                      onOpen={setSelectedDelivery}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 z-50 flex w-[92%] max-w-md -translate-x-1/2 items-center justify-around rounded-full border border-[#E7DAC6] bg-[#FFFDF7]/95 p-2 shadow-[0_18px_40px_rgba(92,61,30,0.14)] backdrop-blur-md">
        <NavTab icon={<Home size={18} />} label="Home" onClick={() => navigate("/agent/dashboard")} />
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
