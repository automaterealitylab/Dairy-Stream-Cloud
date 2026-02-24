import React from 'react';
import { X, Package, MapPin, Phone, User, Building2 } from 'lucide-react';

const DeliveryDetailsModal = ({ delivery, onClose }) => {
  if (!delivery) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">Delivery Details</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Status</span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                delivery.status === 'COMPLETED'
                  ? 'bg-green-100 text-green-700'
                  : delivery.status === 'FAILED'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {delivery.status}
            </span>
          </div>

          {/* Delivery Info */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Package className="text-blue-600 mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-600">Quantity</p>
                <p className="font-semibold text-gray-800">{delivery.quantity}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="text-blue-600 mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-600">Customer Name</p>
                <p className="font-semibold text-gray-800">{delivery.customerName}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="text-blue-600 mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-600">Phone Number</p>
                <p className="font-semibold text-gray-800">{delivery.phoneNumber}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="text-blue-600 mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-600">Delivery Address</p>
                <p className="font-semibold text-gray-800">{delivery.address}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building2 className="text-blue-600 mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-600">Dairy Farm</p>
                <p className="font-semibold text-gray-800">
                  {delivery.dairyFarmName} (ID: {delivery.dairyFarmId})
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Farm Phone: {delivery.farmPhoneNumber}
                </p>
              </div>
            </div>
          </div>

          {/* Failed Reason (if applicable) */}
          {delivery.status === 'FAILED' && delivery.failedReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800 mb-1">Failed Reason:</p>
              <p className="text-sm text-red-700">{delivery.failedReason}</p>
              {delivery.failedImage && (
                <img
                  src={delivery.failedImage}
                  alt="Failed delivery"
                  className="mt-3 rounded-lg max-h-48 w-full object-cover"
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4">
          <button
            onClick={onClose}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliveryDetailsModal;
