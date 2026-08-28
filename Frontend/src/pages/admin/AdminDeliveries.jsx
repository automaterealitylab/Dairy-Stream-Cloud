import { useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Package,
  RotateCcw,
  Search,
  UserRound,
} from "lucide-react";
import {
  assignAdminDeliveryPartner,
  approveAdminDelivery,
  approveAllAdminDeliveries,
  resolveAdminDeliveryIssue,
  scheduleAdminDelivery,
  scheduleAdminDeliveriesBulk,
} from "../../api/admin.api";
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import AdminMobileBottomNav from "../../components/admin/layout/AdminMobileBottomNav";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import { adminHeadingFont, adminShellFont } from "../../components/admin/adminTheme";
import { useAdminDeliveries } from "../../hooks/useAdminDeliveries.js";
import {
  compareLocationPart,
  getRelativeDateInput,
  getTodayDateInput,
  toDateTimestamp,
  toQuantityValue,
} from "../../utils/adminDeliveries.js";
import { RESOLVE_ACTION_OPTIONS, DELIVERY_SECTIONS } from "../../constants/adminDeliveries.js";
import { FeedbackBanner } from "../../components/admin/deliveries/FeedbackBanner.jsx";
import { BuildingDeliveryGroup } from "../../components/admin/deliveries/BuildingDeliveryGroup.jsx";

