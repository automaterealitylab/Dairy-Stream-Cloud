import { useEffect, useState } from "react";
import { fetchAdminAgents } from "../../api/admin.api";

// Layout Components
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
// import AgentDrawer from "../../components/admin/agents/AgentDrawer"; 

export default function AdminAgents() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data States
  const [agents, setAgents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Drawer State
  const [selectedAgent, setSelectedAgent] = useState(null);

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
  }, [page, search]);

  return (
    <div className="min-h-screen bg-gray-50">
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

      <main className="lg:ml-64 px-4 sm:px-6 lg:px-10 py-8">
        {/* Page Header */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Delivery Agents
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your delivery staff and route assignments
            </p>
          </div>
          <a 
            href="/admin/addagent" 
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            + Add Agent
          </a>
        </div>

        {/* Main Canvas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          
          {/* Top Bar (Search & Total) */}
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search agent name or phone..."
              className="pro-input max-w-sm border-gray-300 rounded-lg p-2 border w-full"
            />

            <div className="text-sm text-gray-500">
              Total Agents{" "}
              <span className="font-medium text-gray-900">
                {total}
              </span>
            </div>
          </div>

          {/* List Area */}
          <div className="divide-y">
            {loading ? (
              <div className="px-6 py-10 text-gray-500 text-center">
                Loading agents...
              </div>
            ) : agents.length === 0 ? (
              <div className="px-6 py-10 text-gray-500 text-center">
                No delivery agents found.
              </div>
            ) : (
              agents.map((agent) => (
                <div
                  key={agent.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 transition gap-4"
                >
                  {/* Left: Info */}
                  <div className="flex items-center gap-4">
                    {/* Avatar Circle */}
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold uppercase">
                      {agent.full_name?.charAt(0) || "A"}
                    </div>
                    
                    <div>
                      <div className="font-medium text-gray-900">
                        {agent.full_name || "Unnamed Agent"}
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5 flex gap-2">
                         <span>{agent.mobile || "No Phone"}</span>
                         {agent.building && (
                             <span className="text-gray-300">|</span>
                         )}
                         {agent.building && (
                             <span className="text-blue-600 font-medium">{agent.building}</span>
                         )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="hidden sm:block text-gray-500">
                      Joined{" "}
                      <span className="text-gray-900 font-medium">
                        {new Date(agent.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <button
                      onClick={() => setSelectedAgent(agent.id)}
                      className="text-blue-600 font-medium hover:underline"
                    >
                      View Details
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
              className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>

            <span className="text-sm text-gray-500">
              Page {page}
            </span>

            <button
              disabled={page * 10 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </main>

      {/* Drawer */}
      {/* {selectedAgent && (
        <AgentDrawer
          agentId={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )} */}
    </div>
  );
}