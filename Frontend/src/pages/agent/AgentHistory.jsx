import React, { useState, useEffect } from 'react';
import AgentLayout from '../../components/agent/AgentLayout';
import DeliveryDetailsModal from '../../components/agent/DeliveryDetailsModal';
import { Calendar, CheckCircle, XCircle, Clock, Search, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { fetchAgentDeliveryHistory } from "../../api/agent/agent.api";

const AgentHistory = () => {
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDates, setExpandedDates] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const payload = await fetchAgentDeliveryHistory();
        setHistory(payload || []);
        setExpandedDates(payload?.[0]?.date ? [payload[0].date] : []);
      } catch (_err) {
        setHistory([]);
        setExpandedDates([]);
      }
    };
    loadHistory();
  }, []);

  const toggleDateExpanded = (date) => {
    if (expandedDates.includes(date)) {
      setExpandedDates(expandedDates.filter(d => d !== date));
    } else {
      setExpandedDates([...expandedDates, date]);
    }
  };

  const filteredHistory = history.map(day => ({
    ...day,
    deliveries: day.deliveries.filter(delivery => 
      delivery.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.address.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(day => day.deliveries.length > 0);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
          <CheckCircle size={14} />
          Completed
        </span>
      );
    } else if (status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
          <XCircle size={14} />
          Failed
        </span>
      );
    }
  };

  const getDayStats = (deliveries) => {
    const completed = deliveries.filter(d => d.status === 'completed').length;
    const failed = deliveries.filter(d => d.status === 'failed').length;
    const total = deliveries.length;
    return { completed, failed, total };
  };

  return (
    <AgentLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Delivery History</h2>
          <p className="text-gray-600">View all your past deliveries</p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by customer name, delivery ID, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* History List */}
        {filteredHistory.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Package className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-600">No delivery history found</p>
            {searchQuery && (
              <p className="text-sm text-gray-500 mt-2">Try adjusting your search query</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((day) => {
              const isExpanded = expandedDates.includes(day.date);
              const stats = getDayStats(day.deliveries);

              return (
                <div key={day.date} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Date Header */}
                  <button
                    onClick={() => toggleDateExpanded(day.date)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Calendar className="text-blue-600" size={24} />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-800">{formatDate(day.date)}</h3>
                        <p className="text-sm text-gray-600">
                          {stats.total} deliveries · {stats.completed} completed · {stats.failed} failed
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="text-gray-400" size={24} />
                    ) : (
                      <ChevronDown className="text-gray-400" size={24} />
                    )}
                  </button>

                  {/* Deliveries List */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 divide-y divide-gray-200">
                      {day.deliveries.map((delivery) => (
                        <div
                          key={delivery.id}
                          onClick={() => setSelectedDelivery(delivery)}
                          className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm font-mono text-gray-500">{delivery.id}</span>
                                {getStatusBadge(delivery.status)}
                              </div>
                              <h4 className="font-semibold text-gray-800 mb-1">{delivery.customerName}</h4>
                              <p className="text-sm text-gray-600 mb-1">{delivery.address}</p>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  <Package size={14} />
                                  {delivery.milkQuantity}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock size={14} />
                                  {delivery.completedAt}
                                </span>
                              </div>
                              {delivery.status === 'failed' && delivery.failedReason && (
                                <p className="text-sm text-red-600 mt-2">
                                  <span className="font-medium">Reason:</span> {delivery.failedReason}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delivery Details Modal */}
      {selectedDelivery && (
        <DeliveryDetailsModal
          delivery={selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
        />
      )}
    </AgentLayout>
  );
};

export default AgentHistory;
