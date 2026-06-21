import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchAdminAgents } from "../../api/admin.api";
import { Search } from "lucide-react";

// Layout Components
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import AdminMobileBottomNav from "../../components/admin/layout/AdminMobileBottomNav";
import AgentDrawer from "../../components/agent/AgentDrawer.jsx"; 
import AddAgentModal from "../../components/agent/AddAgentModal.jsx";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import AdminAgentLiveLocationMap from "../../components/admin/AdminAgentLiveLocationMap.jsx";
import { adminHeadingFont, adminShellFont, useTheme } from "../../components/admin/adminTheme";

export default function AdminAgents() {
  const { isDark } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data States
  const [agents, setAgents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Drawer State
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [liveTrackingAgent, setLiveTrackingAgent] = useState(null);

  useEffect(() => {
    if (searchParams.get("addAgent") === "1") {
      setIsAddModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchAdminAgents({ page, search });
        
        if (active) {
          if (res.agents) {
             setAgents(res.agents);
             setTotal(res.total || 0);
          } 
          else if (res.data) {
             setAgents(res.data);
             setTotal(res.total || 0);
          } 
          else if (Array.isArray(res)) {
             setAgents(res);
             setTotal(res.length);
          }
        }
      } catch (err) {
        console.error("Failed to load agents", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => (active = false);
  }, [page, search, refreshKey]);

  const openAddModal = () => {
    setIsAddModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.set("addAgent", "1");
    setSearchParams(next, { replace: true });
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete("addAgent");
    setSearchParams(next, { replace: true });
  };

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

  return (
    <div className="ds-portal ds-admin-portal min-h-screen bg-[#FAFAF7] text-[#2C1A0E] dark:bg-[#0B0F19] dark:text-white" style={adminShellFont}>
      {/* Mobile Header */}
      <AdminMobileTopbar
        adminName={adminName}
        onMenu={() => setSidebarOpen(true)}
      />

      {/* Sidebar */}
      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="px-4 py-8 pb-32 sm:px-6 lg:ml-64 lg:px-10 xl:ml-80">
        {/* Page Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
          <div>
            <h1 className="text-3xl sm:text-4xl text-[#2C1A0E] dark:text-white" style={adminHeadingFont}>
              Delivery Agents
            </h1>
            <p className="mt-1 text-sm text-[#8B7355] dark:text-[#10B981]">
              Manage your delivery staff and route assignments
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-[#B8641A] dark:bg-[#d97706] px-6 py-3.5 text-sm font-black text-white hover:bg-[#9E5415] dark:hover:bg-[#b45309] shadow-lg"
          >
            + Add Agent
          </button>
        </div>

        {/* Desktop View */}
        <div className="hidden lg:block rounded-[28px] border border-[#EDE8DF] dark:border-[#2a2a3a] bg-white/95 dark:bg-[#1a1a2e] shadow-[0_18px_45px_rgba(92,61,30,0.08)] dark:shadow-[0_18px_45px_rgba(0,0,0,0.3)]">
          
          {/* Top Bar (Search & Total) */}
          <div className="flex flex-col gap-4 border-b border-[#F2EDE4] dark:border-[#2a2a3a] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search agent name or phone..."
              className="pro-input max-w-sm w-full dark:bg-[#0B0F19] dark:border-[#2a2a3a] dark:text-white dark:placeholder:text-slate-500"
            />

            <div className="text-sm text-[#8B7355] dark:text-[#d97706]">
              Total Agents{" "}
              <span className="font-medium text-[#2C1A0E] dark:text-white">
                {total}
              </span>
            </div>
          </div>

          {/* List Area */}
          <div className="divide-y divide-[#F5EFE6] dark:divide-[#2a2a3a]">
            {loading ? (
              <LoadingIndicator className="px-6 py-10" message="Loading agents..." />
            ) : agents.length === 0 ? (
              <div className="px-6 py-10 text-gray-500 text-center">
                No delivery agents found.
              </div>
            ) : (
              agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex flex-col justify-between gap-4 px-6 py-4 transition hover:bg-[#FFFDF8] dark:hover:bg-[#222B40] sm:flex-row sm:items-center"
                >
                  {/* Left: Info */}
                  <div className="flex items-center gap-4">
                    {/* Avatar Circle */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FDF6EC] dark:bg-[#2C1E13] font-bold uppercase text-[#B8641A] dark:text-[#E5C79D]">
                      {agent.full_name?.charAt(0) || "A"}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 font-medium text-[#2C1A0E] dark:text-white">
                        <span>{agent.full_name || "Unnamed Agent"}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          String(agent.status || "ACTIVE").toUpperCase() === "INACTIVE"
                            ? "bg-[#FFF4EE] dark:bg-red-900/30 text-[#A85734] dark:text-red-400"
                            : "bg-[#F4F7ED] dark:bg-emerald-900/30 text-[#6F8C45] dark:text-[#22c55e]"
                        }`}>
                          {String(agent.status || "ACTIVE").toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-0.5 flex gap-2 text-sm text-[#8B7355] dark:text-slate-400">
                         <span>{agent.mobile || "No Phone"}</span>
                         {agent.building && (
                             <span className="text-gray-300 dark:text-slate-600">|</span>
                         )}
                         {agent.building && (
                             <span className="font-medium text-[#B8641A] dark:text-[#d97706]">{agent.building}</span>
                         )}
                         {String(agent.status || "ACTIVE").toUpperCase() === "INACTIVE" && agent.inactive_until && (
                             <>
                               <span className="text-gray-300 dark:text-slate-600">|</span>
                               <span className="font-medium text-[#A85734] dark:text-red-400">
                                 Until {new Date(agent.inactive_until).toLocaleDateString()}
                               </span>
                             </>
                         )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
                    <div className="hidden text-[#8B7355] dark:text-slate-400 sm:block">
                      Joined{" "}
                      <span className="font-medium text-[#2C1A0E] dark:text-white">
                        {new Date(agent.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setLiveTrackingAgent({
                          id: agent.id,
                          name: agent.full_name || "Agent",
                        })
                      }
                      className="rounded-lg border border-[#E5D9C7] dark:border-[#2a2a3a] px-3 py-1.5 font-medium text-[#8B5E34] dark:text-slate-400 hover:bg-[#FDF6EC] dark:hover:bg-[#222B40]"
                    >
                      Live Location
                    </button>

                    <button
                      onClick={() => setSelectedAgent(agent.id)}
                      className="font-medium text-[#B8641A] dark:text-[#d97706] hover:underline"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-[#F2EDE4] dark:border-[#2a2a3a] px-6 py-4">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-[#E5D9C7] dark:border-[#2a2a3a] px-4 py-2 text-sm text-[#8B7355] dark:text-slate-400 disabled:opacity-40 hover:bg-[#FDF6EC] dark:hover:bg-[#222B40]"
            >
              Previous
            </button>

            <span className="text-sm text-[#8B7355] dark:text-slate-400">
              Page {page}
            </span>

            <button
              disabled={page * 10 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#E5D9C7] dark:border-[#2a2a3a] px-4 py-2 text-sm text-[#8B7355] dark:text-slate-400 disabled:opacity-40 hover:bg-[#FDF6EC] dark:hover:bg-[#222B40]"
            >
              Next
            </button>
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
              placeholder="Search agent name or phone..."
              className="w-full rounded-xl border border-[#E5D9C7] dark:border-[#2a2a3a] bg-[#FFFDF8] dark:bg-[#1a1a2e] py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#C98A42] text-[#2C1A0E] dark:text-white placeholder:text-[#B89970] dark:placeholder:text-slate-500"
            />
          </div>

          <div className="text-[11px] font-black uppercase tracking-[0.15em] text-[#d97706] mt-1 mb-0.5 px-1">
            TOTAL AGENTS: {total}
          </div>

          <div className="flex flex-col gap-3">
            {loading ? (
              <LoadingIndicator className="py-12" />
            ) : agents.length === 0 ? (
              <div className="rounded-xl border border-[#EDE8DF] dark:border-[#2a2a3a] bg-white dark:bg-[#1a1a2e] p-8 text-center text-gray-500">
                No delivery agents found.
              </div>
            ) : (
              agents.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: isDark ? '#1a1a2e' : '#ffffff',
                    border: isDark ? '1px solid #2a2a3a' : '1px solid #EDE8DF',
                    borderLeft: isDark ? '4px solid #d97706' : '4px solid #B8641A',
                  }}
                >
                  {/* Info Row */}
                  <div className="flex items-center gap-3.5 px-4 pt-4 pb-2">
                    {/* Avatar Circle */}
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-bold uppercase text-base"
                      style={{
                        background: isDark ? '#2C1E13' : '#FDF6EC',
                        color: isDark ? '#E5C79D' : '#B8641A',
                        border: isDark ? '2px solid rgba(229,199,157,0.2)' : '2px solid rgba(184,100,26,0.2)',
                      }}
                    >
                      {agent.full_name?.charAt(0) || "A"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#2C1A0E] dark:text-white text-[15px] truncate">
                          {agent.full_name || "Unnamed Agent"}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          String(agent.status || "ACTIVE").toUpperCase() === "INACTIVE"
                            ? "bg-red-900/30 text-red-400"
                            : "bg-emerald-900/30 text-[#22c55e]"
                        }`}>
                          {String(agent.status || "ACTIVE").toUpperCase()}
                        </span>
                      </div>

                      <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[12px] text-gray-500 dark:text-slate-400">
                        <span>{agent.mobile || "No Phone"}</span>
                        {agent.building && <span>·</span>}
                        {agent.building && (
                          <span>{agent.building}</span>
                        )}
                        {String(agent.status || "ACTIVE").toUpperCase() === "INACTIVE" && agent.inactive_until && (
                          <>
                            <span>·</span>
                            <span className="text-red-400 font-bold">
                              Until {new Date(agent.inactive_until).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2.5 px-4 pb-3.5 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setLiveTrackingAgent({
                          id: agent.id,
                          name: agent.full_name || "Agent",
                        })
                      }
                      className="flex-1 py-2 rounded-lg border text-[12px] font-semibold transition text-center"
                      style={{
                        borderColor: isDark ? '#2a2a3a' : '#E5D9C7',
                        color: isDark ? '#94a3b8' : '#8B5E34',
                        background: 'transparent',
                      }}
                    >
                      Live Location
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedAgent(agent.id)}
                      className="flex-1 py-2 rounded-lg border text-[12px] font-semibold transition text-center"
                      style={{
                        borderColor: isDark ? '#d97706' : '#B8641A',
                        color: isDark ? '#d97706' : '#B8641A',
                        background: 'transparent',
                      }}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Mobile Pagination */}
          <div className="flex items-center justify-between mt-2 px-1">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-[#E5D9C7] dark:border-[#2a2a3a] bg-white dark:bg-[#1a1a2e] px-4 py-2 text-xs font-bold text-[#8B7355] dark:text-slate-400 disabled:opacity-40"
            >
              Previous
            </button>

            <span className="text-xs font-bold text-[#8B7355] dark:text-slate-400">
              Page {page}
            </span>

            <button
              disabled={page * 10 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#E5D9C7] dark:border-[#2a2a3a] bg-white dark:bg-[#1a1a2e] px-4 py-2 text-xs font-bold text-[#8B7355] dark:text-slate-400 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </main>

      {/* Drawer */}
      {selectedAgent && (
        <AgentDrawer
          agentId={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}

      <AddAgentModal
        open={isAddModalOpen}
        onClose={closeAddModal}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />

      {liveTrackingAgent ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2C1A0E]/35 px-4">
          <div className="w-full max-w-3xl rounded-[22px] border border-[#EDE8DF] bg-white shadow-[0_22px_50px_rgba(44,26,14,0.2)]">
            <div className="flex items-center justify-between border-b border-[#F2EDE4] px-4 py-3 sm:px-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#A88763]">
                  Agent Live Tracking
                </p>
                <h3 className="text-lg font-bold text-[#2C1A0E]">{liveTrackingAgent.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setLiveTrackingAgent(null)}
                className="rounded-full border border-[#E5D9C7] px-3 py-1 text-sm font-semibold text-[#8B7355] hover:bg-[#FDF6EC]"
              >
                Close
              </button>
            </div>
            <div className="p-4 sm:p-5">
              <AdminAgentLiveLocationMap
                agentId={liveTrackingAgent.id}
                agentName={liveTrackingAgent.name}
              />
            </div>
          </div>
        </div>
      ) : null}
      <AdminMobileBottomNav />
    </div>
  );
}
