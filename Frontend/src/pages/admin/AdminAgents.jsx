import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchAdminAgents } from "../../api/admin.api";

// Layout Components
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import AgentDrawer from "../../components/agent/AgentDrawer.jsx"; 
import AddAgentModal from "../../components/agent/AddAgentModal.jsx";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import AdminAgentLiveLocationMap from "../../components/admin/AdminAgentLiveLocationMap.jsx";
import { adminHeadingFont, adminShellFont } from "../../components/admin/adminTheme";

export default function AdminAgents() {
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
          // ✅ FIX: Check for 'agents' because that is what your backend service returns
          if (res.agents) {
             setAgents(res.agents);
             setTotal(res.total || 0);
          } 
          // Fallback: Check for 'data' (common pattern)
          else if (res.data) {
             setAgents(res.data);
             setTotal(res.total || 0);
          } 
          // Fallback: Check if response itself is an array
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

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#2C1A0E]" style={adminShellFont}>
      {/* Mobile Header */}
      <AdminMobileTopbar
        title="Delivery Agents"
        onMenu={() => setSidebarOpen(true)}
      />

      {/* Sidebar */}
      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="px-4 py-8 sm:px-6 lg:ml-64 lg:px-10">
        {/* Page Header */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-4xl text-[#2C1A0E]" style={adminHeadingFont}>
              Delivery Agents
            </h1>
            <p className="mt-1 text-sm text-[#8B7355]">
              Manage your delivery staff and route assignments
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center rounded-xl bg-[#B8641A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9E5415]"
          >
            + Add Agent
          </button>
        </div>

        {/* Main Canvas */}
        <div className="rounded-[28px] border border-[#EDE8DF] bg-white/95 shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
          
          {/* Top Bar (Search & Total) */}
          <div className="flex flex-col gap-4 border-b border-[#F2EDE4] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search agent name or phone..."
              className="pro-input max-w-sm w-full"
            />

            <div className="text-sm text-[#8B7355]">
              Total Agents{" "}
              <span className="font-medium text-[#2C1A0E]">
                {total}
              </span>
            </div>
          </div>

          {/* List Area */}
          <div className="divide-y divide-[#F5EFE6]">
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
                  className="flex flex-col justify-between gap-4 px-6 py-4 transition hover:bg-[#FFFDF8] sm:flex-row sm:items-center"
                >
                  {/* Left: Info */}
                  <div className="flex items-center gap-4">
                    {/* Avatar Circle */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FDF6EC] font-bold uppercase text-[#B8641A]">
                      {agent.full_name?.charAt(0) || "A"}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 font-medium text-[#2C1A0E]">
                        <span>{agent.full_name || "Unnamed Agent"}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          String(agent.status || "ACTIVE").toUpperCase() === "INACTIVE"
                            ? "bg-[#FFF4EE] text-[#A85734]"
                            : "bg-[#F4F7ED] text-[#6F8C45]"
                        }`}>
                          {String(agent.status || "ACTIVE").toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-0.5 flex gap-2 text-sm text-[#8B7355]">
                         <span>{agent.mobile || "No Phone"}</span>
                         {agent.building && (
                             <span className="text-gray-300">|</span>
                         )}
                         {agent.building && (
                             <span className="font-medium text-[#B8641A]">{agent.building}</span>
                         )}
                         {String(agent.status || "ACTIVE").toUpperCase() === "INACTIVE" && agent.inactive_until && (
                             <>
                               <span className="text-gray-300">|</span>
                               <span className="font-medium text-[#A85734]">
                                 Until {new Date(agent.inactive_until).toLocaleDateString()}
                               </span>
                             </>
                         )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="hidden text-[#8B7355] sm:block">
                      Joined{" "}
                      <span className="font-medium text-[#2C1A0E]">
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
                      className="rounded-lg border border-[#E5D9C7] px-3 py-1.5 font-medium text-[#8B5E34] hover:bg-[#FDF6EC]"
                    >
                      Live Location
                    </button>

                    <button
                      onClick={() => setSelectedAgent(agent.id)}
                      className="font-medium text-[#B8641A] hover:underline"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-[#F2EDE4] px-6 py-4">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-[#E5D9C7] px-4 py-2 text-sm text-[#8B7355] disabled:opacity-40 hover:bg-[#FDF6EC]"
            >
              Previous
            </button>

            <span className="text-sm text-[#8B7355]">
              Page {page}
            </span>

            <button
              disabled={page * 10 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#E5D9C7] px-4 py-2 text-sm text-[#8B7355] disabled:opacity-40 hover:bg-[#FDF6EC]"
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
              <AdminAgentLiveLocationMap agentId={liveTrackingAgent.id} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
