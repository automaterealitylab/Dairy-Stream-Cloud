import React, { useEffect, useRef, useState } from 'react';
import { Camera, CreditCard, IndianRupee, ShieldCheck, Upload, X, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';

const OTP_REGEX = /^\d{4,8}$/;

const DeliveryProofModal = ({ delivery, onClose, onSubmit }) => {
  const [proofType, setProofType] = useState('QR');
  const [otp, setOtp] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [collectionMethod, setCollectionMethod] = useState('');
  const [onlinePaid, setOnlinePaid] = useState(false);
  const [onlineError, setOnlineError] = useState('');
  const [showQrPopup, setShowQrPopup] = useState(false);

  const [qrError, setQrError] = useState('');
  const [qrSuccess, setQrSuccess] = useState(false);
  const [scannedName, setScannedName] = useState('');

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  const isSubscriptionDelivery = String(delivery?.deliveryType || '').toUpperCase() === 'SUBSCRIPTION';
  const requiresPaymentCollection = Boolean(delivery?.requiresPaymentCollection);
  const amountDue = Number(delivery?.amountDue || 0);
  const upiId = String(delivery?.upiId || '').trim();
  const payeeName = String(delivery?.dairyFarmName || 'Dairy Stream').trim();
  const upiIntentLink =
    upiId && amountDue > 0
      ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amountDue.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Delivery ${delivery?.id || ''}`.trim())}`
      : '';

  useEffect(() => {
    setProofType(isSubscriptionDelivery ? '' : 'QR');
    setOtp('');
    setImage(null);
    setImagePreview(null);
    setCollectionMethod('');
    setOnlinePaid(false);
    setOnlineError('');
    setShowQrPopup(false);
    setQrSuccess(false);
    setQrError('');
    setScannedName('');
  }, [delivery?.id, isSubscriptionDelivery]);

  const cleanupScanner = () => {
    if (html5QrCodeRef.current) {
      const scanner = html5QrCodeRef.current;
      html5QrCodeRef.current = null;
      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    }
  };

  const handleQrScanSuccess = (decodedText) => {
    try {
      const data = JSON.parse(decodedText);
      const expectedId = String(delivery?.customerId || '');
      const scannedId = String(data?.customerId || data?.id || '');

      if (!scannedId) {
        setQrError("Invalid QR Code content.");
        return;
      }

      if (scannedId === expectedId) {
        setQrSuccess(true);
        setScannedName(data?.name || "Customer");
        setQrError('');
        cleanupScanner();
      } else {
        setQrError(`Mismatch: Customer ID #${scannedId} does not match delivery.`);
      }
    } catch (err) {
      setQrError("Unable to parse QR code data.");
    }
  };

  useEffect(() => {
    if (proofType !== 'QR' || qrSuccess) {
      cleanupScanner();
      return;
    }

    setQrError('');
    let isMounted = true;

    const timer = setTimeout(() => {
      if (!isMounted) return;

      try {
        const html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCodeRef.current = html5QrCode;

        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 200, height: 200 }
          },
          (decodedText) => {
            handleQrScanSuccess(decodedText);
          },
          (errorMessage) => {
            // Frame search error, safe to ignore
          }
        ).catch((err) => {
          if (isMounted) {
            setQrError("Camera access denied or camera not found.");
          }
        });
      } catch (err) {
        if (isMounted) {
          setQrError("Failed to start scanner.");
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      cleanupScanner();
    };
  }, [proofType, qrSuccess]);

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

  const isQrValid = isSubscriptionDelivery ? true : proofType === 'QR' ? qrSuccess : true;
  const isPhotoValid = isSubscriptionDelivery ? true : proofType === 'PHOTO' ? Boolean(image) : true;
  const isOtpValid = isSubscriptionDelivery ? true : proofType === 'OTP' ? OTP_REGEX.test(String(otp || '').trim()) : true;
  const canUseOnlineCollection = Boolean(upiIntentLink);
  const isCollectionValid = requiresPaymentCollection
    ? collectionMethod === 'CASH' || (collectionMethod === 'ONLINE' && onlinePaid && canUseOnlineCollection)
    : true;
  const isValid = isQrValid && isPhotoValid && isOtpValid && isCollectionValid;

  const handleOpenOnlineCheckout = async () => {
    if (!delivery?.id) return;
    if (!canUseOnlineCollection) {
      setCollectionMethod('');
      setOnlinePaid(false);
      setOnlineError('UPI ID or amount due is missing for this delivery.');
      return;
    }
    setCollectionMethod('ONLINE');
    setOnlineError('');
    setOnlinePaid(false);
    setShowQrPopup(true);
  };

  const handleSubmit = () => {
    if (!isValid) return;

    onSubmit({
      proofType,
      proofOtp: !isSubscriptionDelivery && proofType === 'OTP' ? String(otp).trim() : '',
      image: isSubscriptionDelivery ? null : (proofType === 'PHOTO' ? image : null),
      imagePreview: isSubscriptionDelivery ? null : (proofType === 'PHOTO' ? imagePreview : null),
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
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setProofType('QR')}
                  className={`px-2 py-2 rounded-lg text-xs font-bold border transition-all ${
                    proofType === 'QR' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  QR Scanner
                </button>
                <button
                  type="button"
                  onClick={() => setProofType('PHOTO')}
                  className={`px-2 py-2 rounded-lg text-xs font-bold border transition-all ${
                    proofType === 'PHOTO' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Photo Upload
                </button>
                <button
                  type="button"
                  onClick={() => setProofType('OTP')}
                  className={`px-2 py-2 rounded-lg text-xs font-bold border transition-all ${
                    proofType === 'OTP' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  OTP Confirm
                </button>
              </div>

              {proofType === 'QR' && (
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-black aspect-square w-full max-w-[280px] mx-auto">
                    <div id="qr-reader" className="w-full h-full"></div>
                    {qrError && (
                      <div className="absolute inset-x-0 bottom-0 bg-red-600/90 px-3 py-2 text-[11px] font-semibold text-white text-center backdrop-blur-sm">
                        {qrError}
                      </div>
                    )}
                    {qrSuccess && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-600/90 px-4 py-3 text-center text-white backdrop-blur-sm animate-in fade-in">
                        <span className="text-sm font-bold">✓ QR Verified</span>
                        <span className="mt-1 text-xs text-white/90">Customer: {scannedName}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-center text-xs font-medium text-gray-500">
                    {!qrSuccess ? "Point camera at customer's personal drop QR code" : "Verification complete. Press confirm to complete delivery."}
                  </p>
                </div>
              )}

              {proofType === 'PHOTO' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-lg p-3 hover:bg-gray-50"
                    >
                      <Camera size={18} />
                      Camera
                    </button>
                    <button
                      type="button"
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
              )}

              {proofType === 'OTP' && (
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

              {!canUseOnlineCollection && <p className="text-xs text-amber-700">UPI ID or amount due is missing for this delivery.</p>}

              {collectionMethod === 'ONLINE' && (
                <div className="rounded-lg bg-white border border-blue-200 p-4 text-center">
                  {onlineError ? <p className="text-xs text-red-600">{onlineError}</p> : null}
                  {canUseOnlineCollection ? (
                    <>
                      <p className="text-xs font-semibold text-blue-900">Use popup QR to collect payment</p>
                      <p className="mt-1 text-[11px] text-blue-700">UPI: {upiId}</p>
                      <p className="text-[11px] text-blue-700">Amount: Rs {amountDue.toFixed(2)}</p>
                      <button
                        type="button"
                        onClick={() => setShowQrPopup(true)}
                        className="mt-3 w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                      >
                        Show QR Code
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowQrPopup(true)}
                        className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium ${
                          onlinePaid ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {onlinePaid ? 'Payment Marked Received' : 'Waiting for Payment Confirmation'}
                      </button>
                    </>
                  ) : null}
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

      {showQrPopup && canUseOnlineCollection && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowQrPopup(false)}>
          <div
            className="w-full max-w-xs rounded-xl border border-blue-200 bg-white p-4 text-center shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-blue-900">Scan and Pay</p>
              <button
                type="button"
                onClick={() => setShowQrPopup(false)}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[11px] text-blue-700">UPI: {upiId}</p>
            <p className="text-[11px] text-blue-700">Amount: Rs {amountDue.toFixed(2)}</p>
            <div className="mt-3 flex justify-center">
              <div className="rounded-lg border border-blue-100 bg-white p-2">
                <QRCodeSVG value={upiIntentLink} size={190} includeMargin />
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOnlinePaid(true);
                setShowQrPopup(false);
              }}
              className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium ${
                onlinePaid ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {onlinePaid ? 'Payment Marked Received' : 'Mark Payment Received'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryProofModal;
