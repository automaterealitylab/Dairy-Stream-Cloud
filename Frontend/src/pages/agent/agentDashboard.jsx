import React, { useEffect, useState } from 'react';
import AgentLayout from '../../components/agent/AgentLayout';
import DeliveryCard from '../../components/agent/DeliveryCard';
import DeliveryDetailsModal from '../../components/agent/DeliveryDetailsModal';
import FailedReasonModal from '../../components/agent/FailedReasonModal';
import { Package, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';

// Mock data - replace with API call
const MOCK_STATS = {
  totalAssigned: 45,
  completed: 28,
  pending: 12,
  failed: 5,
  date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
};

const MOCK_DELIVERIES = [
  {
    id: 'D1',
    customerName: 'Amit Patil',
    phoneNumber: '+91 98765 43210',
    address: 'Flat 102, Green Valley Society, Narhe',
    quantity: '1.0 L',
    status: 'PENDING',
    dairyFarmId: 'DF001',
    dairyFarmName: 'Sunrise Dairy',
    farmPhoneNumber: '+91 98765 11111',
  },
  {
    id: 'D2',
    customerName: 'Neha Kulkarni',
    phoneNumber: '+91 98765 43211',
    address: 'Flat 104, Green Valley Society, Narhe',
    quantity: '0.5 L',
    status: 'COMPLETED',
    dairyFarmId: 'DF001',
    dairyFarmName: 'Sunrise Dairy',
    farmPhoneNumber: '+91 98765 11111',
  },
  {
    id: 'D3',
    customerName: 'Rajesh Deshmukh',
    phoneNumber: '+91 98765 43212',
    address: 'Flat 201, Green Valley Society, Narhe',
    quantity: '2.0 L',
    status: 'PENDING',
    dairyFarmId: 'DF001',
    dairyFarmName: 'Sunrise Dairy',
    farmPhoneNumber: '+91 98765 11111',
  },
  {
    id: 'D4',
    customerName: 'Pooja Household',
    phoneNumber: '+91 98765 43213',
    address: 'Flat B-304, Sunshine Building, Ambegaon',
    quantity: '0.5 L',
    status: 'PENDING',
    dairyFarmId: 'DF002',
    dairyFarmName: 'Fresh Milk Co.',
    farmPhoneNumber: '+91 98765 22222',
  },
  {
    id: 'D5',
    customerName: 'Sanjay Kumar',
    phoneNumber: '+91 98765 43214',
    address: 'Flat B-305, Sunshine Building, Ambegaon',
    quantity: '1.0 L',
    status: 'FAILED',
    dairyFarmId: 'DF002',
    dairyFarmName: 'Fresh Milk Co.',
    farmPhoneNumber: '+91 98765 22222',
    failedReason: 'Customer not available',
  },
];

const AgentDashboard = () => {
  const [stats, setStats] = useState(MOCK_STATS);
  const [deliveries, setDeliveries] = useState(MOCK_DELIVERIES);
  const [filter, setFilter] = useState('ALL');
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [failedDelivery, setFailedDelivery] = useState(null);

  useEffect(() => {
    // TODO: Fetch dashboard stats from API
    // fetchAgentDashboardStats().then(setStats);
    // TODO: Fetch today's deliveries from API
    // fetchTodayDeliveries().then(setDeliveries);
  }, []);

  const filteredDeliveries = deliveries.filter(delivery => {
    if (filter === 'ALL') return true;
    return delivery.status === filter;
  });

  const handleStatusChange = (deliveryId, newStatus) => {
    if (newStatus === 'FAILED') {
      const delivery = deliveries.find(d => d.id === deliveryId);
      setFailedDelivery(delivery);
    } else {
      setDeliveries(prev =>
        prev.map(d =>
          d.id === deliveryId ? { ...d, status: newStatus } : d
        )
      );
      // TODO: Send API update
    }
  };

  const handleFailedSubmit = ({ reason, imagePreview }) => {
    setDeliveries(prev =>
      prev.map(d =>
        d.id === failedDelivery.id
          ? { ...d, status: 'FAILED', failedReason: reason, failedImage: imagePreview }
          : d
      )
    );
    setFailedDelivery(null);
    // TODO: Send API update with reason and image
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
            </div>
          </div>

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
            {filteredDeliveries.length === 0 ? (
              <div className="col-span-full bg-white rounded-xl p-12 text-center border border-gray-200">
                <Filter className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600">No deliveries found</p>
              </div>
            ) : (
              filteredDeliveries.map(delivery => (
                <DeliveryCard
                  key={delivery.id}
                  delivery={delivery}
                  onStatusChange={handleStatusChange}
                  onClick={setSelectedDelivery}
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
    </AgentLayout>
  );
};

export default AgentDashboard;