// --- Main Component ---
export default function AdminDeliveries() {
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
  const quickDateOptions = [
    { key: "today", label: "Today", value: getRelativeDateInput(0) },
    { key: "tomorrow", label: "Tomorrow", value: getRelativeDateInput(1) },
  ];

  const [_activeTab, _setActiveTab] = useState("bulk"); // 'bulk' | 'single'
  const [activeSection, setActiveSection] = useState("ALL");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState(getTodayDateInput());
  const [singleForm, setSingleForm] = useState({
    customerId: "",
    agentId: "",
    deliveryDate: getTodayDateInput(),
    notes: "",
  });
  const [_singleSubmitting, setSingleSubmitting] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [_approvingAll, setApprovingAll] = useState(false);
  const [resolvingIssueId, setResolvingIssueId] = useState(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveTargetDelivery, setResolveTargetDelivery] = useState(null);
  const [resolveAction, setResolveAction] = useState("Replacement milk sent");
  const [resolveCustomAction, setResolveCustomAction] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetDelivery, setAssignTargetDelivery] = useState(null);
  const [selectedAssignAgentId, setSelectedAssignAgentId] = useState("");
  const [_singleFeedback, setSingleFeedback] = useState({ type: "", message: "" });

  const [bulkForm, _setBulkForm] = useState({
    deliveryDate: getTodayDateInput(),
    agentId: "",
    slot: "ALL",
    route: "ALL",
    notes: "",
  });
  const [_bulkSubmitting, setBulkSubmitting] = useState(false);
  const [_bulkFeedback, setBulkFeedback] = useState({ type: "", message: "" });
  const [_bulkSummary, setBulkSummary] = useState(null);

  // Filters State
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("ALL");
  const [routeFilter, setRouteFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { loading, loadError, deliveries, scheduleOptions, loadDeliveries, loadSchedulingOptions } = useAdminDeliveries(dateFilter);

  // --- Memos ---
  const _selectedScheduleCustomer = useMemo(() => {
    return scheduleOptions.customers.find((c) => String(c.id) === String(singleForm.customerId)) || null;
  }, [singleForm.customerId, scheduleOptions.customers]);

  const _bulkRoutes = useMemo(() => {
    return [...new Set(scheduleOptions.customers.map((item) => item.route).filter(Boolean))].sort();
  }, [scheduleOptions.customers]);

  const _bulkPreviewCount = useMemo(() => {
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

  const baseFilteredDeliveries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deliveries.filter((d) => {
      const searchableText = `${d.id} ${d.customerName} ${d.agentName} ${d.route} ${d.buildingName} ${d.wingOrFloor} ${d.roomNo} ${d.deliveryType}`.toLowerCase();
      return (
        (!q || searchableText.includes(q)) &&
        (!dateFilter || d.date === dateFilter) &&
        (agentFilter === "ALL" || d.agentName === agentFilter) &&
        (routeFilter === "ALL" || d.route === routeFilter)
      );
    });
  }, [deliveries, search, dateFilter, agentFilter, routeFilter]);

  const stats = useMemo(() => ({
    total: baseFilteredDeliveries.length,
    pending: baseFilteredDeliveries.filter((d) => d.status === "PENDING" && d.approvalStatus !== "PENDING").length,
    delivered: baseFilteredDeliveries.filter((d) => d.status === "DELIVERED" || d.status === "COMPLETED").length,
    pendingApproval: baseFilteredDeliveries.filter((d) => d.approvalStatus === "PENDING" || d.approvalStatus === "PENDING_VERIFICATION").length,
  }), [baseFilteredDeliveries]);

  const filteredAndSortedDeliveries = useMemo(() => {
    const filtered = baseFilteredDeliveries.filter((d) => {
      if (activeSection === "PENDING") return d.status === "PENDING" && d.approvalStatus !== "PENDING";
      if (activeSection === "DELIVERED") return d.status === "DELIVERED" || d.status === "COMPLETED";
      if (activeSection === "APPROVAL_PENDING") return d.approvalStatus === "PENDING" || d.approvalStatus === "PENDING_VERIFICATION";
      return true;
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
  }, [activeSection, baseFilteredDeliveries, sortBy, sortOrder]);

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
  const _handleScheduleSingle = async (e) => {
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

  const _handleScheduleBulk = async (e) => {
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
    setSearch(""); setDateFilter(getTodayDateInput()); setAgentFilter("ALL");
    setRouteFilter("ALL"); setSortBy("date"); setSortOrder("desc"); setPage(1);
    setActiveSection("ALL");
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

  const _handleApproveAll = async () => {
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
      setSingleFeedback({ type: "error", message: err?.message || "Failed to Assign Partner." });
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="ds-portal ds-admin-portal flex min-h-screen bg-[#FAFAF7] text-[#2C1A0E] dark:bg-[#0B0F19] dark:text-white" style={adminShellFont}>
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 lg:ml-64 xl:ml-80 w-full transition-all duration-300 pb-32">
        <AdminMobileTopbar adminName={adminName} onMenu={() => setSidebarOpen(true)} />

        <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#B89970] dark:text-slate-500">Operations</p>
              <h1 className="text-3xl text-[#2C1A0E] dark:text-white" style={adminHeadingFont}>Delivery Management</h1>
              <p className="mt-1 text-sm text-[#8B7355] dark:text-slate-400">Monitor routes, assignments, delivery status, and approvals.</p>
            </div>
            
            {/* Delivery Sections */}
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[#E5D9C7] bg-white shadow-sm dark:border-slate-800 dark:bg-[#121829] sm:flex">
              {[
                { key: "ALL", label: "All Deliveries", val: stats.total, color: "text-slate-700" },
                { key: "PENDING", label: "Delivery Pending", val: stats.pending, color: "text-amber-600" },
                { key: "DELIVERED", label: "Delivered", val: stats.delivered, color: "text-green-600" },
                { key: "APPROVAL_PENDING", label: "Approval Pending", val: stats.pendingApproval, color: "text-indigo-600" }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setActiveSection(item.key);
                    setPage(1);
                  }}
                  className={`flex min-h-[50px] items-center justify-between gap-3 border-b border-r border-[#EDE8DF] px-4 py-2 text-left transition-colors last:border-r-0 sm:border-b-0 ${
                    activeSection === item.key
                      ? "bg-[#FFF1DE] text-[#A95516] dark:bg-[#083A36] dark:text-[#00E0A4]"
                      : "bg-white text-[#6F604B] hover:bg-[#FFFBF5] dark:bg-[#121829] dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="text-[11px] font-bold">{item.label}</span>
                  <span className={`min-w-6 rounded-full bg-white px-2 py-0.5 text-center text-xs font-black shadow-sm dark:bg-slate-900 ${item.color}`}>{item.val}</span>
                </button>
              ))}
            </div>
          </div>

          {loadError ? <FeedbackBanner feedback={{ type: "error", message: loadError }} /> : null}
          {/* Delivery Log Section */}
          <div>
            <div className="rounded-lg border border-[#E5D9C7] bg-[#FFFDF8] p-4 shadow-sm dark:border-slate-800 dark:bg-[#121829]">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_220px_auto] lg:items-end">
                <label className="block min-w-0">
                  <span className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#B89970]">
                    Search
                  </span>
                  <div className="relative mt-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#B89970]" size={16} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="ID, customer, agent or route"
                      className="pro-input mt-0 pl-10 text-sm"
                    />
                  </div>
                </label>

                <label className="block min-w-0">
                  <span className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#B89970]">
                    Agent
                  </span>
                  <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="pro-input text-[13px]">
                    <option value="ALL">All Agents</option>
                    {filterOptions.agents.map((agent) => (
                      <option key={agent} value={agent}>{agent}</option>
                    ))}
                  </select>
                </label>

                <label className="block min-w-0">
                  <span className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#B89970]">
                    Building
                  </span>
                  <select value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)} className="pro-input text-[13px]">
                    <option value="ALL">All Buildings</option>
                    {filterOptions.routes.map((route) => (
                      <option key={route} value={route}>{route}</option>
                    ))}
                  </select>
                </label>

                <label className="block min-w-0">
                  <span className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#B89970]">
                    <CalendarDays size={12} /> Date
                  </span>
                  <div className="mb-2 flex flex-wrap gap-2 px-1">
                    {quickDateOptions.map((option) => {
                      const isActive = dateFilter === option.value;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setDateFilter(option.value)}
                          className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                            isActive
                              ? "border-[#B8641A] bg-[#FFF1DE] text-[#B8641A]"
                              : "border-[#E5D9C7] bg-white text-[#8B7355] hover:border-[#D8B58A] hover:text-[#A25A1B]"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="pro-input text-[13px]"
                  />
                </label>

                <button
                  onClick={resetFilters}
                  className="flex h-[42px] items-center justify-center gap-2 rounded-lg border border-[#D8C9B2] bg-white px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#8B5E34] transition hover:border-[#B8641A] hover:bg-[#FFF5E8] hover:text-[#B8641A] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <RotateCcw size={14} />
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
              <div className="mt-5 space-y-4">
                {groupedTodayDeliveries.map((group) => (
                  <BuildingDeliveryGroup
                    key={group.buildingName}
                    group={group}
                    approvingId={approvingId}
                    assigningId={assigningId}
                    resolvingIssueId={resolvingIssueId}
                    onApprove={handleApproveOne}
                    onAssignPartner={handleAssignPartner}
                    onResolveIssue={openResolveIssueModal}
                  />
                ))}
              </div>
            )}
            {/* Pagination */}
            <div className="mt-5 flex items-center justify-between border-t border-[#EDE8DF] px-1 py-4 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500">
                Showing {Math.min(filteredAndSortedDeliveries.length, (page - 1) * pageSize + 1)} - {Math.min(page * pageSize, filteredAndSortedDeliveries.length)} of {filteredAndSortedDeliveries.length}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex h-9 items-center gap-1 rounded-lg border border-[#E5D9C7] bg-white px-3 text-xs font-bold transition hover:bg-[#FFF8EF] disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-9 items-center gap-1 rounded-lg border border-[#E5D9C7] bg-white px-3 text-xs font-bold transition hover:bg-[#FFF8EF] disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Assign Delivery Partner</h3>
                <p className="mt-1 text-xs text-slate-500">
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
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto p-6">
              {scheduleOptions.agents.map((agent) => (
                <label
                  key={agent.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                    !agent.isActive ? "border-slate-200 bg-slate-50 opacity-70" : "border-slate-200 hover:border-blue-300"
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
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                      agent.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {agent.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
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

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setAssignModalOpen(false);
                  setAssignTargetDelivery(null);
                  setSelectedAssignAgentId("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignPartner}
                disabled={assigningId === assignTargetDelivery?.rawId || !selectedAssignAgentId}
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:bg-blue-300"
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
      <AdminMobileBottomNav />
    </div>
  );
}

