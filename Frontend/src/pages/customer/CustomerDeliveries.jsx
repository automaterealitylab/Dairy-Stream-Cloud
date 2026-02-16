import React, { useEffect, useState } from 'react';
import CustomerLayout from '../../components/customer/layouts/CustomerLayout';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

const MOCK_DELIVERIES = [
  { id: 'd1', date: 'Today', product: 'Buffalo Milk', qty: '1.5 L', status: 'DELIVERED', time: '07:15 AM' },
  { id: 'd2', date: 'Yesterday', product: 'Buffalo Milk', qty: '1.5 L', status: 'DELIVERED', time: '07:10 AM' },
  { id: 'd3', date: '20 Jan', product: '-', qty: '-', status: 'SKIPPED', time: null },
];

const Deliveries = () => {
  const [deliveries, setDeliveries] = useState(MOCK_DELIVERIES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDeliveries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/customer/deliveries', { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (Array.isArray(data) && data.length) setDeliveries(data);
    } catch {
      setError('Could not load delivery history. Showing last known data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  return (
    <CustomerLayout>
      <div className="space-y-8">

        {/* Page Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Delivery History
          </h2>

          <button
            onClick={fetchDeliveries}
            disabled={loading}
            className="text-blue-600 text-sm font-medium hover:underline disabled:text-gray-400"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="bg-yellow-50 text-yellow-700 p-4 rounded-xl border border-yellow-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-500 py-12">
            Loading deliveries...
          </div>
        ) : (

          <div className="grid gap-5">

            {deliveries.map((item) => (

              <div
                key={item.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
              >

                {/* Left Section */}
                <div className="space-y-1">

                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    {item.date}
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900">
                    {item.qty} {item.product}
                  </h3>

                  {item.time && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Clock size={14} />
                      Dropped at {item.time}
                    </p>
                  )}
                </div>

                {/* Right Status Card Style */}
                {item.status === 'DELIVERED' && (
                  <div className="bg-green-50 px-6 py-4 rounded-xl flex items-center gap-3 text-green-700 font-medium">
                    <CheckCircle size={22} />
                    Delivered Successfully
                  </div>
                )}

                {item.status === 'SKIPPED' && (
                  <div className="bg-red-50 px-6 py-4 rounded-xl flex items-center gap-3 text-red-600 font-medium">
                    <XCircle size={22} />
                    Delivery Skipped
                  </div>
                )}

                {item.status === 'PENDING' && (
                  <div className="bg-yellow-50 px-6 py-4 rounded-xl flex items-center gap-3 text-yellow-700 font-medium">
                    <Clock size={22} />
                    Pending Delivery
                  </div>
                )}

              </div>

            ))}

          </div>
        )}

      </div>
    </CustomerLayout>
  );
};

export default Deliveries;
