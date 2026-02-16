import React, { useEffect, useState } from 'react';
import CustomerLayout from '../../components/customer/layouts/CustomerLayout';
import { Droplet, Clock, Edit, PauseCircle, PlayCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MOCK_SUBSCRIPTION = {
  product: 'Buffalo Milk',
  quantity: 1.5,
  slot: 'Morning',
  timeRange: '6:00 - 8:00 AM',
  status: 'ACTIVE'
};

const Subscribe = () => {

  const navigate = useNavigate();

  const [subscription, setSubscription] = useState(MOCK_SUBSCRIPTION);
  const [formData, setFormData] = useState(MOCK_SUBSCRIPTION);

  const [loading, setLoading] = useState(true);

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [toast, setToast] = useState(null);
  const [closing, setClosing] = useState(false);

  // ================= FETCH =================
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/customer/subscription', {
          credentials: 'include'
        });

        if (!res.ok) throw new Error();

        const data = await res.json();
        setSubscription(data);
        setFormData(data);

      } catch {
        console.log("Mock subscription loaded");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ================= TOAST =================
  const showToastMessage = (type, message) => {
    setToast({ type, message });

    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // ================= UPDATE =================
  const updatePlan = async () => {
    try {
      // Backend ready later

      setSubscription(formData);
      setShowUpdateModal(false);

      showToastMessage('success', 'Subscription updated successfully');

    } catch {
      showToastMessage('error', 'Failed to update subscription');
    }
  };

  // ================= PAUSE / RESUME =================
  const pause = () => {
    setSubscription(prev => ({ ...prev, status: 'PAUSED' }));
    showToastMessage('success', 'Subscription paused');
  };

  const resume = () => {
    setSubscription(prev => ({ ...prev, status: 'ACTIVE' }));
    showToastMessage('success', 'Subscription resumed');
  };

  // ================= CLOSE =================
  const cancelSubscription = async () => {

    setClosing(true);

    try {
      setTimeout(() => {

        setClosing(false);
        setShowCancelModal(false);

        setSubscription(prev => ({ ...prev, status: 'CLOSED' }));

        showToastMessage('success', 'Subscription closed successfully');

        setTimeout(() => {
          navigate('/explore');
        }, 1200);

      }, 900);

    } catch {
      setClosing(false);
      showToastMessage('error', 'Failed to close subscription');
    }
  };

  return (
    <CustomerLayout>

      <div className="space-y-10 w-full animate-in fade-in slide-in-from-bottom-4">

        <h2 className="text-2xl font-bold text-gray-900">
          My Subscription
        </h2>

        {/* ========== SKELETON LOADER ========== */}
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

            {/* ========== MAIN CARD ========== */}
            <div className={`w-full rounded-2xl p-8 shadow-sm border transition hover:shadow-md
              ${
                subscription.status === 'ACTIVE'
                  ? 'bg-green-50 border-green-100'
                  : subscription.status === 'PAUSED'
                  ? 'bg-yellow-50 border-yellow-100'
                  : 'bg-red-50 border-red-100'
              }
            `}>

              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">

                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    {subscription.status} PLAN
                  </p>

                  <h3 className="text-2xl font-semibold text-gray-900 mt-1">
                    {subscription.quantity} Liters {subscription.product}
                  </h3>

                  <p className="text-sm text-gray-600 mt-1">
                    {subscription.slot} Slot • {subscription.timeRange}
                  </p>
                </div>

                {subscription.status !== 'CLOSED' && (
                  <div className="flex gap-3 flex-wrap">

                    <button
                      onClick={() => setShowUpdateModal(true)}
                      className="px-5 py-2 rounded-xl bg-white border text-blue-600 hover:bg-blue-50 flex items-center gap-2 text-sm font-medium"
                    >
                      <Edit size={16}/> Update Plan
                    </button>

                    {subscription.status === 'ACTIVE' ? (
                      <button
                        onClick={pause}
                        className="px-5 py-2 rounded-xl bg-white border text-orange-600 hover:bg-orange-50 flex items-center gap-2 text-sm font-medium"
                      >
                        <PauseCircle size={16}/> Pause
                      </button>
                    ) : (
                      <button
                        onClick={resume}
                        className="px-5 py-2 rounded-xl bg-white border text-green-600 hover:bg-green-50 flex items-center gap-2 text-sm font-medium"
                      >
                        <PlayCircle size={16}/> Resume
                      </button>
                    )}

                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="px-5 py-2 rounded-xl bg-white border text-red-600 hover:bg-red-50 text-sm font-medium"
                    >
                      Close Subscription
                    </button>

                  </div>
                )}

              </div>
            </div>

            {/* ========== STATS ========== */}
            <div className="grid md:grid-cols-3 gap-6">

              <StatCard icon={<Droplet size={24}/>} label="Daily Quantity" value={`${subscription.quantity} Liters`} />

              <StatCard icon={<Clock size={24}/>} label="Delivery Slot" value={subscription.slot} />

              <StatCard 
                icon={subscription.status === 'ACTIVE' ? <PlayCircle size={24}/> : <PauseCircle size={24}/>} 
                label="Status" 
                value={subscription.status} 
              />

            </div>

          </>
        )}

      </div>

      {/* ================= UPDATE MODAL ================= */}
      {showUpdateModal && (
        <ModalWrapper>

          <ModalHeader title="Update Subscription" subtitle="Manage your milk delivery" onClose={()=>setShowUpdateModal(false)} />

          <div className="px-8 py-6 grid md:grid-cols-2 gap-5">

            <InputBlock label="Product">
              <select className="pro-input" value={formData.product}
                onChange={e=>setFormData({...formData, product:e.target.value})}>
                <option>Buffalo Milk</option>
                <option>Cow Milk</option>
              </select>
            </InputBlock>

            <InputBlock label="Quantity (Liters)">
              <input type="number" step="0.5" className="pro-input"
                value={formData.quantity}
                onChange={e=>setFormData({...formData, quantity:e.target.value})}/>
            </InputBlock>

            <InputBlock label="Delivery Slot">
              <select className="pro-input" value={formData.slot}
                onChange={e=>setFormData({...formData, slot:e.target.value})}>
                <option>Morning</option>
                <option>Evening</option>
              </select>
            </InputBlock>

            <InputBlock label="Time Range">
              <input className="pro-input" value={formData.timeRange}
                onChange={e=>setFormData({...formData, timeRange:e.target.value})}/>
            </InputBlock>

          </div>

          <ModalFooter onCancel={()=>setShowUpdateModal(false)} onConfirm={updatePlan} confirmText="Save Changes" />

        </ModalWrapper>
      )}

      {/* ================= CANCEL MODAL ================= */}
      {showCancelModal && (
        <ModalWrapper small>

          <div className="p-8">

            <h3 className="text-2xl font-semibold text-gray-900">
              Close Subscription?
            </h3>

            <p className="text-gray-600 mt-3">
              This will stop your deliveries immediately.
            </p>

            <div className="flex justify-end gap-4 mt-8">

              <button
                onClick={()=>setShowCancelModal(false)}
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
                {closing ? 'Closing...' : 'Close Subscription'}
              </button>

            </div>

          </div>

        </ModalWrapper>
      )}

      {/* ================= TOAST ================= */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 animate-slide-in">

          <div className={`relative overflow-hidden rounded-2xl shadow-lg px-6 py-4 text-white min-w-[260px]
            ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}
          `}>

            <p className="font-medium">{toast.message}</p>

            <div className="absolute bottom-0 left-0 h-1 bg-white/50 animate-toast-progress"></div>
          </div>

        </div>
      )}

    </CustomerLayout>
  );
};

export default Subscribe;



/* ================= SMALL COMPONENTS ================= */

const StatCard = ({ icon, label, value }) => (
  <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition">
    <div className="bg-blue-50 p-3 rounded-xl text-blue-600">{icon}</div>
    <div>
      <p className="text-xs text-gray-400 uppercase">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  </div>
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
      <X size={22} className="text-gray-400"/>
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
