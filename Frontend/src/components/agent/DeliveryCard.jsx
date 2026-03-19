import React from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

const DeliveryCard = ({ delivery, onStatusChange, onClick, onCompleteRequest }) => {
  const getStatusColor = () => {
    switch (delivery.status) {
      case 'COMPLETED':
        return 'border-green-300 bg-green-50';
      case 'FAILED':
        return 'border-red-300 bg-red-50';
      default:
        return 'border-yellow-300 bg-yellow-50';
    }
  };

  const handleComplete = () => {
    if (delivery.status === 'PENDING') {
      if (typeof onCompleteRequest === 'function') {
        onCompleteRequest(delivery);
        return;
      }
      onStatusChange(delivery.id, 'COMPLETED');
    }
  };

  const handleFailed = () => {
    if (delivery.status === 'PENDING') {
      onStatusChange(delivery.id, 'FAILED');
    }
  };

  return (
    <>
      <div
        className={`border-2 rounded-xl p-4 transition-all hover:shadow-md ${getStatusColor()}`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 cursor-pointer" onClick={() => onClick(delivery)}>
            <h4 className="font-semibold text-gray-800">{delivery.customerName}</h4>
            <p className="text-sm text-gray-600">{delivery.address}</p>
            <p className="text-xs font-semibold text-blue-700 mt-1">
              Type: {delivery.deliveryType || 'REGULAR'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Quantity: <span className="font-medium">{delivery.quantity}</span>
            </p>
            {delivery.buildingName && (
              <p className="text-xs text-blue-700 mt-1">
                Route Group: {delivery.buildingName}
                {delivery.buildingSequence ? ` • Stop ${delivery.buildingSequence}` : ''}
              </p>
            )}
          </div>

          {/* Status Badge */}
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              delivery.status === 'COMPLETED'
                ? 'bg-green-500 text-white'
                : delivery.status === 'FAILED'
                ? 'bg-red-500 text-white'
                : 'bg-yellow-500 text-white'
            }`}
          >
            {delivery.status}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleComplete}
            disabled={delivery.status !== 'PENDING'}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors ${
              delivery.status !== 'PENDING'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            <CheckCircle size={18} />
            Complete
          </button>

          <button
            onClick={handleFailed}
            disabled={delivery.status !== 'PENDING'}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors ${
              delivery.status !== 'PENDING'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            <XCircle size={18} />
            Failed
          </button>

        </div>

        {delivery.status === 'PENDING' && (
          <div className="flex items-center gap-2 mt-2 text-yellow-600 text-sm">
            <Clock size={14} />
            <span>Awaiting action</span>
          </div>
        )}
      </div>

    </>
  );
};

export default DeliveryCard;
