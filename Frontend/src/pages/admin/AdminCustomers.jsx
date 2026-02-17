import { useEffect, useState } from "react";
import { fetchAdminCustomers } from "../../api/admin.api";

import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import CustomerDrawer from "../../components/customer/CustomerDrawer";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";

export default function AdminCustomers() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // ✅ MUST be inside component
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchAdminCustomers({ page, search });
        if (active) {
          setCustomers(res.customers);
          setTotal(res.total);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => (active = false);
  }, [page, search, refreshKey]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminMobileTopbar
        title="Customers"
        onMenu={() => setSidebarOpen(true)}
      />

      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="lg:ml-64 px-4 sm:px-6 lg:px-10 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            Customers
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage all customers linked to your dairy
          </p>
        </div>

        {/* Main Canvas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          {/* Top Bar */}
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search customer name or phone"
              className="pro-input max-w-sm"
            />

            <div className="text-sm text-gray-500">
              Total Customers{" "}
              <span className="font-medium text-gray-900">
                {total}
              </span>
            </div>
          </div>

          {/* List */}
          <div className="divide-y">
            {loading ? (
              <LoadingIndicator className="px-6 py-10" message="Loading customers..." />
            ) : customers.length === 0 ? (
              <div className="px-6 py-10 text-gray-500">
                No customers found
              </div>
            ) : (
              customers.map((c) => (
                <div
                  key={c.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  {/* Left */}
                  <div>
                    <div className="font-medium text-gray-900">
                      {c.customer_name || "Unnamed Customer"}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {c.phone_number || "—"}
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-8 text-sm">
                    <div className="text-gray-500">
                      Joined{" "}
                      <span className="text-gray-900 font-medium">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <button
                      onClick={() => setSelectedCustomer(c.id)}
                      className="text-blue-600 font-medium hover:underline"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 flex justify-between items-center border-t">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40"
            >
              Previous
            </button>

            <span className="text-sm text-gray-500">
              Page {page}
            </span>

            <button
              disabled={page * 10 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </main>

      {/* ✅ Drawer */}
      {selectedCustomer && (
        <CustomerDrawer
          customerId={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
