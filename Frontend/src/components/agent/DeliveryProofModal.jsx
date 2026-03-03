import React, { useRef, useState } from 'react';
import { Camera, Upload, ShieldCheck, X } from 'lucide-react';

const OTP_REGEX = /^\d{4,8}$/;

const DeliveryProofModal = ({ delivery, onClose, onSubmit }) => {
  const [proofType, setProofType] = useState('PHOTO');
  const [otp, setOtp] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

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

  const isPhotoValid = proofType === 'PHOTO' ? Boolean(image) : true;
  const isOtpValid = proofType === 'OTP' ? OTP_REGEX.test(String(otp || '').trim()) : true;
  const isValid = isPhotoValid && isOtpValid;

  const handleSubmit = () => {
    if (!isValid) return;

    onSubmit({
      proofType,
      proofOtp: proofType === 'OTP' ? String(otp).trim() : '',
      image,
      imagePreview,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
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
          </div>

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
