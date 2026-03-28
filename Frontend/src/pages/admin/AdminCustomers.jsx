import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // Import it as a function
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
import CustomerDrawer from "../../components/customer/CustomerDrawer";
import AddCustomerModal from "../../components/customer/AddCustomerModal.jsx";
import AddCustomerSubscriptionModal from "../../components/customer/AddCustomerSubscriptionModal.jsx";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import ManualPaymentModal from "../../components/admin/sections/ManualPaymentModal";
import InvoicePreviewModal from "../../components/admin/sections/InvoicePreviewModal.jsx";
import { adminHeadingFont, adminShellFont } from "../../components/admin/adminTheme";
export default function AdminCustomers() {
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

  const handleGenerateBill = (customer) => {
    try {
      const doc = new jsPDF();

      doc.setFontSize(22);
      doc.text("DAIRYSTREAM", 14, 20);

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

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#2C1A0E]" style={adminShellFont}>
      <AdminMobileTopbar
        title="Customers"
        onMenu={() => setSidebarOpen(true)}
      />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="px-4 py-8 sm:px-6 lg:ml-64 lg:px-10">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-4xl text-[#2C1A0E]" style={adminHeadingFont}>Customers</h1>
            <p className="font-bold text-[#8B7355]">
              Billing & Subscription Management
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-2xl bg-[#B8641A] px-6 py-3 font-black text-white shadow-lg transition-all hover:bg-[#9E5415]"
          >
            + Add Customer
          </button>
        </header>

        <div className="overflow-hidden rounded-[32px] border border-[#EDE8DF] bg-white/95 shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
          <div className="flex flex-col items-center justify-between gap-4 border-b border-[#F2EDE4] p-6 md:flex-row">
            <div className="relative w-full md:w-96">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89970]"
                size={18}
              />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name or phone..."
                className="w-full rounded-xl border border-[#E5D9C7] bg-[#FFFDF8] py-3 pl-12 pr-4 font-bold outline-none focus:ring-2 focus:ring-[#C98A42]"
              />
            </div>
            <div className="text-xs font-black uppercase tracking-widest text-[#C4A882]">
              Total Customers: <span className="text-[#B8641A]">{total}</span>
            </div>
          </div>

          <div className="divide-y divide-[#F5EFE6]">
            {loading ? (
              <LoadingIndicator className="py-20" />
            ) : (
              customers.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col justify-between gap-6 p-6 transition-all hover:bg-[#FFFDF8] md:flex-row md:items-center"
                >
                  <div className="flex-1">
                    <h4 className="text-lg font-black text-gray-800">
                      {c.customer_name}
                    </h4>
                    <p className="text-xs font-bold text-gray-400 uppercase">
                      {c.phone_number}
                    </p>
                    {c.assignedSubscriptionAgentName && (
                      <p className="mt-1 text-[10px] font-black uppercase text-[#B8641A]">
                        Partner: {c.assignedSubscriptionAgentName}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-10">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase">
                        Balance
                      </p>
                      <p
                        className={`text-sm font-black ${c.outstanding_balance < 0 ? "text-emerald-600" : "text-red-500"}`}
                      >
                        {c.outstanding_balance < 0
                          ? `Credit ₹${Math.abs(c.outstanding_balance)}`
                          : `₹${c.outstanding_balance || 0}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setInvoiceTarget(c)}
                        className="rounded-xl border border-[#EDE8DF] bg-[#FFFDF8] p-2.5 text-[#B89970] hover:text-[#2C1A0E]"
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
                        className="rounded-xl bg-[#F4F7ED] px-4 py-2.5 text-[10px] font-black text-[#5C7A35] transition-all hover:bg-[#6F8C45] hover:text-white"
                      >
                        ₹ RECORD
                      </button>

                      {String(c.subscriptionApprovalStatus).toUpperCase() ===
                      "PENDING" ? (
                        <button
                          onClick={() => handleApproveSubscription(c)}
                          className="rounded-xl bg-[#C26D2C] px-4 py-2.5 text-[10px] font-black text-white"
                        >
                          APPROVE
                        </button>
                      ) : (
                        <button
                          onClick={() => openAssignModal(c)}
                          className="rounded-xl bg-[#FDF6EC] px-4 py-2.5 text-[10px] font-black text-[#B8641A] transition-all hover:bg-[#B8641A] hover:text-white"
                        >
                          PARTNER
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedCustomer(c.id)}
                        className="px-4 py-2.5 text-[10px] font-black uppercase text-[#B89970] hover:text-[#B8641A]"
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
      </main>

      {/* MODALS */}
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
      dairyName={invoiceTarget?.dairy_name || "DairyStream"} // Uses customer's dairy info
      onClose={() => setInvoiceTarget(null)}
    />
  )}

      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl">
            <h3 className="text-xl font-black mb-1">Assign Partner</h3>
            <p className="text-sm font-bold text-gray-400 mb-6">
              {assignTargetCustomer?.customer_name}
            </p>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-blue-500 mb-6"
            >
              <option value="">Select Delivery Agent</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.agent_name} ({a.phone_number})
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => setAssignModalOpen(false)}
                className="flex-1 font-bold text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignPartner}
                className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black"
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
    </div>
  );
}
