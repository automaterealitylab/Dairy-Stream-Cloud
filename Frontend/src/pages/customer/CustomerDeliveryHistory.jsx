import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../components/customer/layouts/CustomerLayout';
import { CheckCircle, XCircle, Clock, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { fetchCustomerDeliveries } from '../../api/customer.api.js';

const Deliveries = () => {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [todayDelivery, setTodayDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDeliveries = async () => {
    setLoading(true);
    setError(null);
    try {
      // ✅ Using the clean API call (interceptor handles the token)
      const deliveryData = await fetchCustomerDeliveries();
      
      setDeliveries(Array.isArray(deliveryData?.deliveries) ? deliveryData.deliveries : []);
      setTodayDelivery(deliveryData?.todayDelivery || null);
    } catch (err) {
      setError(err?.message || 'Could not load delivery history.');
      setDeliveries([]);
      setTodayDelivery(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const todayStatus = String(todayDelivery?.status || 'PENDING').toUpperCase();
  const isTodayPending = todayStatus === 'PENDING';
  const isTodayApprovalPending = todayStatus === 'PENDING_APPROVAL';
  const isTodayDelivered = todayStatus === 'DELIVERED';
  const isTodayPartnerUnassigned =
    (isTodayPending || isTodayApprovalPending) && !todayDelivery?.canTrackAgent;
  const todayStatusClass = isTodayPending
    ? 'bg-amber-100 text-amber-700'
    : isTodayApprovalPending
    ? 'bg-indigo-100 text-indigo-700'
    : isTodayDelivered
    ? 'bg-green-100 text-green-700'
    : 'bg-slate-100 text-slate-700';
  const todayTimingLabel =
    todayStatus === 'NOT_SUBSCRIBED' || todayStatus === 'NOT_SCHEDULED'
      ? 'No confirmed delivery slot for today'
      : todayStatus === 'DELIVERED'
      ? (todayDelivery?.time ? `Delivered at ${todayDelivery.time}` : 'Delivered')
      : todayDelivery?.expectedWindow
      ? `Expected in ${todayDelivery.expectedWindow}`
      : todayDelivery?.slotWindow
      ? `Expected between ${todayDelivery.slotWindow}`
      : todayDelivery?.slot && todayDelivery.slot !== '-'
      ? `Expected in ${todayDelivery.slot} slot`
      : 'Expected today';

  return (
    <CustomerLayout>
      <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500">
        
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Delivery History
          </h2>

          <button
            onClick={fetchDeliveries}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-white border px-4 py-2 rounded-xl text-blue-600 text-sm font-bold hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-2xl border border-red-100 flex items-center gap-3">
            <XCircle size={20} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Today's Special Focus Card */}
        {todayDelivery && (
          <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-[32px] shadow-sm border border-blue-100 p-8 relative overflow-hidden">
             {/* Decorative Background Icon */}
            <MapPin className="absolute -right-4 -bottom-4 text-blue-500/10" size={120} />
            
            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-500 mb-2">Today's Delivery</p>
            
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
              <div>
                <h3 className="text-2xl font-black text-gray-900">
                  {todayDelivery.quantity || '-'} {todayDelivery.product || 'Milk'}
                </h3>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${todayStatusClass}`}>
                    {todayDelivery.status || 'PENDING'}
                  </span>
                  <span className="text-gray-400 text-sm">•</span>
                  <span className="text-gray-500 text-sm font-medium">{todayTimingLabel}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {todayDelivery?.customerIssue && (
                    <span
                      title={todayDelivery.customerIssue}
                      className="max-w-full truncate px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-rose-100 text-rose-700"
                    >
                      Issue: {todayDelivery.customerIssue}
                    </span>
                  )}
                  {todayDelivery?.issueAdminAction && (
                    <span
                      title={todayDelivery.issueAdminAction}
                      className="max-w-full truncate px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700"
                    >
                      Action: {todayDelivery.issueAdminAction}
                    </span>
                  )}
                  {todayDelivery?.isOneTimeOrder && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700">
                      One-time order
                    </span>
                  )}
                  {todayDelivery?.slot && todayDelivery.slot !== '-' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                      Slot: {todayDelivery.slot}
                    </span>
                  )}
                  {todayDelivery?.paymentMethod && todayDelivery.paymentMethod !== '-' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                      Payment: {todayDelivery.paymentMethod}
                    </span>
                  )}
                </div>
                {todayDelivery?.dairyName && (
                  <p className="text-xs text-gray-500 mt-2">Dairy: {todayDelivery.dairyName}</p>
                )}
                {isTodayPartnerUnassigned && (
                  <p className="text-xs text-gray-500 mt-1">Delivery partner not assigned yet.</p>
                )}
                {todayDelivery?.address && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">Address: {todayDelivery.address}</p>
                )}
              </div>

              <button
                onClick={() => navigate('/customer/dashboard/track/agent', { state: { delivery: todayDelivery } })}
                className="flex items-center justify-center gap-3 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:bg-gray-200 disabled:shadow-none disabled:text-gray-400"
                disabled={!todayDelivery?.canTrackAgent}
              >
                <MapPin size={20} />
                Track Agent
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-[32px] border border-gray-100 p-20">
            <div className="flex flex-col items-center justify-center gap-4 text-gray-400">
              <Loader2 size={40} className="animate-spin text-blue-600" />
              <p className="font-bold uppercase tracking-widest text-xs">Syncing History...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Recent Deliveries</h4>
            
            {deliveries.length === 0 && (
              <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center">
                <p className="text-gray-400 font-medium">No previous delivery records found.</p>
              </div>
            )}

            {deliveries.map((item) => {
              const itemStatus = String(item?.status || '').toUpperCase();
              const isItemPending = itemStatus === 'PENDING' || itemStatus === 'PENDING_APPROVAL';
              const itemStatusLabel =
                itemStatus === 'PENDING_APPROVAL'
                  ? 'APPROVAL PENDING'
                  : itemStatus;
              const itemStatusClass =
                itemStatus === 'DELIVERED'
                  ? 'bg-green-50 text-green-700'
                  : itemStatus === 'SKIPPED'
                  ? 'bg-red-50 text-red-600'
                  : itemStatus === 'PENDING_APPROVAL'
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'bg-amber-50 text-amber-600';
              return (
              <div
                key={item.id}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6 transition-all hover:shadow-md"
              >
                {/* Left Section */}
                <div className="flex items-center gap-5">
                  <div className={`p-4 rounded-2xl ${
                    item.status === 'DELIVERED' ? 'bg-green-50 text-green-600' : 
                    item.status === 'SKIPPED' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'
                  }`}>
                    {item.status === 'DELIVERED' ? <CheckCircle size={24} /> : 
                     item.status === 'SKIPPED' ? <XCircle size={24} /> : <Clock size={24} />}
                  </div>
                  
                  <div>
                    <p className="text-xs font-bold text-gray-400 mb-1">{item.date}</p>
                    <h3 className="text-lg font-bold text-gray-900">
                      {item.qty} {item.product}
                    </h3>
                    {item.time && (
                      <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                        <Clock size={14} className="text-blue-500" />
                        Dropped at {item.time}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {item.customerIssue && (
                        <span
                          title={item.customerIssue}
                          className="max-w-full truncate px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-rose-100 text-rose-700"
                        >
                          Issue: {item.customerIssue}
                        </span>
                      )}
                      {item.issueAdminAction && (
                        <span
                          title={item.issueAdminAction}
                          className="max-w-full truncate px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700"
                        >
                          Action: {item.issueAdminAction}
                        </span>
                      )}
                      {item.isOneTimeOrder && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700">
                          One-time
                        </span>
                      )}
                      {item.slot && item.slot !== '-' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                          Slot: {item.slot}{item.slotWindow ? ` (${item.slotWindow})` : ''}
                        </span>
                      )}
                      {item.paymentMethod && item.paymentMethod !== '-' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                          Payment: {item.paymentMethod}
                        </span>
                      )}
                      {item.dairyName && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {item.dairyName}
                        </span>
                      )}
                    </div>
                    {item.address && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">Address: {item.address}</p>
                    )}
                    {isItemPending && (
                      <p className="text-xs text-gray-500 mt-1">Delivery partner not assigned yet.</p>
                    )}
                  </div>
                </div>

                {/* Right Status Card Style */}
                <div className={`px-6 py-3 rounded-2xl font-bold text-sm uppercase tracking-wider ${itemStatusClass}`}>
                  {itemStatusLabel}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
};

export default Deliveries;
