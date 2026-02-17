import React, { useEffect, useState } from 'react';
import CustomerLayout from '../../components/customer/layouts/CustomerLayout';
import { Droplet, Clock, Edit, PauseCircle, PlayCircle, Store, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  fetchCustomerSubscription,
  saveCustomerSubscription,
  clearCustomerSubscription,
} from '../../api/customer.api';

const EMPTY_FORM = {
  dairyId: null,
  product: '',
  quantity: 1,
  slot: 'Morning',
  timeRange: '6:00 - 8:00 AM',
  status: 'ACTIVE',
  startDate: '',
  address: '',
  paymentMethod: 'UPI',
};

const getAuthToken = () => {
  const storedUser = localStorage.getItem('user');
  const parsed = storedUser ? JSON.parse(storedUser) : null;
  return parsed?.token || localStorage.getItem('token') || null;
};

const toUiSubscription = (record) => {
  if (!record) return null;

  const slot = record.delivery_slot || 'Morning';
  return {
    dairyId: record.dairy_id ?? null,
    product: record.milk_type || 'Milk',
    quantity: Number(record.quantity_liters || 0),
    slot,
    timeRange: slot === 'Evening' ? '5:00 - 8:00 PM' : '6:00 - 8:00 AM',
    status: (record.status || 'ACTIVE').toUpperCase(),
    startDate: record.start_date || '',
    address: record.address || '',
    paymentMethod: record.payment_method || 'UPI',
  };
};

const toSavePayload = (model, overrides = {}) => {
  const next = { ...model, ...overrides };
  return {
    dairyId: next.dairyId,
    milkType: next.product,
    quantity: Number(next.quantity),
    slot: next.slot,
    startDate: next.startDate || undefined,
    address: next.address || '',
    paymentMethod: next.paymentMethod || 'UPI',
    status: (next.status || 'ACTIVE').toUpperCase(),
  };
};

