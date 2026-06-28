import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileText,
  IndianRupee,
  UserPlus,
  Search,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from "lucide-react";

import {
  approveAdminCustomerSubscription,
  assignAdminCustomerPermanentPartner,
  collectAdminOfflinePayment,
  fetchAdminAgents,
  fetchAdminCustomers,
} from "../../api/admin.api";

import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import AdminMobileBottomNav from "../../components/admin/layout/AdminMobileBottomNav";
import { adminHeadingFont, adminShellFont, useTheme } from "../../components/admin/adminTheme";

const CustomerDrawer = lazy(() => import("../../components/customer/CustomerDrawer"));
const AddCustomerModal = lazy(() => import("../../components/customer/AddCustomerModal.jsx"));
const AddCustomerSubscriptionModal = lazy(() => import("../../components/customer/AddCustomerSubscriptionModal.jsx"));
const ManualPaymentModal = lazy(() => import("../../components/admin/sections/ManualPaymentModal"));
const InvoicePreviewModal = lazy(() => import("../../components/admin/sections/InvoicePreviewModal.jsx"));
export default function AdminCustomers() {
  const { isDark } = useTheme();
  const customerPanelStyle = {
    background: isDark ? "#121829" : "rgba(255, 255, 255, 0.95)",
    borderColor: isDark ? "#1E293B" : "#EDE8DF",
  };
  const customerPanelHeaderStyle = {
    background: isDark ? "#121829" : "rgba(255, 255, 255, 0.95)",
    borderColor: isDark ? "#1E293B" : "#F2EDE4",
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // ✅ 1. ADDED: Logic to get Admin Name from localStorage
  let adminName = "Admin";
  try {
    const adminUserStr = localStorage.getItem("adminUser");
    if (adminUserStr) {
      const parsed = JSON.parse(adminUserStr);
      adminName = parsed?.name || "Admin";
    }
  } catch {
    adminName = "Admin";
  }

  // invoice
  const [invoiceTarget, setInvoiceTarget] = useState(null);

  // Data State
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [agents, setAgents] = useState([]);

  // Action States
  const [rowActionLoadingId, setRowActionLoadingId] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetCustomer, setAssignTargetCustomer] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [createdCustomer, setCreatedCustomer] = useState(null);

  const reloadCustomers = () => setRefreshKey((k) => k + 1);

  // ---- Loaders ----
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

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const res = await fetchAdminAgents({ page: 1, limit: 200, search: "" });
        setAgents(Array.isArray(res?.agents) ? res.agents : []);
      } catch (err) {
        console.error(err);
      }
    };
    loadAgents();
  }, []);

  // ---- Business Logic Handlers ----
  const handleSavePayment = async (payData) => {
    try {
      await collectAdminOfflinePayment({
        customerId: paymentTarget.id,
        receivedAmount: payData.received,
        method: payData.method,
        note: payData.note,
      });
      setPaymentTarget(null);
      reloadCustomers();
    } catch (err) {
      alert(err?.response?.data?.error || "Payment Failed");
    }
  };

  const handleGenerateBill = async (customer) => {
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF();

      doc.setFontSize(22);
      doc.text("DAIRYVISION", 14, 20);

      // ✅ Use the imported autoTable function directly
      autoTable(doc, {
        startY: 30,
        head: [["Description", "Amount"]],
        body: [
          ["Customer Name", customer.customer_name || "N/A"],
          ["Outstanding Balance", `INR ${customer.outstanding_balance || 0}`],
          [
            "Billing Period",
            new Date().toLocaleString("default", {
              month: "long",
              year: "numeric",
            }),
          ],
        ],
        theme: "grid",
        headStyles: { fillColor: [37, 99, 235] }, // Blue header to match your UI
      });

      doc.save(`Bill_${customer.customer_name || "Customer"}.pdf`);
    } catch (error) {
      console.error("PDF Error:", error);
      alert("Could not generate PDF. Check console for details.");
    }
  };

  const handleApproveSubscription = async (customer) => {
    setRowActionLoadingId(customer.id);
    try {
      await approveAdminCustomerSubscription(customer.id);
      reloadCustomers();
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const openAssignModal = (customer) => {
    setAssignTargetCustomer(customer);
    setSelectedAgentId(customer.assignedSubscriptionAgentId || "");
    setAgentPickerOpen(false);
    setAssignModalOpen(true);
  };

  const handleAssignPartner = async () => {
    if (!selectedAgentId) return;
    setRowActionLoadingId(assignTargetCustomer.id);
    try {
      await assignAdminCustomerPermanentPartner(
        assignTargetCustomer.id,
        Number(selectedAgentId),
      );
      setAssignModalOpen(false);
      reloadCustomers();
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const selectedAgent = agents.find((a) => String(a.id) === String(selectedAgentId));

  return (
    <div className="ds-portal ds-admin-portal min-h-screen bg-[#FAFAF7] text-[#2C1A0E] dark:bg-[#0B0F19] dark:text-white" style={adminShellFont}>
      <AdminMobileTopbar
        adminName={adminName}
        onMenu={() => setSidebarOpen(true)}
      />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="px-4 py-8 pb-32 sm:px-6 lg:ml-64 lg:px-10 xl:ml-80">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
          <div>
            <h1 className="text-3xl sm:text-4xl text-[#2C1A0E] dark:text-white" style={adminHeadingFont}>Customers</h1>
            <p className="font-bold text-[#8B7355] dark:text-[#10B981]">
              Billing & Subscription Management
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#26734D] px-6 py-3.5 font-black !text-white shadow-lg transition-colors hover:bg-[#1E5C3E] sm:w-auto dark:bg-[#169B70] dark:hover:bg-[#11805C]"
            style={{ color: "#FFFFFF" }}
          >
            <UserPlus size={18} />
            Add Customer
          </button>
        </header>

        {/* Desktop View */}
        <div
          className="hidden lg:block overflow-hidden rounded-[32px] border border-[#EDE8DF] dark:border-[#1E293B] bg-white/95 dark:bg-[#121829] shadow-[0_18px_45px_rgba(92,61,30,0.08)] dark:shadow-[0_18px_45px_rgba(0,0,0,0.3)]"
          style={customerPanelStyle}
        >
          <div
            className="flex flex-col items-center justify-between gap-4 border-b border-[#F2EDE4] dark:border-[#1E293B] bg-white/95 dark:bg-[#121829] p-6 md:flex-row"
            style={customerPanelHeaderStyle}
          >
            <div className="relative w-full md:w-96">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89970] dark:text-slate-500"
                size={18}
              />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name or phone..."
                className="w-full rounded-xl border border-[#E5D9C7] dark:border-[#2a2a3a] bg-[#FFFDF8] dark:bg-[#0B0F19] py-3 pl-12 pr-4 font-bold outline-none focus:ring-2 focus:ring-[#C98A42] text-[#2C1A0E] dark:text-white placeholder:dark:text-slate-500"
              />
            </div>
            <div className="text-xs font-black uppercase tracking-widest text-[#C4A882] dark:text-[#d97706]">
              Total Customers: <span className="text-[#B8641A] dark:text-white">{total}</span>
            </div>
          </div>

          <div className="divide-y divide-[#F5EFE6] dark:divide-[#2a2a3a]">
            {loading ? (
              <LoadingIndicator className="py-20" />
            ) : (
              customers.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-4 p-6 transition-all hover:bg-[#FFFDF8] dark:hover:bg-[#222B40] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1">
                    <h4 className="text-lg font-black text-gray-800 dark:text-white">
                      {c.customer_name}
                    </h4>
                    <p className="text-xs font-bold text-gray-400 dark:text-slate-400 uppercase">
                      {c.phone_number}
                    </p>
                    {c.assignedSubscriptionAgentName && (
                      <p className="mt-1 text-[10px] font-black uppercase text-[#B8641A] dark:text-[#d97706]">
                        Partner: {c.assignedSubscriptionAgentName}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center gap-4 sm:gap-6 lg:gap-10">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase">
                        Balance
                      </p>
                      <p
                        className={`text-sm font-black ${c.outstanding_balance < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-[#f87171]"}`}
                      >
                        {c.outstanding_balance < 0
                          ? `Credit ₹${Math.abs(c.outstanding_balance)}`
                          : `₹${c.outstanding_balance || 0}`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <button
                        onClick={() => setInvoiceTarget(c)}
                        className="rounded-xl border border-[#EDE8DF] dark:border-[#2a2a3a] bg-[#FFFDF8] dark:bg-[#0B0F19] p-2.5 text-[#B89970] dark:text-slate-400 hover:text-[#2C1A0E] dark:hover:text-white"
                        title="Bill"
                      >
                        <FileText size={18} />
                      </button>

                      <button
                        onClick={() =>
                          setPaymentTarget({
                            id: c.id,
                            customer_name: c.customer_name,
                            amount_due: c.outstanding_balance || 0,
                          })
                        }
                        className="rounded-xl bg-[#F4F7ED] dark:bg-[#22c55e]/15 px-4 py-2.5 text-[10px] font-black text-[#5C7A35] dark:text-[#22c55e] transition-all hover:bg-[#6F8C45] hover:!text-white dark:hover:bg-[#22c55e] dark:hover:!text-black"
                      >
                        ₹ RECORD
                      </button>

                      {String(c.subscriptionApprovalStatus).toUpperCase() ===
                      "PENDING" ? (
                        <button
                          onClick={() => handleApproveSubscription(c)}
                          className="rounded-xl bg-[#C26D2C] dark:bg-[#d97706] px-4 py-2.5 text-[10px] font-black text-white"
                        >
                          APPROVE
                        </button>
                      ) : (
                        <button
                          onClick={() => openAssignModal(c)}
                          className="rounded-xl bg-[#FDF6EC] dark:bg-[#d97706]/15 px-4 py-2.5 text-[10px] font-black text-[#B8641A] dark:text-[#d97706] transition-all hover:bg-[#FDE9C9] dark:hover:bg-[#d97706]/35"
                        >
                          PARTNER
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedCustomer(c.id)}
                        className="px-4 py-2.5 text-[10px] font-black uppercase text-[#B89970] dark:text-slate-400 hover:text-[#B8641A] dark:hover:text-white"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mobile View */}
        <div className="lg:hidden flex flex-col gap-3">
          <div className="relative w-full">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89970] dark:text-slate-500"
              size={18}
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name or phone..."
              className="w-full rounded-xl border border-[#E5D9C7] dark:border-[#2a2a3a] bg-[#FFFDF8] dark:bg-[#1a1a2e] py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#C98A42] text-[#2C1A0E] dark:text-white placeholder:text-[#B89970] dark:placeholder:text-slate-500"
            />
          </div>

          <div className="text-[11px] font-black uppercase tracking-[0.15em] text-[#d97706] mt-1 mb-0.5 px-1">
            TOTAL CUSTOMERS: {total}
          </div>

          <div className="flex flex-col gap-3">
            {loading ? (
              <LoadingIndicator className="py-12" />
            ) : customers.length === 0 ? (
              <div className="rounded-xl border border-[#EDE8DF] dark:border-[#2a2a3a] bg-white dark:bg-[#1a1a2e] p-8 text-center text-gray-500">
                No customers found.
              </div>
            ) : (
              customers.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: isDark ? '#1a1a2e' : '#ffffff',
                    border: isDark ? '1px solid #2a2a3a' : '1px solid #EDE8DF',
                    borderLeft: isDark ? '4px solid #d97706' : '4px solid #B8641A',
                  }}
                >
                  {/* Top Info block */}
                  <div className="flex justify-between items-start px-4 pt-4 pb-2">
                    <div className="flex-1 min-w-0 pr-3">
                      <h4 className="text-[16px] font-bold text-[#2C1A0E] dark:text-white truncate leading-snug">
                        {c.customer_name}
                      </h4>
                      <p className="text-[12px] text-gray-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {c.phone_number}
                      </p>
                      {c.assignedSubscriptionAgentName && (
                        <p className="mt-1 text-[11px] font-extrabold uppercase text-[#B8641A] dark:text-[#d97706] leading-snug">
                          PARTNER: {String(c.assignedSubscriptionAgentName).toUpperCase()}
                        </p>
                      )}
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        BALANCE
                      </p>
                      <p
                        className={`text-xl font-bold mt-0.5 leading-tight ${
                          c.outstanding_balance < 0 ? "text-emerald-500" : "text-[#EF4444] dark:text-[#f87171]"
                        }`}
                      >
                        {c.outstanding_balance < 0
                          ? `Credit ₹${Math.abs(c.outstanding_balance).toLocaleString()}`
                          : `₹${(c.outstanding_balance || 0).toLocaleString()}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center justify-between px-4 pb-3.5 pt-1">
                    <div className="flex items-center gap-2.5">
                      {/* Invoice/Bill icon */}
                      <button
                        onClick={() => setInvoiceTarget(c)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#EDE8DF] dark:border-[#2a2a3a] bg-transparent text-[#B89970] dark:text-slate-400 hover:bg-[#FDF6EC] dark:hover:bg-[#222B40] transition"
                        title="Bill"
                      >
                        <FileText size={16} />
                      </button>

                      {/* Record Payment Button - green pill */}
                      <button
                        onClick={() =>
                          setPaymentTarget({
                            id: c.id,
                            customer_name: c.customer_name,
                            amount_due: c.outstanding_balance || 0,
                          })
                        }
                        className="rounded-full bg-[#22c55e] hover:bg-[#16a34a] text-white px-4 py-1.5 text-[12px] font-bold tracking-wide transition whitespace-nowrap"
                      >
                        ₹ RECORD
                      </button>

                      {/* Partner / Approve text */}
                      {String(c.subscriptionApprovalStatus).toUpperCase() === "PENDING" ? (
                        <button
                          onClick={() => handleApproveSubscription(c)}
                          className="text-[12px] font-bold text-[#22c55e] hover:underline uppercase px-1 whitespace-nowrap"
                        >
                          APPROVE
                        </button>
                      ) : (
                        <button
                          onClick={() => openAssignModal(c)}
                          className="text-[12px] font-bold text-[#22c55e] hover:underline uppercase px-1 whitespace-nowrap"
                        >
                          PARTNER
                        </button>
                      )}
                    </div>

                    {/* View Button */}
                    <button
                      onClick={() => setSelectedCustomer(c.id)}
                      className="text-[12px] font-semibold uppercase text-slate-400 dark:text-slate-500 hover:text-[#d97706] dark:hover:text-white transition whitespace-nowrap"
                    >
                      VIEW
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* MODALS */}
      <Suspense fallback={null}>
      {paymentTarget && (
        <ManualPaymentModal
          delivery={paymentTarget}
          onSave={handleSavePayment}
          onClose={() => setPaymentTarget(null)}
        />
      )}

      {invoiceTarget && (
    <InvoicePreviewModal
      customer={invoiceTarget}
      adminName={adminName} // Now this variable exists!
      dairyName={invoiceTarget?.dairy_name || "DairyVision"} // Uses customer's dairy info
      onClose={() => setInvoiceTarget(null)}
    />
  )}

      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-[32px] border p-8 shadow-2xl"
            style={{
              background: isDark ? "#121829" : "#ffffff",
              borderColor: isDark ? "#1E293B" : "#EDE8DF",
              color: isDark ? "#ffffff" : "#2C1A0E",
            }}
          >
            <h3 className="text-xl font-black mb-1 text-[#2C1A0E] dark:text-white">Assign Partner</h3>
            <p className="text-sm font-bold text-gray-400 dark:text-slate-400 mb-6">
              {assignTargetCustomer?.customer_name}
            </p>
            <div className="mb-6">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">
                Delivery Agent
              </p>
              <button
                type="button"
                onClick={() => setAgentPickerOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] px-4 py-3.5 text-left font-bold text-[#2C1A0E] outline-none transition focus:ring-2 focus:ring-[#C98A42] dark:border-[#d97706] dark:bg-[#161C2C] dark:text-white"
              >
                <span className="flex min-w-0 flex-1 items-center justify-between gap-4">
                  {selectedAgent ? (
                    <>
                      <span className="truncate text-base font-black">{selectedAgent.agent_name}</span>
                      <span className="shrink-0 text-sm font-bold text-gray-400 dark:text-slate-400">
                        {selectedAgent.phone_number}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-400 dark:text-slate-400">Select Delivery Agent</span>
                  )}
                </span>
                <ChevronRight
                  size={18}
                  className={`shrink-0 text-gray-400 transition-transform dark:text-slate-400 ${
                    agentPickerOpen ? "rotate-90" : ""
                  }`}
                />
              </button>

              {agentPickerOpen && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-[#E5D9C7] bg-white p-1 shadow-xl dark:border-[#222B40] dark:bg-[#0B0F19]">
                  {agents.length === 0 ? (
                    <div className="px-4 py-3 text-sm font-bold text-gray-400 dark:text-slate-400">
                      No agents available
                    </div>
                  ) : (
                    agents.map((a) => {
                      const isSelected = String(a.id) === String(selectedAgentId);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            setSelectedAgentId(a.id);
                            setAgentPickerOpen(false);
                          }}
                          className={`flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left transition ${
                            isSelected
                              ? "bg-[#FDF6EC] text-[#B8641A] dark:bg-[#1C243A] dark:text-white"
                              : "text-[#2C1A0E] hover:bg-[#FDF6EC] dark:text-white dark:hover:bg-[#161C2C]"
                          }`}
                        >
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-4">
                            <span className={`truncate text-sm font-black ${isSelected ? "dark:text-[#fbbf24]" : ""}`}>
                              {a.agent_name}
                            </span>
                            <span className="shrink-0 text-xs font-bold text-gray-400 dark:text-slate-400">
                              {a.phone_number}
                            </span>
                          </span>
                          {isSelected && <UserCheck size={16} className="shrink-0 text-[#d97706]" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setAssignModalOpen(false)}
                className="flex-1 rounded-2xl border border-[#EDE8DF] bg-white py-4 font-bold text-[#8B7355] transition hover:bg-[#FDF6EC] dark:border-slate-800 dark:bg-[#121829] dark:text-slate-400 dark:hover:bg-slate-900/50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignPartner}
                className="flex-[2] rounded-2xl bg-[#B8641A] py-4 font-extrabold text-white transition hover:bg-[#9E5415]"
              >
                Save Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <CustomerDrawer
          customerId={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onChanged={reloadCustomers}
        />
      )}

      <AddCustomerModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreated={(c) => {
          reloadCustomers();
          setCreatedCustomer(c);
          setIsSubscriptionModalOpen(true);
        }}
      />
      <AddCustomerSubscriptionModal
        open={isSubscriptionModalOpen}
        customer={createdCustomer}
        onClose={() => {
          setIsSubscriptionModalOpen(false);
          setCreatedCustomer(null);
        }}
        onSaved={reloadCustomers}
      />
      </Suspense>
      <AdminMobileBottomNav />
    </div>
  );
}
