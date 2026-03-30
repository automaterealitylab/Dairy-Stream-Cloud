import { useEffect, useMemo, useState } from "react";
import {
  assignAdminDeliveryPartner,
  approveAdminDelivery,
  approveAllAdminDeliveries,
  fetchAdminDeliveries,
  fetchAdminDeliverySchedulingOptions,
  resolveAdminDeliveryIssue,
  scheduleAdminDelivery,
  scheduleAdminDeliveriesBulk,
} from "../../api/admin.api";
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import { adminHeadingFont, adminShellFont } from "../../components/admin/adminTheme";

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

const naturalCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

const compareLocationPart = (left, right) =>
  naturalCollator.compare(String(left || "").trim(), String(right || "").trim());

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
  const RESOLVE_ACTION_OPTIONS = [
    "Replacement milk sent",
    "Refund initiated",
    "Delivery partner warned",
    "Quality issue escalated to dairy team",
    "Customer contacted and issue clarified",
  ];

  const [activeTab, setActiveTab] = useState("bulk"); // 'bulk' | 'single'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deliveries, setDeliveries] = useState([]);

  const [scheduleOptions, setScheduleOptions] = useState({ customers: [], agents: [] });

  const [singleForm, setSingleForm] = useState({
    customerId: "",
    agentId: "",
    deliveryDate: getTodayDateInput(),
    notes: "",
  });
  const [singleSubmitting, setSingleSubmitting] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [resolvingIssueId, setResolvingIssueId] = useState(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveTargetDelivery, setResolveTargetDelivery] = useState(null);
  const [resolveAction, setResolveAction] = useState("Replacement milk sent");
  const [resolveCustomAction, setResolveCustomAction] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetDelivery, setAssignTargetDelivery] = useState(null);
  const [selectedAssignAgentId, setSelectedAssignAgentId] = useState("");
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
  const [dateFilter, setDateFilter] = useState(getTodayDateInput());
  const [agentFilter, setAgentFilter] = useState("ALL");
  const [routeFilter, setRouteFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const pageSize = 25;

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
      const searchableText = `${d.id} ${d.customerName} ${d.agentName} ${d.route} ${d.buildingName} ${d.wingOrFloor} ${d.roomNo} ${d.deliveryType}`.toLowerCase();
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
    pendingApproval: filteredAndSortedDeliveries.filter(d => d.approvalStatus === "PENDING").length,
  }), [filteredAndSortedDeliveries]);

  const paginatedDeliveries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedDeliveries.slice(start, start + pageSize);
  }, [filteredAndSortedDeliveries, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedDeliveries.length / pageSize));

  const groupedTodayDeliveries = useMemo(() => {
    const groups = new Map();

    paginatedDeliveries.forEach((delivery) => {
      const buildingName = delivery.buildingName || "Unknown Building";
      if (!groups.has(buildingName)) {
        groups.set(buildingName, []);
      }
      groups.get(buildingName).push(delivery);
    });

    return [...groups.entries()]
      .sort((left, right) => compareLocationPart(left[0], right[0]))
      .map(([buildingName, entries]) => ({
        buildingName,
        deliveries: [...entries].sort((left, right) => {
          const wingCompare = compareLocationPart(left.wingOrFloor, right.wingOrFloor);
          if (wingCompare !== 0) return wingCompare;

          const roomCompare = compareLocationPart(left.roomNo, right.roomNo);
          if (roomCompare !== 0) return roomCompare;

          return compareLocationPart(left.customerName, right.customerName);
        }),
      }));
  }, [paginatedDeliveries]);

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
    setSearch(""); setStatusFilter("ALL"); setDateFilter(getTodayDateInput()); setAgentFilter("ALL");
    setRouteFilter("ALL"); setSortBy("date"); setSortOrder("desc"); setPage(1);
  };

  const handleApproveOne = async (delivery) => {
    if (!delivery?.rawId) return;
    setSingleFeedback({ type: "", message: "" });
    setApprovingId(delivery.rawId);
    try {
      const res = await approveAdminDelivery(delivery.rawId);
      await loadDeliveries();
      setSingleFeedback({
        type: "success",
        message: res?.autoAssignedAgentId
          ? `Order ${delivery.id} approved and auto-assigned.`
          : `Order ${delivery.id} approved.`,
      });
    } catch (err) {
      setSingleFeedback({ type: "error", message: err?.message || "Failed to approve order." });
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveAll = async () => {
    setBulkFeedback({ type: "", message: "" });
    setApprovingAll(true);
    try {
      const res = await approveAllAdminDeliveries();
      await loadDeliveries();
      setBulkFeedback({
        type: "success",
        message:
          res?.autoAssignedCount > 0
            ? `Approved ${res?.approvedCount || 0} pending order(s) and auto-assigned ${res.autoAssignedCount}.`
            : `Approved ${res?.approvedCount || 0} pending order(s).`,
      });
    } catch (err) {
      setBulkFeedback({ type: "error", message: err?.message || "Failed to approve all pending orders." });
    } finally {
      setApprovingAll(false);
    }
  };

  const handleAssignPartner = (delivery) => {
    if (!delivery?.rawId) return;
    if (!Array.isArray(scheduleOptions?.agents) || scheduleOptions.agents.length === 0) {
      setSingleFeedback({ type: "error", message: "No delivery partners available to assign." });
      return;
    }

    setAssignTargetDelivery(delivery);
    setSelectedAssignAgentId("");
    setAssignModalOpen(true);
  };

  const openResolveIssueModal = (delivery) => {
    if (!delivery?.rawId) return;
    setResolveTargetDelivery(delivery);
    setResolveAction("Replacement milk sent");
    setResolveCustomAction("");
    setResolveModalOpen(true);
  };

  const handleResolveIssue = async () => {
    if (!resolveTargetDelivery?.rawId) return;

    const note =
      resolveAction === "OTHER"
        ? String(resolveCustomAction || "").trim()
        : resolveAction;

    if (!note) {
      setSingleFeedback({ type: "error", message: "Please enter action taken." });
      return;
    }

    setSingleFeedback({ type: "", message: "" });
    setResolvingIssueId(resolveTargetDelivery.rawId);
    try {
      await resolveAdminDeliveryIssue(resolveTargetDelivery.rawId, note);
      await loadDeliveries();
      setSingleFeedback({
        type: "success",
        message: `Issue resolved for ${resolveTargetDelivery.id}.`,
      });
      setResolveModalOpen(false);
      setResolveTargetDelivery(null);
      setResolveCustomAction("");
    } catch (err) {
      setSingleFeedback({
        type: "error",
        message: err?.message || "Failed to resolve issue.",
      });
    } finally {
      setResolvingIssueId(null);
    }
  };

  const handleConfirmAssignPartner = async () => {
    if (!assignTargetDelivery?.rawId) return;
    const chosenAgentId = Number(selectedAssignAgentId);
    if (!Number.isFinite(chosenAgentId) || chosenAgentId <= 0) {
      setSingleFeedback({ type: "error", message: "Select a delivery partner." });
      return;
    }

    setSingleFeedback({ type: "", message: "" });
    setAssigningId(assignTargetDelivery.rawId);
    try {
      await assignAdminDeliveryPartner(assignTargetDelivery.rawId, chosenAgentId);
      await loadDeliveries();
      setSingleFeedback({ type: "success", message: `Delivery partner assigned for ${assignTargetDelivery.id}.` });
      setAssignModalOpen(false);
      setAssignTargetDelivery(null);
      setSelectedAssignAgentId("");
    } catch (err) {
      setSingleFeedback({ type: "error", message: err?.message || "Failed to assign delivery partner." });
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAF7] text-[#2C1A0E]" style={adminShellFont}>
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 lg:ml-64 w-full transition-all duration-300">
        <AdminMobileTopbar title="Deliveries" onMenu={() => setSidebarOpen(true)} />

        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-4xl text-[#2C1A0E]" style={adminHeadingFont}>Delivery Management</h1>
              <p className="text-sm text-[#8B7355]">Approve buy-once and subscription extra orders, then route today&apos;s deliveries by building, wing/floor, and room.</p>
            </div>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[ 
                { label: "Total", val: stats.total, color: "text-slate-700" },
                { label: "Delivered", val: stats.delivered, color: "text-green-600" },
                { label: "Pending", val: stats.pending, color: "text-amber-600" },
                { label: "Failed", val: stats.failed, color: "text-red-600" },
                { label: "Approval Pending", val: stats.pendingApproval, color: "text-indigo-600" }
              ].map((item) => (
                <div key={item.label} className="min-w-[100px] rounded-xl border border-[#EDE8DF] bg-white/95 p-3 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#C4A882]">{item.label}</p>
                  <p className={`text-xl font-bold ${item.color}`}>{item.val}</p>
                </div>
              ))}
            </div>
          </div>

          {loadError ? <FeedbackBanner feedback={{ type: "error", message: loadError }} /> : null}

          {/* Scheduling Section */}
          <section className="mb-8 overflow-hidden rounded-[28px] border border-[#EDE8DF] bg-white/95 shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
            <div className="flex border-b border-[#F2EDE4] bg-[#FFFDF8]">
              <button 
                onClick={() => setActiveTab("bulk")}
                className={`px-6 py-4 text-sm font-bold transition-all ${activeTab === "bulk" ? "border-b-2 border-[#B8641A] bg-white text-[#B8641A]" : "text-[#8B7355] hover:bg-[#FDF6EC]"}`}
              >
                Bulk Distribution Run
              </button>
              <button 
                onClick={() => setActiveTab("single")}
                className={`px-6 py-4 text-sm font-bold transition-all ${activeTab === "single" ? "border-b-2 border-[#B8641A] bg-white text-[#B8641A]" : "text-[#8B7355] hover:bg-[#FDF6EC]"}`}
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
                        {scheduleOptions.agents.map(a => (
                          <option key={a.id} value={a.id} disabled={!a.isActive}>
                            {a.name} ({a.route}) - {a.status || "ACTIVE"} / {a.availability || "AVAILABLE"}
                          </option>
                        ))}
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
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleApproveAll}
                      disabled={approvingAll || stats.pendingApproval === 0}
                      className="pro-btn-dark w-full sm:w-auto px-5 py-2.5"
                    >
                      {approvingAll ? "Approving..." : "Approve All Orders"}
                    </button>
                    <button type="submit" disabled={bulkSubmitting || bulkPreviewCount === 0} className="pro-btn-primary w-full sm:w-auto px-8 py-2.5">
                      {bulkSubmitting ? "Processing..." : "Start Distribution Run"}
                    </button>
                  </div>
                </div>
                <FeedbackBanner feedback={bulkFeedback} />
                {bulkSummary ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { label: "Eligible", value: bulkSummary.eligibleCustomers || 0 },
                      { label: "Created", value: bulkSummary.createdCount || 0 },
                      { label: "Existing", value: bulkSummary.skippedExistingCount || 0 },
                      { label: "Filtered Out", value: bulkSummary.skippedByFilterCount || 0 },
                      { label: "No Dairy", value: bulkSummary.skippedNoDairyCount || 0 },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-[#EFE7DA] bg-[#FFF9F1] px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B79A74]">{item.label}</p>
                        <p className="mt-1 text-lg font-bold text-[#2C1A0E]">{item.value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
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
                          <option value="">Auto-Assign</option>
                          {scheduleOptions.agents.map(a => (
                            <option key={a.id} value={a.id} disabled={!a.isActive}>
                              {a.name} - {a.status || "ACTIVE"} / {a.availability || "AVAILABLE"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  {selectedScheduleCustomer ? (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                      {selectedScheduleCustomer.route || "-"} • {selectedScheduleCustomer.room || "-"} • {selectedScheduleCustomer.milkType} {selectedScheduleCustomer.quantityLiters}L
                    </div>
                  ) : null}
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
          <div className="overflow-hidden rounded-[28px] border border-[#EDE8DF] bg-white/95 shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
            <div className="flex flex-col items-center justify-between gap-4 border-b border-[#F2EDE4] bg-[#FFFDF8] p-4 lg:flex-row">
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
                <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="pro-input text-[13px] py-1.5 flex-1 lg:flex-none">
                  <option value="ALL">All Agents</option>
                  {filterOptions.agents.map((agent) => (
                    <option key={agent} value={agent}>{agent}</option>
                  ))}
                </select>
                <select value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)} className="pro-input text-[13px] py-1.5 flex-1 lg:flex-none">
                  <option value="ALL">All Buildings</option>
                  {filterOptions.routes.map((route) => (
                    <option key={route} value={route}>{route}</option>
                  ))}
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
            ) : groupedTodayDeliveries.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-slate-400 font-medium">No deliveries found for the selected day and filters.</p>
                <button onClick={resetFilters} className="mt-2 text-blue-600 underline text-sm">Clear all filters</button>
              </div>
            ) : (
              <div className="space-y-5 p-5">
                {groupedTodayDeliveries.map((group) => (
                  <section key={group.buildingName} className="rounded-3xl border border-[#EFE7DA] bg-[#FFFCF7] shadow-sm overflow-hidden">
                    <div className="flex flex-col gap-2 border-b border-[#F2EDE4] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#C4A882]">Building</p>
                        <h3 className="text-xl font-bold text-[#2C1A0E]">{group.buildingName}</h3>
                      </div>
                      <div className="text-sm text-[#8B7355]">
                        Today&apos;s stops: <span className="font-bold text-[#2C1A0E]">{group.deliveries.length}</span>
                      </div>
                    </div>

                    <div className="divide-y divide-[#F3EEE5]">
                      {group.deliveries.map((d) => (
                        <article key={d.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B8641A]">
                              {d.wingOrFloor ? `Wing / Floor ${d.wingOrFloor}` : "Wing / Floor -"} • Room {d.roomNo || "-"}
                            </p>
                            <p className="mt-1 text-base font-bold text-slate-900">{d.customerName}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              {d.deliveryType} • {d.quantity} • {d.slot || "-"}
                            </p>
                            <p className="text-xs text-slate-500">{formatDate(d.date)} • ID {d.id}</p>
                            {d.hasOpenIssue ? (
                              <p className="mt-2 text-xs font-semibold text-rose-700">
                                Issue: {d.customerIssue || "Reported by customer"}
                              </p>
                            ) : null}
                            {!d.hasOpenIssue && d.issueStatus === "RESOLVED" && d.issueAdminAction ? (
                              <p className="mt-2 text-xs font-semibold text-emerald-700">
                                Action taken: {d.issueAdminAction}
                              </p>
                            ) : null}
                          </div>

                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Assigned Agent</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">{d.agentName || "Unassigned"}</p>
                            <p className="text-xs text-slate-500">{d.locationLabel}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                              d.approvalStatus === "PENDING"
                                ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                                : "bg-green-100 text-green-700 border-green-200"
                            }`}>
                              {d.approvalStatus || "APPROVED"}
                            </span>
                            <StatusPill status={d.status} />
                          </div>

                          <div className="flex justify-start lg:justify-end">
                            {d.hasOpenIssue ? (
                              <button
                                type="button"
                                onClick={() => openResolveIssueModal(d)}
                                disabled={resolvingIssueId === d.rawId}
                                className="px-3 py-1.5 rounded bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:bg-rose-300"
                              >
                                {resolvingIssueId === d.rawId ? "Resolving..." : "Resolve Issue"}
                              </button>
                            ) : d.needsApproval ? (
                              <button
                                type="button"
                                onClick={() => handleApproveOne(d)}
                                disabled={approvingId === d.rawId}
                                className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:bg-indigo-300"
                              >
                                {approvingId === d.rawId ? "Approving..." : "Approve & Assign"}
                              </button>
                            ) : !d.isAssigned ? (
                              <button
                                type="button"
                                onClick={() => handleAssignPartner(d)}
                                disabled={assigningId === d.rawId}
                                className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:bg-blue-300"
                              >
                                {assigningId === d.rawId ? "Assigning..." : "Assign Delivery Partner"}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">Assignment ready</span>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
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

      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Assign Delivery Partner</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Delivery: {assignTargetDelivery?.id || "-"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssignModalOpen(false);
                  setAssignTargetDelivery(null);
                  setSelectedAssignAgentId("");
                }}
                className="text-slate-500 hover:text-slate-700 text-sm font-medium"
              >
                Close
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {scheduleOptions.agents.map((agent) => (
                <label
                  key={agent.id}
                  className={`flex items-center justify-between gap-3 border rounded-xl px-4 py-3 ${
                    !agent.isActive ? "bg-slate-50 border-slate-200 opacity-70" : "border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="assign-agent"
                      value={agent.id}
                      disabled={!agent.isActive}
                      checked={String(selectedAssignAgentId) === String(agent.id)}
                      onChange={(e) => setSelectedAssignAgentId(e.target.value)}
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                      <p className="text-xs text-slate-500">Route: {agent.route || "-"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      agent.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {agent.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      String(agent.availability || "").toUpperCase() === "BUSY"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {agent.availability || "AVAILABLE"}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAssignModalOpen(false);
                  setAssignTargetDelivery(null);
                  setSelectedAssignAgentId("");
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignPartner}
                disabled={assigningId === assignTargetDelivery?.rawId || !selectedAssignAgentId}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:bg-blue-300"
              >
                {assigningId === assignTargetDelivery?.rawId ? "Assigning..." : "Assign Partner"}
              </button>
            </div>
          </div>
        </div>
      )}

      {resolveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Resolve Reported Issue</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Delivery: {resolveTargetDelivery?.id || "-"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResolveModalOpen(false);
                  setResolveTargetDelivery(null);
                  setResolveCustomAction("");
                }}
                className="text-slate-500 hover:text-slate-700 text-sm font-medium"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase ml-1">
                  Action Taken
                </label>
                <select
                  value={resolveAction}
                  onChange={(e) => setResolveAction(e.target.value)}
                  className="pro-input w-full text-sm"
                >
                  {RESOLVE_ACTION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value="OTHER">Other (custom)</option>
                </select>
              </div>

              {resolveAction === "OTHER" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase ml-1">
                    Custom Action Note
                  </label>
                  <textarea
                    value={resolveCustomAction}
                    onChange={(e) => setResolveCustomAction(e.target.value)}
                    placeholder="Describe action taken by admin..."
                    className="pro-input w-full h-24 text-sm"
                  />
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setResolveModalOpen(false);
                  setResolveTargetDelivery(null);
                  setResolveCustomAction("");
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolveIssue}
                disabled={
                  resolvingIssueId === resolveTargetDelivery?.rawId ||
                  (resolveAction === "OTHER" && !String(resolveCustomAction || "").trim())
                }
                className="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold disabled:bg-rose-300"
              >
                {resolvingIssueId === resolveTargetDelivery?.rawId ? "Resolving..." : "Confirm Resolve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
