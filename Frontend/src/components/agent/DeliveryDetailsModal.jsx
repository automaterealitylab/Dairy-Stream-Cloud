import React, { useEffect, useRef, useState } from 'react';
import { X, Package, MapPin, Phone, User, CheckCircle, XCircle } from 'lucide-react';
import { startDelivery, updateAgentLocation } from '../../api/agent/location';
import { ensureSocketConnection } from '../../socket';

const formatQuantity = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1).replace(/\.0$/, "");
};

const getItemLabel = (item = {}) =>
  String(item?.product || item?.productName || item?.milkType || item?.milk_type || item?.itemName || "").trim() || "Item";

const getDeliveryMilkTypeLabel = (delivery = {}) => {
  const mergedDeliveries = Array.isArray(delivery?.mergedDeliveries) ? delivery.mergedDeliveries : [];
  if (mergedDeliveries.length > 1) {
    const uniqueLabels = [...new Set(mergedDeliveries.map((item) => getItemLabel(item)).filter(Boolean))];
    return uniqueLabels.length ? uniqueLabels.join(", ") : "-";
  }
  return getItemLabel(delivery);
};

const DeliveryDetailsModal = ({ delivery, onClose, onCompleteRequest, onMarkFailed }) => {
  const normalizedStatus = String(delivery?.status || '').toUpperCase();
  const actionStatus = normalizedStatus === "IN_TRANSIT" ? "OUT_FOR_DELIVERY" : normalizedStatus;
  const mergedDeliveries = Array.isArray(delivery?.mergedDeliveries) ? delivery.mergedDeliveries : [];
  const hasMergedItems = mergedDeliveries.length > 1;
  const resolvedAmountDue = Number(hasMergedItems ? delivery?.totalAmountDue : delivery?.amountDue || 0);
  const requiresPaymentCollection =
    Boolean(delivery?.requiresPaymentCollection) && ['PENDING', 'OUT_FOR_DELIVERY'].includes(actionStatus);
  const paymentCollectionMethod = String(delivery?.paymentCollectionMethod || '').toUpperCase();
  const amountDue = resolvedAmountDue;
  const isPending = ['PENDING', 'OUT_FOR_DELIVERY'].includes(actionStatus);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const [lastCoordinates, setLastCoordinates] = useState(null);
  const watchIdRef = useRef(null);
  const activeOrderIdRef = useRef(null);
  const customerPhone = String(
    delivery?.phoneNumber ||
      delivery?.phone_number ||
      delivery?.customerPhone ||
      delivery?.customer_phone ||
      delivery?.mobile ||
      ""
  ).trim();
  const dialNumber = customerPhone.replace(/[^\d+]/g, "");

  const emitOffline = (orderIdInput) => {
    const orderId = String(orderIdInput || '').trim();
    if (!orderId) return;
    const connectedSocket = ensureSocketConnection();
    connectedSocket.emit('agent:stopped', {
      orderId,
      isOnline: false,
      timestamp: Date.now(),
    });
    connectedSocket.emit('agent:leaveOrder', { orderId });
  };

  const stopTracking = ({ announceOffline = true } = {}) => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (announceOffline && activeOrderIdRef.current) {
      emitOffline(activeOrderIdRef.current);
    }

    activeOrderIdRef.current = null;
    setIsTracking(false);
  };

  const startTracking = async () => {
    const orderId = String(delivery?.id || '').trim();
    if (!orderId) return;

    if (!navigator.geolocation) {
      setTrackingError('Geolocation is not supported on this device.');
      return;
    }

    setTrackingError('');

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const connectedSocket = ensureSocketConnection();
    connectedSocket.emit('agent:joinOrder', { orderId });
    activeOrderIdRef.current = orderId;

    try {
      const currentPosition = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const lat = Number(currentPosition?.coords?.latitude);
      const lng = Number(currentPosition?.coords?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('Unable to read your current location.');
      }

      setLastCoordinates({ lat, lng });
      await startDelivery(delivery.id, lat, lng);

      connectedSocket.emit('agent:locationUpdate', {
        orderId,
        lat,
        lng,
        timestamp: Date.now(),
        isOnline: true,
      });

      setIsTracking(true);

      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const nextLat = Number(position?.coords?.latitude);
          const nextLng = Number(position?.coords?.longitude);
          if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;

          setLastCoordinates({ lat: nextLat, lng: nextLng });

          updateAgentLocation(delivery.id, nextLat, nextLng).catch((err) => {
            console.error('Failed to update agent location via API:', err);
          });

          ensureSocketConnection().emit('agent:locationUpdate', {
            orderId,
            lat: nextLat,
            lng: nextLng,
            timestamp: Date.now(),
            isOnline: true,
          });
        },
        (error) => {
          const message = error?.message || 'Location access failed. Please enable location.';
          setTrackingError(message);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }
      );
    } catch (error) {
      setTrackingError(error?.message || 'Unable to start live location sharing.');
      stopTracking({ announceOffline: false });
      ensureSocketConnection().emit('agent:leaveOrder', { orderId });
    }
  };

  useEffect(() => {
    return () => {
      stopTracking({ announceOffline: true });
    };
  }, []);

  useEffect(() => {
    if (actionStatus === 'COMPLETED' || actionStatus === 'FAILED') {
      stopTracking({ announceOffline: true });
    }
  }, [actionStatus]);

  const statusTone =
    actionStatus === "COMPLETED"
      ? "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]"
      : actionStatus === "FAILED"
      ? "border-[#F2D0C8] bg-[#FDECEA] text-[#C0392B]"
      : "border-[#F0D1B2] bg-[#FFF1E4] text-[#B8641A]";

  if (!delivery) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[24px] border border-[#E7DAC6] bg-[#FFFDF7] ring-1 ring-white/40 shadow-[0_22px_50px_rgba(44,26,14,0.3)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E7DAC6] bg-[#FFF8EF] px-4 py-3">
          <h3 className="text-lg font-black text-[#2C1A0E]">Delivery Details</h3>
          <button
            onClick={onClose}
            className="rounded-full border border-[#E7DAC6] bg-white p-1.5 text-[#8B7355] transition hover:bg-[#FBF7F0]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3 p-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between rounded-[14px] border border-[#E7DAC6] bg-white px-3 py-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A88763]">Status</span>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusTone}`}>
              {actionStatus}
            </span>
          </div>

          {/* Delivery Info */}
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5 rounded-[14px] border border-[#EDE8DF] bg-white px-3 py-2.5">
              <Package className="mt-0.5 text-[#B8641A]" size={18} />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A88763]">Delivery Type</p>
                <p className="mt-1 text-sm font-bold text-[#2C1A0E]">{delivery.deliveryType || 'REGULAR'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-[14px] border border-[#EDE8DF] bg-white px-3 py-2.5">
              <Package className="mt-0.5 text-[#B8641A]" size={18} />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A88763]">Payment</p>
                {requiresPaymentCollection ? (
                  <>
                    <p className="mt-1 text-sm font-bold text-[#B8641A]">Collection Required</p>
                    <p className="mt-0.5 text-sm text-[#6B5B3E]">
                      Collect {amountDue > 0 ? `Rs ${amountDue.toFixed(2)}` : 'due amount'} via Cash or Online while completing delivery.
                    </p>
                  </>
                ) : paymentCollectionMethod ? (
                  <p className="mt-1 text-sm font-bold text-[#4A7C2F]">Collected via {paymentCollectionMethod}</p>
                ) : (
                  <p className="mt-1 text-sm font-bold text-[#2C1A0E]">No collection required</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 rounded-[14px] border border-[#EDE8DF] bg-white px-3 py-2.5">
                <Package className="mt-0.5 text-[#B8641A]" size={18} />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A88763]">Quantity</p>
                  <p className="mt-1 text-sm font-bold text-[#2C1A0E]">
                    {hasMergedItems ? `${mergedDeliveries.length} items` : delivery.quantity}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-[14px] border border-[#EDE8DF] bg-white px-3 py-2.5">
                <Package className="mt-0.5 text-[#B8641A]" size={18} />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A88763]">Milk Type</p>
                  <p className="mt-1 text-sm font-bold text-[#2C1A0E]">{getDeliveryMilkTypeLabel(delivery)}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-[14px] border border-[#EDE8DF] bg-white px-3 py-2.5">
                <User className="mt-0.5 text-[#B8641A]" size={18} />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A88763]">Customer Name</p>
                  <p className="mt-1 text-sm font-bold text-[#2C1A0E]">{delivery.customerName}</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-[14px] border border-[#EDE8DF] bg-white px-3 py-2.5">
              <Phone className="mt-0.5 text-[#B8641A]" size={18} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A88763]">Phone Number</p>
                <p className="mt-1 text-sm font-bold text-[#2C1A0E]">{customerPhone || "-"}</p>
              </div>
              {dialNumber ? (
                <a
                  href={`tel:${dialNumber}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[#DDE8D1] bg-[#EEF5E7] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#4A7C2F] transition hover:bg-[#E6F2DB]"
                >
                  <Phone size={12} />
                  Call
                </a>
              ) : null}
            </div>

            <div className="flex items-start gap-2.5 rounded-[14px] border border-[#EDE8DF] bg-white px-3 py-2.5">
              <MapPin className="mt-0.5 text-[#B8641A]" size={18} />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A88763]">Delivery Address</p>
                <p className="mt-1 text-sm font-bold text-[#2C1A0E]">{delivery.address}</p>
              </div>
            </div>

            {hasMergedItems ? (
              <div className="rounded-[14px] border border-[#EDE8DF] bg-white px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A88763]">Customer Items</p>
                <div className="mt-1.5 space-y-1.5">
                  {mergedDeliveries.map((item) => {
                    const itemStatus = String(item?.status || "PENDING").toUpperCase();
                    return (
                      <div key={item.id} className="flex items-start justify-between gap-2 rounded-[12px] border border-[#F0E6D8] bg-[#FFFCF7] px-2.5 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#2C1A0E]">{getItemLabel(item)}</p>
                          <p className="text-xs font-semibold text-[#6B5B3E]">
                            Quantity: {formatQuantity(item?.quantity)} {String(getItemLabel(item)).toLowerCase().includes("milk") ? "L" : "unit(s)"}
                          </p>
                        </div>
                        <span className="rounded-full border border-[#E7DAC6] bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#8B7355]">
                          {itemStatus}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {delivery.status === 'FAILED' && delivery.failedReason && (
            <div className="rounded-[14px] border border-[#F2D0C8] bg-[#FDECEA] p-3">
              <p className="mb-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#C0392B]">Failed Reason</p>
              <p className="text-sm text-[#A33A2B]">{delivery.failedReason}</p>
              {delivery.failedImage && (
                <img
                  src={delivery.failedImage}
                  alt="Failed delivery"
                  className="mt-3 max-h-48 w-full rounded-[12px] object-cover"
                />
              )}
            </div>
          )}

          {delivery.status === 'COMPLETED' && delivery.deliveryProofType && (
            <div className="rounded-[14px] border border-[#DDE8D1] bg-[#EEF5E7] p-3">
              <p className="mb-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#4A7C2F]">Delivery Proof</p>
              <p className="text-sm font-semibold text-[#4A7C2F]">{delivery.deliveryProofType}</p>
              {delivery.deliveryProofValue && (
                <p className="mt-1 text-xs text-[#4A7C2F]">{delivery.deliveryProofValue}</p>
              )}
              {delivery.deliveryProofImage && (
                <img
                  src={delivery.deliveryProofImage}
                  alt="Delivery proof"
                  className="mt-3 max-h-48 w-full rounded-[12px] object-cover"
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="space-y-2.5 border-t border-[#E7DAC6] bg-[#FFF8EF] px-4 py-3">
          {isPending && (onCompleteRequest || onMarkFailed) && (
            <div className="flex gap-2">
              {onCompleteRequest && (
                <button
                  onClick={() => onCompleteRequest(delivery)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#4A7C2F] py-2.5 text-sm font-bold text-white transition hover:bg-[#3D6826]"
                >
                  <CheckCircle size={18} />
                  {requiresPaymentCollection ? 'Collect & Complete' : 'Mark Delivered'}
                </button>
              )}
              {onMarkFailed && (
                <button
                  onClick={() => onMarkFailed(delivery)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#C0392B] py-2.5 text-sm font-bold text-white transition hover:bg-[#A53024]"
                >
                  <XCircle size={18} />
                  Mark Failed
                </button>
              )}
            </div>
          )}
          <button
            onClick={onClose}
            className="w-full rounded-[12px] border border-[#E7DAC6] bg-white py-2.5 text-sm font-bold text-[#8B7355] transition hover:bg-[#FBF7F0]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliveryDetailsModal;
