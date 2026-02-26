import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchAdminCustomers } from "../../api/admin.api";

import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import CustomerDrawer from "../../components/customer/CustomerDrawer";
import AddCustomerModal from "../../components/customer/AddCustomerModal.jsx";
import AddCustomerSubscriptionModal from "../../components/customer/AddCustomerSubscriptionModal.jsx";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";

export default function AdminCustomers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [createdCustomer, setCreatedCustomer] = useState(null);

  useEffect(() => {
    if (searchParams.get("addCustomer") === "1") {
      setIsAddModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchAdminCustomers({ page, search });
        if (active) {
          setCustomers(res.customers || []);
          setTotal(res.total || 0);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [page, search, refreshKey]);

  const openAddModal = () => {
    setIsAddModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.set("addCustomer", "1");
    setSearchParams(next, { replace: true });
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete("addCustomer");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminMobileTopbar title="Customers" onMenu={() => setSidebarOpen(true)} />

      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="lg:ml-64 px-4 sm:px-6 lg:px-10 py-8">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
            <p className="text-sm text-gray-500 mt-1">Manage all customers linked to your dairy</p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            + Add Customer
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
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
              Total Customers <span className="font-medium text-gray-900">{total}</span>
            </div>
          </div>

          <div className="divide-y">
            {loading ? (
              <LoadingIndicator className="px-6 py-10" message="Loading customers..." />
            ) : customers.length === 0 ? (
              <div className="px-6 py-10 text-gray-500">No customers found</div>
            ) : (
              customers.map((c) => (
                <div
                  key={c.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div>
                    <div className="font-medium text-gray-900">{c.customer_name || "Unnamed Customer"}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{c.phone_number || "-"}</div>
                  </div>

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

          <div className="px-6 py-4 flex justify-between items-center border-t">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40"
            >
              Previous
            </button>

            <span className="text-sm text-gray-500">Page {page}</span>

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

      {selectedCustomer && (
        <CustomerDrawer
          customerId={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}

      <AddCustomerModal
        open={isAddModalOpen}
        onClose={closeAddModal}
        onCreated={(customer) => {
          setRefreshKey((k) => k + 1);
          if (customer?.id) {
            setCreatedCustomer(customer);
            setIsSubscriptionModalOpen(true);
          }
        }}
      />

      <AddCustomerSubscriptionModal
        open={isSubscriptionModalOpen}
        customer={createdCustomer}
        onClose={() => {
          setIsSubscriptionModalOpen(false);
          setCreatedCustomer(null);
        }}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
