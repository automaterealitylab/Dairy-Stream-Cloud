import React, { useEffect, useState } from 'react';
import CustomerLayout from '../../layouts/CustomerLayout';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { fetchCustomerDeliveries } from '../../api/customer.api.js';

const Deliveries = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDeliveries = async () => {
    setLoading(true);
    setError(null);
    try {
      const storedUser = localStorage.getItem("user");
      const storedToken = storedUser ? JSON.parse(storedUser)?.token : null;
      const token = storedToken || localStorage.getItem("token");

      if (!token) {
        throw new Error("Customer token missing");
      }

      const data = await fetchCustomerDeliveries(token);
      setDeliveries(Array.isArray(data?.deliveries) ? data.deliveries : []);
    } catch (err) {
      setError(err?.message || 'Could not load delivery history.');
      setDeliveries([]);
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

            {deliveries.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-gray-600">
                No deliveries found yet.
              </div>
            )}

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
