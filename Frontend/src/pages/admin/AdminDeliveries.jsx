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
import AdminMobileBottomNav from "../../components/admin/layout/AdminMobileBottomNav";
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
const cleanMetaText = (value) =>
  String(value || "")
    .replace(/\s*[\uFFFD\u00B7\u2022]+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildDeliveryMeta = (delivery) => {
  const parts = [];

  if (delivery?.wingOrFloor) {
    parts.push(`Wing ${cleanMetaText(delivery.wingOrFloor)}`);
  }

  const quantity = cleanMetaText(delivery?.quantity);
  if (quantity && quantity !== "-") {
    parts.push(quantity);
  }

  const slot = cleanMetaText(delivery?.slot);
  if (slot && slot !== "-") {
    parts.push(slot);
  }

  const date = formatDate(delivery?.date);
  if (date && date !== "-") {
    parts.push(date);
  }

  return parts;
};

const getTodayDateInput = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getRelativeDateInput = (dayOffset = 0) => {
  const now = new Date();
  now.setDate(now.getDate() + dayOffset);
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
    <div className={`mt-4 rounded-lg border p-3 text-sm font-medium ${isSuccess ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}>
      {isSuccess ? "OK " : "X "} {feedback.message}
    </div>
  );
};

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
  const RESOLVE_ACTION_OPTIONS = [
    "Replacement milk sent",
    "Refund initiated",
    "Delivery partner warned",
    "Quality issue escalated to dairy team",
    "Customer contacted and issue clarified",
  ];
  const DELIVERY_SECTIONS = [
    { key: "ALL", label: "All Deliveries" },
    { key: "PENDING", label: "Delivery Pending" },
    { key: "DELIVERED", label: "Delivered" },
    { key: "APPROVAL_PENDING", label: "Approval Pending" },
  ];
  const quickDateOptions = [
    { key: "today", label: "Today", value: getRelativeDateInput(0) },
    { key: "tomorrow", label: "Tomorrow", value: getRelativeDateInput(1) },
  ];

  const [activeTab, setActiveTab] = useState("bulk"); // 'bulk' | 'single'
  const [activeSection, setActiveSection] = useState("ALL");
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
  const [dateFilter, setDateFilter] = useState(getTodayDateInput());
  const [agentFilter, setAgentFilter] = useState("ALL");
  const [routeFilter, setRouteFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const loadDeliveries = async () => {
    const response = await fetchAdminDeliveries({ date: dateFilter });
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
          fetchAdminDeliveries({ date: dateFilter }),
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
  }, [dateFilter]);

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
    pendingApproval: baseFilteredDeliveries.filter((d) => d.approvalStatus === "PENDING").length,
  }), [baseFilteredDeliveries]);

  const filteredAndSortedDeliveries = useMemo(() => {
    const filtered = baseFilteredDeliveries.filter((d) => {
      if (activeSection === "PENDING") return d.status === "PENDING" && d.approvalStatus !== "PENDING";
      if (activeSection === "DELIVERED") return d.status === "DELIVERED" || d.status === "COMPLETED";
      if (activeSection === "APPROVAL_PENDING") return d.approvalStatus === "PENDING";
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
      setSingleFeedback({ type: "error", message: err?.message || "Failed to Assign Partner." });
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAF7] text-[#2C1A0E] dark:bg-[#0B0F19] dark:text-white" style={adminShellFont}>
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 lg:ml-64 w-full transition-all duration-300 pb-32">
        <AdminMobileTopbar adminName={adminName} onMenu={() => setSidebarOpen(true)} />

        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h1 className="text-3xl text-[#2C1A0E]" style={adminHeadingFont}>Delivery Management</h1>
              <p className="text-xs text-[#8B7355]">Track all deliveries, pending runs, completed drops, and approval queue.</p>
            </div>
            
            {/* Delivery Sections */}
            <div className="flex flex-wrap items-center gap-2">
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
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-left transition-all ${
                    activeSection === item.key
                      ? "border-[#B8641A] bg-[#FFF8EF] shadow-[0_8px_18px_rgba(184,100,26,0.10)]"
                      : "border-[#EDE8DF] bg-white/95 hover:border-[#D9C2A2]"
                  }`}
                >
                  <span className="text-[11px] font-bold text-[#6F604B]">{item.label}</span>
                  <span className={`rounded-full bg-white px-2 py-0.5 text-xs font-bold ${item.color}`}>{item.val}</span>
                </button>
              ))}
            </div>
          </div>

          {loadError ? <FeedbackBanner feedback={{ type: "error", message: loadError }} /> : null}
          {/* Delivery Log Section */}
          <div className="overflow-hidden rounded-[28px] border border-[#EDE8DF] bg-white/95 shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
            <div className="border-b border-[#F2EDE4] bg-[#FFFDF8] p-4">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_220px_auto] lg:items-end">
                <label className="block min-w-0">
                  <span className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#B89970]">
                    Search
                  </span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ID, customer, agent or route"
                    className="pro-input text-sm"
                  />
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
                  <span className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#B89970]">
                    Date
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
                  className="h-[42px] rounded-xl border border-[#D8C9B2] bg-white px-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#8B5E34] transition hover:border-[#B8641A] hover:bg-[#FFF5E8] hover:text-[#B8641A]"
                >
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
              <div className="space-y-3 p-4">
                {groupedTodayDeliveries.map((group) => (
                  <section key={group.buildingName} className="overflow-hidden rounded-xl border border-[#EFE7DA] bg-white shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-[#F2EDE4] bg-[#FFFDF8] px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C4A882]">Building</p>
                        <h3 className="truncate text-sm font-bold text-[#2C1A0E]">{group.buildingName}</h3>
                      </div>
                      <div className="shrink-0 text-[11px] text-[#8B7355]">
                        Stops: <span className="font-bold text-[#2C1A0E]">{group.deliveries.length}</span>
                      </div>
                    </div>

                    <div className="divide-y divide-[#F3EEE5]">
                      {group.deliveries.map((d) => (
                        <article key={d.id} className="grid gap-3 px-4 py-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_0.8fr_0.8fr_auto] items-start lg:items-center">
                          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                            <p className="truncate text-[13px] font-bold uppercase tracking-[0.12em] text-[#2C1A0E]">
                              Flat {d.roomNo || "-"}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-600">
                              {buildDeliveryMeta(d).join(" | ")}
                            </p>
                            {d.isProjected ? (
                              <p className="mt-1 truncate text-[11px] font-semibold text-[#B8641A]">
                                Projected from active subscription for this date
                              </p>
                            ) : null}
                            {d.hasOpenIssue ? (
                              <p className="mt-1 truncate text-[11px] font-semibold text-rose-700">
                                Issue: {d.customerIssue || "Reported by customer"}
                              </p>
                            ) : null}
                            {!d.hasOpenIssue && d.issueStatus === "RESOLVED" && d.issueAdminAction ? (
                              <p className="mt-1 truncate text-[11px] font-semibold text-emerald-700">
                                Action taken: {d.issueAdminAction}
                              </p>
                            ) : null}
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Product</p>
                            <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
                              {d.productType || "Milk"}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-700 bg-blue-50 px-2 py-1 rounded inline-block">
                              {d.quantity}
                            </p>
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Agent</p>
                            <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{d.agentName || "Unassigned"}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
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
                            {d.isProjected ? (
                              <span className="text-[10px] font-medium text-[#B8641A]">Projected</span>
                            ) : d.hasOpenIssue ? (
                              <button
                                type="button"
                                onClick={() => openResolveIssueModal(d)}
                                disabled={resolvingIssueId === d.rawId}
                                className="rounded bg-rose-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-rose-700 disabled:bg-rose-300"
                              >
                                {resolvingIssueId === d.rawId ? "Resolving..." : "Resolve Issue"}
                              </button>
                            ) : d.needsApproval ? (
                              <button
                                type="button"
                                onClick={() => handleApproveOne(d)}
                                disabled={approvingId === d.rawId}
                                className="rounded bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-indigo-700 disabled:bg-indigo-300"
                              >
                                {approvingId === d.rawId ? "Approving..." : "Approve"}
                              </button>
                            ) : !d.isAssigned ? (
                              <button
                                type="button"
                                onClick={() => handleAssignPartner(d)}
                                disabled={assigningId === d.rawId}
                                className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700 disabled:bg-blue-300"
                              >
                                {assigningId === d.rawId ? "Assigning..." : "Assign Partner"}
                              </button>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-400">Ready</span>
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
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 px-6 py-4">
              <span className="text-xs font-medium text-slate-500">
                Showing {Math.min(filteredAndSortedDeliveries.length, (page - 1) * pageSize + 1)} - {Math.min(page * pageSize, filteredAndSortedDeliveries.length)} of {filteredAndSortedDeliveries.length}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded border bg-white px-3 py-1 text-xs font-bold transition-all hover:bg-slate-50 disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border bg-white px-3 py-1 text-xs font-bold transition-all hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
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

