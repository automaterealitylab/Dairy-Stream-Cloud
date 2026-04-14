import React from "react";
import { CheckCircle, XCircle, Clock } from "lucide-react";

const DeliveryCard = ({ delivery, onStatusChange, onClick, onCompleteRequest }) => {
  const requiresPaymentCollection =
    Boolean(delivery?.requiresPaymentCollection) && String(delivery?.status || "").toUpperCase() === "PENDING";
  const collectionMethod = String(delivery?.paymentCollectionMethod || "").toUpperCase();

  const getTone = () => {
    switch (delivery.status) {
      case "COMPLETED":
        return {
          card: "border-[#DDE8D1] bg-[#EEF5E7]",
          badge: "bg-[#4A7C2F] text-white",
          accent: "text-[#4A7C2F]",
        };
      case "FAILED":
        return {
          card: "border-[#F2D0C8] bg-[#FDECEA]",
          badge: "bg-[#C0392B] text-white",
          accent: "text-[#C0392B]",
        };
      default:
        return {
          card: "border-[#F0D1B2] bg-[#FFF1E4]",
          badge: "bg-[#C86A2B] text-white",
          accent: "text-[#B8641A]",
        };
    }
  };

  const tone = getTone();

  const handleComplete = () => {
    if (delivery.status === "PENDING") {
      if (typeof onCompleteRequest === "function") {
        onCompleteRequest(delivery);
        return;
      }
      onStatusChange(delivery.id, "COMPLETED");
    }
  };

  const handleFailed = () => {
    if (delivery.status === "PENDING") {
      onStatusChange(delivery.id, "FAILED");
    }
  };

  return (
    <div
      className={`rounded-[28px] border p-4 shadow-[0_14px_35px_rgba(92,61,30,0.07)] transition-all ${tone.card}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onClick(delivery)}>
          <h4 className="truncate text-sm font-black text-[#2C1A0E]">{delivery.customerName}</h4>
          <p className="mt-1 text-sm text-[#6B5B3E]">{delivery.address}</p>
          <p className={`mt-1 text-xs font-black uppercase tracking-[0.14em] ${tone.accent}`}>
            {delivery.deliveryType || "REGULAR"}
          </p>
          <p className="mt-1 text-sm text-[#6B5B3E]">
            Quantity: <span className="font-bold text-[#2C1A0E]">{delivery.quantity}</span>
          </p>

          {requiresPaymentCollection && (
            <div className="mt-2 rounded-[14px] border border-[#F0D9B9] bg-[#FFF8EF] px-3 py-2">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#B8641A]">Payment Required</p>
              <p className="mt-1 text-xs text-[#8B7355]">
                Collect payment (
                {delivery.amountDue ? `Rs ${Number(delivery.amountDue).toFixed(2)}` : "amount due"}) via Cash or
                Online and mark it while completing.
              </p>
            </div>
          )}

          {String(delivery?.status || "").toUpperCase() === "COMPLETED" && collectionMethod && (
            <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-[#4A7C2F]">
              Payment Collected: {collectionMethod}
            </p>
          )}

          {delivery.buildingName && (
            <p className="mt-1 text-xs text-[#A88763]">
              Route Group: {delivery.buildingName}
              {delivery.buildingSequence ? ` • Stop ${delivery.buildingSequence}` : ""}
            </p>
          )}
        </div>

        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${tone.badge}`}>
          {delivery.status}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleComplete}
          disabled={delivery.status !== "PENDING"}
          className={`flex flex-1 items-center justify-center gap-2 rounded-[16px] py-2.5 text-sm font-bold transition ${
            delivery.status !== "PENDING"
              ? "cursor-not-allowed bg-[#E7DED1] text-[#B89970]"
              : "bg-[#4A7C2F] text-white hover:bg-[#3D6826]"
          }`}
        >
          <CheckCircle size={18} />
          {requiresPaymentCollection ? "Collect & Complete" : "Complete"}
        </button>

        <button
          onClick={handleFailed}
          disabled={delivery.status !== "PENDING"}
          className={`flex flex-1 items-center justify-center gap-2 rounded-[16px] py-2.5 text-sm font-bold transition ${
            delivery.status !== "PENDING"
              ? "cursor-not-allowed bg-[#E7DED1] text-[#B89970]"
              : "bg-[#C0392B] text-white hover:bg-[#A53024]"
          }`}
        >
          <XCircle size={18} />
          Failed
        </button>
      </div>

      {delivery.status === "PENDING" && (
        <div className="mt-2 flex items-center gap-2 text-sm text-[#C86A2B]">
          <Clock size={14} />
          <span>Awaiting action</span>
        </div>
      )}
    </div>
  );
};

export default DeliveryCard;
