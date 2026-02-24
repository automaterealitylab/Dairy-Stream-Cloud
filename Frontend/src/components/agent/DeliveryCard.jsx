import React, { useState } from 'react';
import { CheckCircle, XCircle, Clock, RotateCcw } from 'lucide-react';

const DeliveryCard = ({ delivery, onStatusChange, onClick }) => {
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

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
    if (delivery.status !== 'COMPLETED') {
      onStatusChange(delivery.id, 'COMPLETED');
    }
  };

  const handleFailed = () => {
    onStatusChange(delivery.id, 'FAILED');
  };

  const handleRevert = () => {
    if (delivery.status === 'FAILED') {
      setShowRevertConfirm(true);
    }
  };

  const confirmRevert = () => {
    onStatusChange(delivery.id, 'COMPLETED');
    setShowRevertConfirm(false);
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
            <p className="text-sm text-gray-600 mt-1">
              Quantity: <span className="font-medium">{delivery.quantity}</span>
            </p>
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
            disabled={delivery.status === 'COMPLETED'}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors ${
              delivery.status === 'COMPLETED'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            <CheckCircle size={18} />
            Complete
          </button>

          <button
            onClick={handleFailed}
            disabled={delivery.status === 'COMPLETED'}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors ${
              delivery.status === 'COMPLETED'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            <XCircle size={18} />
            Failed
          </button>

          {delivery.status === 'FAILED' && (
            <button
              onClick={handleRevert}
              className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              title="Revert to Completed"
            >
              <RotateCcw size={18} />
            </button>
          )}
        </div>

        {delivery.status === 'PENDING' && (
          <div className="flex items-center gap-2 mt-2 text-yellow-600 text-sm">
            <Clock size={14} />
            <span>Awaiting action</span>
          </div>
        )}
      </div>

      {/* Revert Confirmation */}
      {showRevertConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Confirm Change</h3>
            <p className="text-gray-600 mb-4">
              Change this delivery from Failed to Completed?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRevertConfirm(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRevert}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DeliveryCard;