const Subscribe = () => {
  const navigate = useNavigate();

  const [subscription, setSubscription] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [toast, setToast] = useState(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = getAuthToken();
        if (!token) throw new Error('Token missing');

        const data = await fetchCustomerSubscription(token);
        const mapped = toUiSubscription(data?.subscription);

        setSubscription(mapped);
        setFormData(mapped || EMPTY_FORM);
      } catch (error) {
        console.error('Subscription fetch error:', error.message);
        setSubscription(null);
        setFormData(EMPTY_FORM);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const showToastMessage = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const updatePlan = async () => {
    if (!subscription?.dairyId) {
      showToastMessage('error', 'No active subscription found');
      return;
    }

    setSaving(true);
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Token missing');

      const result = await saveCustomerSubscription(
        token,
        toSavePayload(formData, {
          dairyId: subscription.dairyId,
          status: subscription.status,
          startDate: subscription.startDate,
          address: subscription.address,
          paymentMethod: subscription.paymentMethod,
        })
      );

      const mapped = toUiSubscription(result?.subscription);
      setSubscription(mapped);
      setFormData(mapped || EMPTY_FORM);
      setShowUpdateModal(false);
      showToastMessage('success', 'Subscription updated successfully');
    } catch (err) {
      showToastMessage('error', err?.message || 'Failed to update subscription');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (status) => {
    if (!subscription?.dairyId) {
      showToastMessage('error', 'No active subscription found');
      return;
    }

    setSaving(true);
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Token missing');

      const result = await saveCustomerSubscription(
        token,
        toSavePayload(subscription, { status })
      );

      const mapped = toUiSubscription(result?.subscription);
      setSubscription(mapped);
      setFormData(mapped || EMPTY_FORM);
      showToastMessage('success', status === 'PAUSED' ? 'Subscription paused' : 'Subscription resumed');
    } catch (err) {
      showToastMessage('error', err?.message || 'Failed to update subscription');
    } finally {
      setSaving(false);
    }
  };

  const pause = () => updateStatus('PAUSED');
  const resume = () => updateStatus('ACTIVE');

  const cancelSubscription = async () => {
    setClosing(true);

    try {
      const token = getAuthToken();
      if (!token) throw new Error('Token missing');

      await clearCustomerSubscription(token);
      setShowCancelModal(false);
      setSubscription(null);
      setFormData(EMPTY_FORM);
      showToastMessage('success', 'Subscription removed successfully');
      setTimeout(() => navigate('/explore'), 900);
    } catch (err) {
      showToastMessage('error', err?.message || 'Failed to close subscription');
    } finally {
      setClosing(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="space-y-10 w-full animate-in fade-in slide-in-from-bottom-4">
        <h2 className="text-2xl font-bold text-gray-900">My Subscription</h2>

        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-32 bg-gray-200 rounded-2xl"></div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="h-24 bg-gray-200 rounded-2xl"></div>
              <div className="h-24 bg-gray-200 rounded-2xl"></div>
              <div className="h-24 bg-gray-200 rounded-2xl"></div>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`w-full rounded-2xl p-8 shadow-sm border transition hover:shadow-md ${
                !subscription
                  ? 'bg-gray-50 border-gray-200'
                  : subscription.status === 'ACTIVE'
                  ? 'bg-green-50 border-green-100'
                  : subscription.status === 'PAUSED'
                  ? 'bg-yellow-50 border-yellow-100'
                  : 'bg-red-50 border-red-100'
              }`}
            >
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    {subscription ? `${subscription.status} PLAN` : 'NO ACTIVE PLAN'}
                  </p>

                  <h3 className="text-2xl font-semibold text-gray-900 mt-1">
                    {subscription ? `${subscription.quantity} Liters ${subscription.product}` : 'No subscription yet'}
                  </h3>

                  <p className="text-sm text-gray-600 mt-1">
                    {subscription
                      ? `${subscription.slot} Slot - ${subscription.timeRange}`
                      : 'Choose a dairy and create your plan from See Other Dairies'}
                  </p>
                </div>

                {subscription && subscription.status !== 'CLOSED' ? (
                  <div className="flex gap-3 flex-wrap">
                    <button
                      disabled={saving}
                      onClick={() => setShowUpdateModal(true)}
                      className="px-5 py-2 rounded-xl bg-white border text-blue-600 hover:bg-blue-50 flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                    >
                      <Edit size={16} /> Update Plan
                    </button>

                    {subscription.status === 'ACTIVE' ? (
                      <button
                        disabled={saving}
                        onClick={pause}
                        className="px-5 py-2 rounded-xl bg-white border text-orange-600 hover:bg-orange-50 flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                      >
                        <PauseCircle size={16} /> Pause
                      </button>
                    ) : (
                      <button
                        disabled={saving}
                        onClick={resume}
                        className="px-5 py-2 rounded-xl bg-white border text-green-600 hover:bg-green-50 flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                      >
                        <PlayCircle size={16} /> Resume
                      </button>
                    )}

                    <button
                      disabled={saving}
                      onClick={() => setShowCancelModal(true)}
                      className="px-5 py-2 rounded-xl bg-white border text-red-600 hover:bg-red-50 text-sm font-medium disabled:opacity-50"
                    >
                      Close Subscription
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => navigate('/explore')}
                    className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
                  >
                    See Other Dairies
                  </button>
                )}
              </div>
            </div>

            {subscription && (
              <div className="grid md:grid-cols-3 gap-6">
                <StatCard icon={<Droplet size={24} />} label="Daily Quantity" value={`${subscription.quantity} Liters`} />
                <StatCard icon={<Clock size={24} />} label="Delivery Slot" value={subscription.slot} />
                <StatCard
                  icon={subscription.status === 'ACTIVE' ? <PlayCircle size={24} /> : <PauseCircle size={24} />}
                  label="Status"
                  value={subscription.status}
                />
              </div>
            )}

            <ExploreOtherDairiesSection onExplore={() => navigate('/explore')} />
          </>
        )}
      </div>

      {showUpdateModal && subscription && (
        <ModalWrapper>
          <ModalHeader
            title="Update Subscription"
            subtitle="Manage your milk delivery"
            onClose={() => setShowUpdateModal(false)}
          />

          <div className="px-8 py-6 grid md:grid-cols-2 gap-5">
            <InputBlock label="Product">
              <select
                className="pro-input"
                value={formData.product}
                onChange={(e) => setFormData({ ...formData, product: e.target.value })}
              >
                <option>Buffalo Milk</option>
                <option>Cow Milk</option>
                <option>Full Cream</option>
                <option>Toned</option>
                <option>Double Toned</option>
              </select>
            </InputBlock>

            <InputBlock label="Quantity (Liters)">
              <input
                type="number"
                step="0.5"
                min="0.5"
                className="pro-input"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
            </InputBlock>

            <InputBlock label="Delivery Slot">
              <select
                className="pro-input"
                value={formData.slot}
                onChange={(e) => setFormData({ ...formData, slot: e.target.value })}
              >
                <option>Morning</option>
                <option>Evening</option>
              </select>
            </InputBlock>

            <InputBlock label="Time Range">
              <input
                className="pro-input"
                value={formData.timeRange}
                onChange={(e) => setFormData({ ...formData, timeRange: e.target.value })}
              />
            </InputBlock>
          </div>

          <ModalFooter
            onCancel={() => setShowUpdateModal(false)}
            onConfirm={updatePlan}
            confirmText={saving ? 'Saving...' : 'Save Changes'}
          />
        </ModalWrapper>
      )}

      {showCancelModal && (
        <ModalWrapper small>
          <div className="p-8">
            <h3 className="text-2xl font-semibold text-gray-900">Close Subscription?</h3>

            <p className="text-gray-600 mt-3">
              Are you sure you want to remove your subscription? This will stop deliveries immediately.
            </p>

            <div className="flex justify-end gap-4 mt-8">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-6 py-2 rounded-xl border hover:bg-gray-50"
              >
                Keep It
              </button>

              <button
                onClick={cancelSubscription}
                disabled={closing}
                className="px-6 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 flex items-center gap-2 disabled:bg-red-400"
              >
                {closing && <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                {closing ? 'Removing...' : 'Yes, Remove Subscription'}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {toast && (
        <div className="fixed top-6 right-6 z-50 animate-slide-in">
          <div
            className={`relative overflow-hidden rounded-2xl shadow-lg px-6 py-4 text-white min-w-[260px] ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            <p className="font-medium">{toast.message}</p>
            <div className="absolute bottom-0 left-0 h-1 bg-white/50 animate-toast-progress"></div>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
};

export default Subscribe;

const StatCard = ({ icon, label, value }) => (
  <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition">
    <div className="bg-blue-50 p-3 rounded-xl text-blue-600">{icon}</div>
    <div>
      <p className="text-xs text-gray-400 uppercase">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  </div>
);

const ExploreOtherDairiesSection = ({ onExplore }) => (
  <section className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-6 md:p-7">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-white text-blue-600 border border-blue-100">
          <Store size={22} />
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-900">Explore Other Dairies</h3>
          <p className="text-sm text-gray-600 mt-1">
            Compare dairies, check plans, and switch to a better option anytime.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs font-medium text-blue-700 bg-white px-3 py-1 rounded-full border border-blue-100">
              Compare Plans
            </span>
            <span className="text-xs font-medium text-blue-700 bg-white px-3 py-1 rounded-full border border-blue-100">
              Check Ratings
            </span>
            <span className="text-xs font-medium text-blue-700 bg-white px-3 py-1 rounded-full border border-blue-100">
              Join Instantly
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={onExplore}
        className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
      >
        Browse Dairies
      </button>
    </div>
  </section>
);

const ModalWrapper = ({ children, small }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
    <div className={`bg-white rounded-3xl shadow-2xl w-full animate-in zoom-in-95 ${small ? 'max-w-md' : 'max-w-xl'}`}>
      {children}
    </div>
  </div>
);

const ModalHeader = ({ title, subtitle, onClose }) => (
  <div className="px-8 py-6 flex justify-between items-center border-b">
    <div>
      <h3 className="text-2xl font-semibold">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
      <X size={22} className="text-gray-400" />
    </button>
  </div>
);

const ModalFooter = ({ onCancel, onConfirm, confirmText }) => (
  <div className="px-8 py-6 border-t flex justify-end gap-4">
    <button onClick={onCancel} className="px-6 py-2 rounded-xl border hover:bg-gray-50">
      Cancel
    </button>
    <button onClick={onConfirm} className="px-8 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
      {confirmText}
    </button>
  </div>
);

const InputBlock = ({ label, children }) => (
  <div>
    <label className="text-sm font-medium text-gray-600">{label}</label>
    {children}
  </div>
);
