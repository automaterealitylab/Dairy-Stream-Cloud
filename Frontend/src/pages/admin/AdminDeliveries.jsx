import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminDeliveries,
  fetchAdminDeliverySchedulingOptions,
  scheduleAdminDelivery,
  scheduleAdminDeliveriesBulk,
} from "../../api/admin.api";
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";

// --- Utilities & Constants ---
const statusStyles = {
  DELIVERED: "bg-green-100 text-green-700 border-green-200",
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  FAILED: "bg-red-100 text-red-700 border-red-200",
};

const toQuantityValue = (value) => {
  const parsed = Number.parseFloat(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDateTimestamp = (value) => {
  if (!value) return 0;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).getTime();
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDate = (value) => {
  const timestamp = toDateTimestamp(value);
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getTodayDateInput = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// --- Sub-components ---
function StatusPill({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${statusStyles[status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {status}
    </span>
  );
}

const FeedbackBanner = ({ feedback }) => {
  if (!feedback?.message) return null;
  const isSuccess = feedback.type === "success";
  return (
    <div className={`mt-4 p-3 rounded-lg text-sm font-medium border ${isSuccess ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}>
      {isSuccess ? "✓ " : "✕ "} {feedback.message}
    </div>
  );
};

// --- Main Component ---
export default function AdminDeliveries() {
  const [activeTab, setActiveTab] = useState("bulk"); // 'bulk' | 'single'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deliveries, setDeliveries] = useState([]);

  const [optionsLoading, setOptionsLoading] = useState(true);
  const [scheduleOptions, setScheduleOptions] = useState({ customers: [], agents: [] });

  const [singleForm, setSingleForm] = useState({
    customerId: "",
    agentId: "",
    deliveryDate: getTodayDateInput(),
    notes: "",
  });
  const [singleSubmitting, setSingleSubmitting] = useState(false);
  const [singleFeedback, setSingleFeedback] = useState({ type: "", message: "" });

  const [bulkForm, setBulkForm] = useState({
    deliveryDate: getTodayDateInput(),
    agentId: "",
    slot: "ALL",
    route: "ALL",
    notes: "",
  });
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState({ type: "", message: "" });
  const [bulkSummary, setBulkSummary] = useState(null);

  // Filters State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("ALL");
  const [routeFilter, setRouteFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const loadDeliveries = async () => {
    const response = await fetchAdminDeliveries();
    setDeliveries(Array.isArray(response?.deliveries) ? response.deliveries : []);
  };

  const loadSchedulingOptions = async () => {
    const response = await fetchAdminDeliverySchedulingOptions();
    setScheduleOptions({
      customers: Array.isArray(response?.customers) ? response.customers : [],
      agents: Array.isArray(response?.agents) ? response.agents : [],
    });
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setOptionsLoading(true);
      try {
        const [deliveryData, optionsData] = await Promise.all([
          fetchAdminDeliveries(),
          fetchAdminDeliverySchedulingOptions(),
        ]);
        if (!active) return;
        setDeliveries(Array.isArray(deliveryData?.deliveries) ? deliveryData.deliveries : []);
        setScheduleOptions({
          customers: Array.isArray(optionsData?.customers) ? optionsData.customers : [],
          agents: Array.isArray(optionsData?.agents) ? optionsData.agents : [],
        });
      } catch (err) {
        if (!active) return;
        setLoadError(err?.message || "Failed to load data.");
      } finally {
        if (active) {
          setLoading(false);
          setOptionsLoading(false);
        }
      }
    };
    load();
    return () => { active = false; };
  }, []);

  // --- Memos ---
  const selectedScheduleCustomer = useMemo(() => {
    return scheduleOptions.customers.find((c) => String(c.id) === String(singleForm.customerId)) || null;
  }, [singleForm.customerId, scheduleOptions.customers]);

  const bulkRoutes = useMemo(() => {
    return [...new Set(scheduleOptions.customers.map((item) => item.route).filter(Boolean))].sort();
  }, [scheduleOptions.customers]);

  const bulkPreviewCount = useMemo(() => {
    return scheduleOptions.customers.filter((item) => {
      const matchesSlot = bulkForm.slot === "ALL" || String(item.slot || "").toUpperCase() === bulkForm.slot;
      const matchesRoute = bulkForm.route === "ALL" || String(item.route || "").toLowerCase() === bulkForm.route.toLowerCase();
      return matchesSlot && matchesRoute;
    }).length;
  }, [scheduleOptions.customers, bulkForm.slot, bulkForm.route]);

  const filterOptions = useMemo(() => {
    const agents = [...new Set(deliveries.map((d) => d.agentName).filter(Boolean))].sort();
    const routes = [...new Set(deliveries.map((d) => d.route).filter(Boolean))].sort();
    return { agents, routes };
  }, [deliveries]);

  const filteredAndSortedDeliveries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = deliveries.filter((d) => {
      const searchableText = `${d.id} ${d.customerName} ${d.agentName} ${d.route}`.toLowerCase();
      return (
        (!q || searchableText.includes(q)) &&
        (statusFilter === "ALL" || d.status === statusFilter) &&
        (!dateFilter || d.date === dateFilter) &&
        (agentFilter === "ALL" || d.agentName === agentFilter) &&
        (routeFilter === "ALL" || d.route === routeFilter)
      );
    });

    return [...filtered].sort((a, b) => {
      let comp = 0;
      if (sortBy === "date") comp = toDateTimestamp(a.date) - toDateTimestamp(b.date);
      else if (sortBy === "customer") comp = a.customerName.localeCompare(b.customerName);
      else if (sortBy === "agent") comp = (a.agentName || "").localeCompare(b.agentName || "");
      else if (sortBy === "status") comp = a.status.localeCompare(b.status);
      else if (sortBy === "quantity") comp = toQuantityValue(a.quantity) - toQuantityValue(b.quantity);
      return sortOrder === "asc" ? comp : -comp;
    });
  }, [deliveries, search, statusFilter, dateFilter, agentFilter, routeFilter, sortBy, sortOrder]);

  const stats = useMemo(() => ({
    total: filteredAndSortedDeliveries.length,
    delivered: filteredAndSortedDeliveries.filter(d => d.status === "DELIVERED").length,
    pending: filteredAndSortedDeliveries.filter(d => d.status === "PENDING").length,
    failed: filteredAndSortedDeliveries.filter(d => d.status === "FAILED").length,
  }), [filteredAndSortedDeliveries]);

  const paginatedDeliveries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedDeliveries.slice(start, start + pageSize);
  }, [filteredAndSortedDeliveries, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedDeliveries.length / pageSize));

  // --- Handlers ---
  const handleScheduleSingle = async (e) => {
    e.preventDefault();
    setSingleFeedback({ type: "", message: "" });
    setSingleSubmitting(true);
    try {
      await scheduleAdminDelivery({
        customerId: Number(singleForm.customerId),
        agentId: singleForm.agentId ? Number(singleForm.agentId) : null,
        deliveryDate: singleForm.deliveryDate,
        notes: singleForm.notes || null,
      });
      await Promise.all([loadDeliveries(), loadSchedulingOptions()]);
      setSingleFeedback({ type: "success", message: "Delivery scheduled successfully." });
      setSingleForm({ customerId: "", agentId: "", deliveryDate: getTodayDateInput(), notes: "" });
    } catch (err) {
      setSingleFeedback({ type: "error", message: err.message });
    } finally { setSingleSubmitting(false); }
  };

  const handleScheduleBulk = async (e) => {
    e.preventDefault();
    setBulkFeedback({ type: "", message: "" });
    setBulkSubmitting(true);
    try {
      const res = await scheduleAdminDeliveriesBulk(bulkForm);
      await Promise.all([loadDeliveries(), loadSchedulingOptions()]);
      setBulkSummary(res?.summary || null);
      setBulkFeedback({ type: "success", message: "Bulk scheduling complete." });
    } catch (err) {
      setBulkFeedback({ type: "error", message: err.message });
    } finally { setBulkSubmitting(false); }
  };

  const resetFilters = () => {
    setSearch(""); setStatusFilter("ALL"); setDateFilter(""); setAgentFilter("ALL");
    setRouteFilter("ALL"); setSortBy("date"); setSortOrder("desc"); setPage(1);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 lg:ml-64 w-full transition-all duration-300">
        <AdminMobileTopbar title="Deliveries" onMenu={() => setSidebarOpen(true)} />

        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Delivery Management</h1>
              <p className="text-slate-500 text-sm">Organize and monitor distribution runs.</p>
            </div>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total", val: stats.total, color: "text-slate-700" },
                { label: "Delivered", val: stats.delivered, color: "text-green-600" },
                { label: "Pending", val: stats.pending, color: "text-amber-600" },
                { label: "Failed", val: stats.failed, color: "text-red-600" }
              ].map((item) => (
                <div key={item.label} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm min-w-[100px]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                  <p className={`text-xl font-bold ${item.color}`}>{item.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Scheduling Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
            <div className="flex bg-slate-50/50 border-b border-slate-200">
              <button 
                onClick={() => setActiveTab("bulk")}
                className={`px-6 py-4 text-sm font-bold transition-all ${activeTab === "bulk" ? "text-blue-600 border-b-2 border-blue-600 bg-white" : "text-slate-500 hover:bg-slate-100"}`}
              >
                Bulk Distribution Run
              </button>
              <button 
                onClick={() => setActiveTab("single")}
                className={`px-6 py-4 text-sm font-bold transition-all ${activeTab === "single" ? "text-blue-600 border-b-2 border-blue-600 bg-white" : "text-slate-500 hover:bg-slate-100"}`}
              >
                Single Exception
              </button>
            </div>

            <div className="p-6">
              {activeTab === "bulk" ? (
                <form onSubmit={handleScheduleBulk} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Distribution Date</label>
                      <input type="date" value={bulkForm.deliveryDate} onChange={(e) => setBulkForm(p => ({...p, deliveryDate: e.target.value}))} className="pro-input w-full" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Assigned Agent</label>
                      <select value={bulkForm.agentId} onChange={(e) => setBulkForm(p => ({...p, agentId: e.target.value}))} className="pro-input w-full text-sm">
                        <option value="">Auto-Assign (Based on Route)</option>
                        {scheduleOptions.agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.route})</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Slot</label>
                        <select value={bulkForm.slot} onChange={(e) => setBulkForm(p => ({...p, slot: e.target.value}))} className="pro-input w-full text-sm">
                          <option value="ALL">All Slots</option>
                          <option value="MORNING">Morning</option>
                          <option value="EVENING">Evening</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Route</label>
                        <select value={bulkForm.route} onChange={(e) => setBulkForm(p => ({...p, route: e.target.value}))} className="pro-input w-full text-sm">
                          <option value="ALL">All Routes</option>
                          {bulkRoutes.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <textarea value={bulkForm.notes} onChange={(e) => setBulkForm(p => ({...p, notes: e.target.value}))} placeholder="Notes for this distribution run..." className="pro-input w-full h-20 text-sm" />
                  
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                    <div className="text-sm font-medium text-blue-700 bg-blue-50 px-4 py-2 rounded-full border border-blue-100">
                      Eligible customers found: <span className="font-bold">{bulkPreviewCount}</span>
                    </div>
                    <button type="submit" disabled={bulkSubmitting || bulkPreviewCount === 0} className="pro-btn-primary w-full sm:w-auto px-8 py-2.5">
                      {bulkSubmitting ? "Processing..." : "Start Distribution Run"}
                    </button>
                  </div>
                  <FeedbackBanner feedback={bulkFeedback} />
                </form>
              ) : (
                <form onSubmit={handleScheduleSingle} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Search Customer</label>
                      <select value={singleForm.customerId} onChange={(e) => setSingleForm(p => ({...p, customerId: e.target.value}))} className="pro-input w-full text-sm" required>
                        <option value="">Select Subscribed Customer</option>
                        {scheduleOptions.customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.route} ({c.quantityLiters}L)</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Date</label>
                        <input type="date" value={singleForm.deliveryDate} onChange={(e) => setSingleForm(p => ({...p, deliveryDate: e.target.value}))} className="pro-input w-full" required />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Agent</label>
                        <select value={singleForm.agentId} onChange={(e) => setSingleForm(p => ({...p, agentId: e.target.value}))} className="pro-input w-full text-sm">
                          <option value="">Unassigned</option>
                          {scheduleOptions.agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <textarea value={singleForm.notes} onChange={(e) => setSingleForm(p => ({...p, notes: e.target.value}))} placeholder="Special instructions for this specific delivery..." className="pro-input w-full h-20 text-sm" />
                  
                  <div className="flex justify-end pt-2">
                    <button type="submit" disabled={singleSubmitting} className="pro-btn-dark w-full sm:w-64 py-2.5">
                      {singleSubmitting ? "Scheduling..." : "Create Exception Delivery"}
                    </button>
                  </div>
                  <FeedbackBanner feedback={singleFeedback} />
                </form>
              )}
            </div>
          </section>

          {/* Delivery Log Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-4 items-center justify-between bg-slate-50/30">
              <div className="relative w-full lg:w-96">
                <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                <input 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by ID, Customer, Agent or Route..." 
                  className="pro-input w-full pl-10 text-sm py-2" 
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="pro-input text-[13px] py-1.5 flex-1 lg:flex-none">
                  <option value="ALL">All Status</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                </select>
                <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="pro-input text-[13px] py-1.5 flex-1 lg:flex-none" />
                <button onClick={resetFilters} className="text-xs font-bold text-blue-600 hover:text-blue-800 px-3 uppercase tracking-wider transition-colors">
                  Reset Filters
                </button>
              </div>
            </div>

            {/* Content Area */}
            {loading ? (
              <div className="py-20"><LoadingIndicator message="Fetching logs..." /></div>
            ) : paginatedDeliveries.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-slate-400 font-medium">No distribution logs found for selected criteria.</p>
                <button onClick={resetFilters} className="mt-2 text-blue-600 underline text-sm">Clear all filters</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                      <th className="px-6 py-4 font-bold">ID</th>
                      <th className="px-6 py-4 font-bold">Customer</th>
                      <th className="px-6 py-4 font-bold">Logistics</th>
                      <th className="px-6 py-4 font-bold">Schedule</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedDeliveries.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 text-xs font-bold text-slate-400 group-hover:text-slate-900">#{d.id}</td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-800">{d.customerName}</p>
                          <p className="text-[11px] text-slate-500">{d.route}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{d.agentName || "Unassigned"}</p>
                          <p className="text-[11px] text-slate-400 italic">Qty: {d.quantity}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-800">{formatDate(d.date)}</p>
                          <p className="text-[11px] font-medium text-slate-500">{d.slot}</p>
                        </td>
                        <td className="px-6 py-4">
                          <StatusPill status={d.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Showing {Math.min(filteredAndSortedDeliveries.length, (page - 1) * pageSize + 1)} - {Math.min(page * pageSize, filteredAndSortedDeliveries.length)} of {filteredAndSortedDeliveries.length}
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 text-xs font-bold border rounded bg-white hover:bg-slate-50 disabled:opacity-50 transition-all"
                >
                  Prev
                </button>
                <button 
                  disabled={page === totalPages} 
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 text-xs font-bold border rounded bg-white hover:bg-slate-50 disabled:opacity-50 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}