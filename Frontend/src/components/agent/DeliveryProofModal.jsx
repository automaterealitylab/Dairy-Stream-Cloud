import React, { useEffect, useRef, useState } from 'react';
import { Camera, CreditCard, IndianRupee, ShieldCheck, Upload, X } from 'lucide-react';
import {
  createAssignedDeliveryOnlineOrder,
  verifyAssignedDeliveryOnlinePayment,
} from '../../api/agent/agent.api';

const OTP_REGEX = /^\d{4,8}$/;

const DeliveryProofModal = ({ delivery, onClose, onSubmit }) => {
  const [proofType, setProofType] = useState('PHOTO');
  const [otp, setOtp] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [collectionMethod, setCollectionMethod] = useState('');
  const [onlinePaid, setOnlinePaid] = useState(false);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState('');

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const isSubscriptionDelivery = String(delivery?.deliveryType || '').toUpperCase() === 'SUBSCRIPTION';
  const isBuyOnceDelivery = String(delivery?.deliveryType || '').toUpperCase() === 'BUY ONCE';
  const requiresPaymentCollection = Boolean(delivery?.requiresPaymentCollection);
  const amountDue = Number(delivery?.amountDue || 0);

  useEffect(() => {
    setProofType(isSubscriptionDelivery ? '' : 'PHOTO');
    setOtp('');
    setImage(null);
    setImagePreview(null);
    setCollectionMethod('');
    setOnlinePaid(false);
    setOnlineLoading(false);
    setOnlineError('');
  }, [delivery?.id, isSubscriptionDelivery]);

  const loadRazorpayCheckoutScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleImagePick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const isPhotoValid = isSubscriptionDelivery ? true : proofType === 'PHOTO' ? Boolean(image) : true;
  const isOtpValid = isSubscriptionDelivery ? true : proofType === 'OTP' ? OTP_REGEX.test(String(otp || '').trim()) : true;
  const canUseOnlineCollection = isBuyOnceDelivery;
  const isCollectionValid = requiresPaymentCollection
    ? collectionMethod === 'CASH' || (collectionMethod === 'ONLINE' && onlinePaid && canUseOnlineCollection)
    : true;
  const isValid = isPhotoValid && isOtpValid && isCollectionValid;

  const handleOpenOnlineCheckout = async () => {
    if (!delivery?.id) return;
    if (!canUseOnlineCollection) {
      setCollectionMethod('');
      setOnlinePaid(false);
      setOnlineError('Online collection is available only for COD buy-once deliveries.');
      return;
    }

    try {
      setCollectionMethod('ONLINE');
      setOnlineError('');
      setOnlineLoading(true);

      const scriptLoaded = await loadRazorpayCheckoutScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load Razorpay checkout');
      }

      const orderPayload = await createAssignedDeliveryOnlineOrder(delivery.id);

      const options = {
        key: orderPayload.keyId,
        amount: orderPayload.order.amount,
        currency: orderPayload.order.currency,
        name: 'Dairy Stream',
        description: orderPayload.payment?.title || 'Delivery Payment',
        order_id: orderPayload.order.id,
        handler: async (response) => {
          await verifyAssignedDeliveryOnlinePayment({
            deliveryId: delivery.id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          setOnlinePaid(true);
          setOnlineError('');
        },
        method: {
          upi: true,
          card: false,
          netbanking: false,
          wallet: false,
          emi: false,
          paylater: false,
        },
        theme: {
          color: '#2563eb',
        },
        modal: {
          ondismiss: () => {
            setOnlineLoading(false);
          },
        },
      };

      const checkout = new window.Razorpay(options);
      checkout.on('payment.failed', (failedResponse) => {
        setOnlineError(failedResponse?.error?.description || 'Payment failed');
        setOnlinePaid(false);
      });
      checkout.open();
    } catch (err) {
      setOnlineError(err?.response?.data?.message || err?.message || 'Unable to start Razorpay payment');
      setOnlinePaid(false);
    } finally {
      setOnlineLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!isValid) return;

    onSubmit({
      proofType,
      proofOtp: !isSubscriptionDelivery && proofType === 'OTP' ? String(otp).trim() : '',
      image: isSubscriptionDelivery ? null : image,
      imagePreview: isSubscriptionDelivery ? null : imagePreview,
      collectionMethod: requiresPaymentCollection ? collectionMethod : '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Delivery Proof Required</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <p className="font-medium text-gray-800">{delivery?.customerName}</p>
            <p>{delivery?.address}</p>
            <p className="mt-1 text-xs text-blue-700 font-semibold">
              {delivery?.deliveryType || 'REGULAR'}
            </p>
          </div>

          {isSubscriptionDelivery ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              Subscription delivery does not require photo or OTP verification.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setProofType('PHOTO')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                    proofType === 'PHOTO' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  Photo Upload
                </button>
                <button
                  onClick={() => setProofType('OTP')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                    proofType === 'OTP' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  OTP Confirm
                </button>
              </div>

              {proofType === 'PHOTO' ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-lg p-3 hover:bg-gray-50"
                    >
                      <Camera size={18} />
                      Camera
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-lg p-3 hover:bg-gray-50"
                    >
                      <Upload size={18} />
                      Upload
                    </button>
                  </div>

                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleImagePick}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImagePick}
                  />

                  {imagePreview ? (
                    <img src={imagePreview} alt="Delivery proof" className="w-full max-h-48 object-cover rounded-lg" />
                  ) : (
                    <p className="text-xs text-red-600">Photo proof is mandatory for this option.</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Enter Customer OTP</label>
                  <div className="relative">
                    <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="4 to 8 digit OTP"
                      className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {!isOtpValid && <p className="text-xs text-red-600 mt-2">Enter a valid OTP (4-8 digits).</p>}
                </div>
              )}
            </>
          )}

          {requiresPaymentCollection && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">Collect Payment for COD Order</p>
                <p className="text-xs text-blue-700 mt-1">
                  Amount due: Rs {amountDue.toFixed(2)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setCollectionMethod('CASH');
                    setOnlinePaid(false);
                    setOnlineError('');
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                    collectionMethod === 'CASH'
                      ? 'border-green-500 bg-green-100 text-green-700'
                      : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  <IndianRupee size={16} />
                  Cash
                </button>
                <button
                  onClick={handleOpenOnlineCheckout}
                  disabled={!canUseOnlineCollection}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                    collectionMethod === 'ONLINE'
                      ? 'border-blue-500 bg-blue-100 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700'
                  } ${!canUseOnlineCollection ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <CreditCard size={16} />
                  Online
                </button>
              </div>

              {!canUseOnlineCollection && (
                <p className="text-xs text-amber-700">
                  Online collection is only supported for COD buy-once deliveries.
                </p>
              )}

              {collectionMethod === 'ONLINE' && (
                <div className="rounded-lg bg-white border border-blue-200 p-4 text-center">
                  {onlineLoading ? (
                    <p className="text-xs text-gray-600">Opening Razorpay checkout...</p>
                  ) : onlinePaid ? (
                    <p className="text-xs font-medium text-green-700">
                      Payment completed in Razorpay. You can now confirm delivery.
                    </p>
                  ) : onlineError ? (
                    <p className="text-xs text-red-600">{onlineError}</p>
                  ) : (
                    <p className="text-xs text-gray-600">
                      Click Online to open Razorpay popup with UPI payment options and QR.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium"
          >
            Confirm Delivery
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliveryProofModal;
