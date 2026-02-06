import React, { useEffect, useState } from 'react';
import CustomerLayout from '../../layouts/CustomerLayout';
import { Droplet, Clock, Edit, PauseCircle, PlayCircle, X } from 'lucide-react';

const MOCK_SUBSCRIPTION = {
  product: 'Buffalo Milk',
  quantity: 1.5,
  slot: 'Morning',
  timeRange: '6:00 - 8:00 AM',
  status: 'ACTIVE'
};

const Subscribe = () => {

  const [subscription, setSubscription] = useState(MOCK_SUBSCRIPTION);
  const [formData, setFormData] = useState(MOCK_SUBSCRIPTION);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/customer/subscription', { credentials: 'include' });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSubscription(data);
        setFormData(data);
      } catch {
        console.log("Mock subscription loaded");
      }
    };
    fetchData();
  }, []);

  const updatePlan = () => {
    setSubscription(formData);
    setShowModal(false);
  };

  const pause = () =>
    setSubscription(prev => ({ ...prev, status: 'PAUSED' }));

  const resume = () =>
    setSubscription(prev => ({ ...prev, status: 'ACTIVE' }));

  return (
    <CustomerLayout>

      <div className="space-y-10 w-full animate-in fade-in slide-in-from-bottom-4">

        <h2 className="text-2xl font-bold text-gray-900">
          My Subscription
        </h2>

        {/* MAIN CARD */}
        <div
          className={`w-full rounded-2xl p-8 shadow-sm border transition hover:shadow-md
            ${subscription.status === 'ACTIVE'
              ? 'bg-green-50 border-green-100'
              : 'bg-yellow-50 border-yellow-100'}
          `}
        >

          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">

            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {subscription.status === 'ACTIVE' ? 'Active Plan' : 'Paused Plan'}
              </p>

              <h3 className="text-2xl font-semibold text-gray-900 mt-1">
                {subscription.quantity} Liters {subscription.product}
              </h3>

              <p className="text-sm text-gray-600 mt-1">
                {subscription.slot} Slot • {subscription.timeRange}
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">

              <button
                onClick={() => setShowModal(true)}
                className="px-5 py-2 rounded-xl bg-white border text-blue-600 hover:bg-blue-50 transition flex items-center gap-2 font-medium text-sm"
              >
                <Edit size={16} />
                Update Plan
              </button>

              {subscription.status === 'ACTIVE' ? (
                <button
                  onClick={pause}
                  className="px-5 py-2 rounded-xl bg-white border text-orange-600 hover:bg-orange-50 transition flex items-center gap-2 font-medium text-sm"
                >
                  <PauseCircle size={16} />
                  Pause
                </button>
              ) : (
                <button
                  onClick={resume}
                  className="px-5 py-2 rounded-xl bg-white border text-green-600 hover:bg-green-50 transition flex items-center gap-2 font-medium text-sm"
                >
                  <PlayCircle size={16} />
                  Resume
                </button>
              )}

            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="grid md:grid-cols-3 gap-6 w-full">

          <StatCard
            icon={<Droplet size={24} />}
            label="Daily Quantity"
            value={`${subscription.quantity} Liters`}
          />

          <StatCard
            icon={<Clock size={24} />}
            label="Delivery Slot"
            value={subscription.slot}
          />

          <StatCard
            icon={subscription.status === 'ACTIVE'
              ? <PlayCircle size={24} />
              : <PauseCircle size={24} />}
            label="Status"
            value={subscription.status}
          />

        </div>

      </div>

      {/* ================= MODAL ================= */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">

          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl animate-in zoom-in-95">

            {/* Header */}
            <div className="px-8 py-6 flex justify-between items-center border-b">

              <div>
                <h3 className="text-2xl font-semibold text-gray-900">
                  Update Subscription
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Manage your daily milk delivery
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition"
              >
                <X className="text-gray-400" size={22} />
              </button>
            </div>

            {/* Body */}
            <div className="px-8 py-6 grid grid-cols-1 md:grid-cols-2 gap-5">

              <div>
                <label className="text-sm font-medium text-gray-600">Product</label>
                <select
                  className="pro-input"
                  value={formData.product}
                  onChange={e => setFormData({ ...formData, product: e.target.value })}
                >
                  <option>Buffalo Milk</option>
                  <option>Cow Milk</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Quantity (Liters)</label>
                <input
                  type="number"
                  step="0.5"
                  className="pro-input"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Delivery Slot</label>
                <select
                  className="pro-input"
                  value={formData.slot}
                  onChange={e => setFormData({ ...formData, slot: e.target.value })}
                >
                  <option>Morning</option>
                  <option>Evening</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Time Range</label>
                <input
                  className="pro-input"
                  value={formData.timeRange}
                  onChange={e => setFormData({ ...formData, timeRange: e.target.value })}
                />
              </div>

            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t flex justify-end gap-4">

              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>

              <button
                onClick={updatePlan}
                className="px-8 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition font-medium shadow-sm"
              >
                Save Changes
              </button>

            </div>

          </div>
        </div>
      )}

    </CustomerLayout>
  );
};

export default Subscribe;


/* ===== Small Card ===== */

const StatCard = ({ icon, label, value }) => (
  <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100 flex items-center gap-4 transition hover:shadow-md">
    <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
      {icon}
    </div>
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-lg font-semibold text-gray-900">
        {value}
      </p>
    </div>
  </div>
);
