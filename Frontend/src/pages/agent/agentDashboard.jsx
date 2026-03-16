import React, { useEffect, useState } from 'react';
import AgentLayout from "../../components/agent/AgentLayout";
import DeliveryCard from '../../components/agent/DeliveryCard';
import DeliveryDetailsModal from '../../components/agent/DeliveryDetailsModal';
import FailedReasonModal from '../../components/agent/FailedReasonModal';
import DeliveryProofModal from '../../components/agent/DeliveryProofModal';
import { Package, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import {
  fetchAssignedAgentDeliveries,
  updateAssignedAgentDeliveryStatus,
} from "../../api/agent/agent.api";
import { optimizeRouteWithPriority } from '../../utils/routeOptimization';

const EMPTY_STATS = {
  totalAssigned: 0,
  completed: 0,
  pending: 0,
  failed: 0,
  date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
};

const buildStatsFromDeliveries = (items = []) => ({
  totalAssigned: items.length,
  completed: items.filter((d) => d.status === "COMPLETED").length,
  pending: items.filter((d) => d.status === "PENDING").length,
  failed: items.filter((d) => d.status === "FAILED").length,
  date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
});

const AgentDashboard = () => {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [deliveries, setDeliveries] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [failedDelivery, setFailedDelivery] = useState(null);
  const [proofDelivery, setProofDelivery] = useState(null);
  const [bulkCompletingSubscriptions, setBulkCompletingSubscriptions] = useState(false);
  const [bulkCompleteError, setBulkCompleteError] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const assigned = await fetchAssignedAgentDeliveries();
        const resolved = assigned || [];
        setDeliveries(resolved);
        setStats(buildStatsFromDeliveries(resolved));
      } catch (_err) {
        setStats(EMPTY_STATS);
        setDeliveries([]);
      }
    };

    loadDashboard();
  }, []);

  const filteredDeliveries = deliveries.filter((delivery) => {
    if (filter === 'ALL') return true;
    return delivery.status === filter;
  });

  const orderedDeliveries = optimizeRouteWithPriority(filteredDeliveries, ['PENDING', 'COMPLETED', 'FAILED']);
  const pendingSubscriptionDeliveries = deliveries.filter(
    (delivery) =>
      delivery.status === 'PENDING' &&
      String(delivery.deliveryType || '').toUpperCase() === 'SUBSCRIPTION'
  );

  const handleCompleteWithProof = (delivery) => {
    setProofDelivery(delivery);
  };

  const handleCompleteAllSubscriptions = async () => {
    if (!pendingSubscriptionDeliveries.length || bulkCompletingSubscriptions) return;

    const targetIds = new Set(pendingSubscriptionDeliveries.map((delivery) => String(delivery.id)));
    setBulkCompletingSubscriptions(true);
    setBulkCompleteError('');

    setDeliveries((prev) => {
      const next = prev.map((delivery) =>
        targetIds.has(String(delivery.id))
          ? {
              ...delivery,
              status: 'COMPLETED',
              deliveryProofType: null,
              deliveryProofOtp: null,
              deliveryProofImage: null,
            }
          : delivery
      );
      setStats(buildStatsFromDeliveries(next));
      return next;
    });

    const failedIds = [];

    for (const delivery of pendingSubscriptionDeliveries) {
      try {
        await updateAssignedAgentDeliveryStatus({
          deliveryId: delivery.id,
          status: 'COMPLETED',
        });
      } catch (_err) {
        failedIds.push(String(delivery.id));
      }
    }

    if (failedIds.length) {
      const failedSet = new Set(failedIds);
      setDeliveries((prev) => {
        const next = prev.map((delivery) =>
          failedSet.has(String(delivery.id)) ? { ...delivery, status: 'PENDING' } : delivery
        );
        setStats(buildStatsFromDeliveries(next));
        return next;
      });
      setBulkCompleteError(`Failed to complete ${failedIds.length} subscription deliver${failedIds.length === 1 ? 'y' : 'ies'}.`);
    }

    setBulkCompletingSubscriptions(false);
  };

  const handleProofSubmit = async ({ proofType, proofOtp, imagePreview, collectionMethod }) => {
    if (!proofDelivery?.id) return;
    const deliveryId = proofDelivery.id;
    const normalizedProofType = String(proofType || '').trim().toUpperCase();

    const proofNote = normalizedProofType === 'OTP'
      ? `OTP_CONFIRMED:${proofOtp}`
      : normalizedProofType === 'PHOTO'
      ? 'PHOTO_ATTACHED'
      : '';

    setDeliveries((prev) => {
      const next = prev.map((d) =>
        String(d.id) === String(deliveryId)
          ? {
              ...d,
              status: 'COMPLETED',
              deliveryProofType: normalizedProofType || null,
              deliveryProofOtp: normalizedProofType === 'OTP' ? proofOtp : null,
              deliveryProofImage: normalizedProofType === 'PHOTO' ? imagePreview : null,
              paymentCollectionMethod: collectionMethod || null,
            }
          : d
      );
      setStats(buildStatsFromDeliveries(next));
      return next;
    });

    setProofDelivery(null);

    try {
      await updateAssignedAgentDeliveryStatus({
        deliveryId,
        status: 'COMPLETED',
        proofType: normalizedProofType,
        proofOtp,
        proofImage: normalizedProofType === 'PHOTO' ? imagePreview : '',
        collectionMethod,
        reason: proofNote,
      });
    } catch (_err) {
      // Keep local state update for now to avoid blocking operator flow.
    }
  };

  const handleStatusChange = async (deliveryId, newStatus) => {
    if (newStatus === 'FAILED') {
      const delivery = deliveries.find((d) => String(d.id) === String(deliveryId));
      setFailedDelivery(delivery);
    } else {
      setDeliveries((prev) => {
        const next = prev.map((d) =>
          String(d.id) === String(deliveryId) ? { ...d, status: newStatus } : d
        );
        setStats(buildStatsFromDeliveries(next));
        return next;
      });
      try {
        await updateAssignedAgentDeliveryStatus({
          deliveryId,
          status: newStatus,
        });
      } catch (_err) {
        // Keep local state update for now to avoid blocking operator flow.
      }
    }
  };

  const handleFailedSubmit = async ({ reason, imagePreview }) => {
    if (!failedDelivery?.id) return;
    const deliveryId = failedDelivery.id;

    setDeliveries((prev) => {
      const next = prev.map((d) =>
        String(d.id) === String(deliveryId)
          ? { ...d, status: 'FAILED', failedReason: reason, failedImage: imagePreview }
          : d
      );
      setStats(buildStatsFromDeliveries(next));
      return next;
    });
    setFailedDelivery(null);
    try {
      await updateAssignedAgentDeliveryStatus({
        deliveryId,
        status: "FAILED",
        reason,
      });
    } catch (_err) {
      // Keep local state update for now to avoid blocking operator flow.
    }
  };

  const completionPercentage = stats.totalAssigned > 0 
    ? ((stats.completed / stats.totalAssigned) * 100).toFixed(1)
    : 0;

  const deliveryStats = {
    all: deliveries.length,
    completed: deliveries.filter(d => d.status === 'COMPLETED').length,
    pending: deliveries.filter(d => d.status === 'PENDING').length,
    failed: deliveries.filter(d => d.status === 'FAILED').length,
  };

  return (
    <AgentLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
          <p className="text-gray-600">{stats.date}</p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Assigned */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Total Assigned</h3>
              <Package className="opacity-80" size={24} />
            </div>
            <p className="text-4xl font-bold">{stats.totalAssigned}</p>
            <p className="text-xs opacity-80 mt-2">Deliveries for today</p>
          </div>

          {/* Completed */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Completed</h3>
              <CheckCircle className="opacity-80" size={24} />
            </div>
            <p className="text-4xl font-bold">{stats.completed}</p>
            <p className="text-xs opacity-80 mt-2">Successfully delivered</p>
          </div>

          {/* Pending */}
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Pending</h3>
              <Clock className="opacity-80" size={24} />
            </div>
            <p className="text-4xl font-bold">{stats.pending}</p>
            <p className="text-xs opacity-80 mt-2">Awaiting delivery</p>
          </div>

          {/* Failed */}
          <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Failed</h3>
              <XCircle className="opacity-80" size={24} />
            </div>
            <p className="text-4xl font-bold">{stats.failed}</p>
            <p className="text-xs opacity-80 mt-2">Delivery failed</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-600">Today's Progress</h3>
            <span className="text-2xl font-bold text-blue-600">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {stats.completed} out of {stats.totalAssigned} deliveries completed
          </p>
        </div>

        {/* Quick Stats */}
        {/* 
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.totalAssigned > 0 
                    ? ((stats.completed / (stats.completed + stats.failed)) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ 
                  width: `${stats.totalAssigned > 0 
                    ? (stats.completed / (stats.completed + stats.failed)) * 100 
                    : 0}%` 
                }}
              />
            </div>
          </div>

         
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Remaining</p>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.pending + stats.failed}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              {stats.pending} pending + {stats.failed} failed
            </p>
          </div>

          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.pending > 0 ? 'In Progress' : 'Completed'}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              {stats.pending > 0 
                ? `${stats.pending} deliveries remaining`
                : 'All deliveries processed'}
            </p>
          </div>
        </div> */}

        {/* Assigned Deliveries */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">Assigned Deliveries</h3>
              <p className="text-gray-600">Manage your deliveries</p>
              <p className="text-xs text-blue-600 mt-1">Route sorted by status and building proximity</p>
            </div>
            {pendingSubscriptionDeliveries.length > 0 && (
              <button
                onClick={handleCompleteAllSubscriptions}
                disabled={bulkCompletingSubscriptions}
                className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {bulkCompletingSubscriptions
                  ? 'Completing...'
                  : `Complete All Subscription (${pendingSubscriptionDeliveries.length})`}
              </button>
            )}
          </div>

          {bulkCompleteError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {bulkCompleteError}
            </div>
          )}

          <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-200 flex flex-wrap gap-2">
            {[
              // { key: 'ALL', label: 'All', count: deliveryStats.all },
              // { key: 'PENDING', label: 'Pending', count: deliveryStats.pending },
              // { key: 'COMPLETED', label: 'Completed', count: deliveryStats.completed },
              // { key: 'FAILED', label: 'Failed', count: deliveryStats.failed },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === tab.key
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  filter === tab.key
                    ? 'bg-white text-blue-500'
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orderedDeliveries.length === 0 ? (
              <div className="col-span-full bg-white rounded-xl p-12 text-center border border-gray-200">
                <Filter className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600">No deliveries found</p>
              </div>
            ) : (
              orderedDeliveries.map(delivery => (
                <DeliveryCard
                  key={delivery.id}
                  delivery={delivery}
                  onStatusChange={handleStatusChange}
                  onClick={setSelectedDelivery}
                  onCompleteRequest={handleCompleteWithProof}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {selectedDelivery && (
        <DeliveryDetailsModal
          delivery={selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
        />
      )}

      {failedDelivery && (
        <FailedReasonModal
          delivery={failedDelivery}
          onSubmit={handleFailedSubmit}
          onClose={() => setFailedDelivery(null)}
        />
      )}

      {proofDelivery && (
        <DeliveryProofModal
          delivery={proofDelivery}
          onClose={() => setProofDelivery(null)}
          onSubmit={handleProofSubmit}
        />
      )}
    </AgentLayout>
  );
};

export default AgentDashboard;
