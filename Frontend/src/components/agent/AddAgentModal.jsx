import { useEffect, useState } from "react";
import client from "../../api/client";
import {
  User,
  Lock,
  Phone,
  MapPin,
  Mail,
  Briefcase,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

const initialAgentState = {
  agentId: "",
  password: "",
  agentName: "",
  phoneNumber: "",
  email: "",
  building: "",
  isActive: true,
};

export default function AddAgentModal({ open, onClose, onCreated }) {
  const [agent, setAgent] = useState(initialAgentState);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [buildingNames, setBuildingNames] = useState([]);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const inputHandler = (e) => {
    const { name, value, type, checked } = e.target;
    setAgent((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const generateNewAgentId = async () => {
    try {
      const response = await client.get("/admin/agents/generate-id");
      const newId = response?.data?.agentId;
      if (!newId) throw new Error("No agentId returned by server");
      setAgent((prev) => ({ ...prev, agentId: newId }));
    } catch (error) {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      setAgent((prev) => ({ ...prev, agentId: `STF${randomNum}` }));
    }
  };

  useEffect(() => {
    if (!open) return;
    let active = true;

    const bootstrapData = async () => {
      await generateNewAgentId();
      try {
        setIsLoadingBuildings(true);
        const response = await client.get("/admin/buildings");
        if (!active) return;
        setBuildingNames(Array.isArray(response.data) ? response.data : []);
        setFetchError(null);
        if (!response.data || response.data.length === 0) {
          setIsManualEntry(true);
        }
      } catch (error) {
        if (!active) return;
        setBuildingNames([]);
        setIsManualEntry(true);
        if (error.response?.status === 401) {
          setFetchError("Session expired. Please login again.");
        } else {
          setFetchError("Could not load areas. Check server.");
        }
      } finally {
        if (active) setIsLoadingBuildings(false);
      }
    };

    bootstrapData();
    return () => {
      active = false;
    };
  }, [open]);

  const closeModal = () => {
    setAgent(initialAgentState);
    setIsManualEntry(false);
    setBuildingNames([]);
    setFetchError(null);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agent.agentId || !agent.password || !agent.agentName || !agent.phoneNumber || !agent.building) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await client.post("/admin/addagent", agent);
      const createdAgentId = response?.data?.data?.agent_id || agent.agentId;
      alert(
        `Delivery Agent Created Successfully!\n\nAgent ID: ${createdAgentId}\n(Please share this ID with the agent for login)`
      );
      if (onCreated) onCreated();
      closeModal();
    } catch (error) {
      if (error.response?.status === 401) {
        alert("Session expired. Please login again.");
        closeModal();
        return;
      }
      const msg = error.response?.data?.error || "Network Error";
      alert(`Failed to add agent: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={closeModal} />

      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:border dark:border-[#1E293B] dark:bg-[#121829] dark:ring-white/10 sm:max-h-[85vh] sm:rounded-2xl">
          <div className="flex items-center justify-between border-b bg-gradient-to-r from-gray-50 to-white px-4 py-3 dark:border-[#1E293B] dark:from-[#161C2C] dark:to-[#121829] sm:px-6 sm:py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Delivery Agent</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">Create agent login and route assignment</p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-red-100 text-red-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-[#222B40] dark:bg-[#0B0F19] dark:text-red-400 dark:hover:border-red-500/40 dark:hover:bg-red-500/10"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-4 dark:text-white sm:space-y-6 sm:p-6">
            <section>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-[#3B82F6]">
                <Lock size={16} />
                Login Credentials
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="agentId" className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                    Staff ID <span className="text-red-500">*</span>
                  </label>
                  <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-[#222B40]">
                    <div className="flex items-center bg-gray-50 px-3 dark:bg-[#0B0F19]">
                      <User size={16} className="text-gray-500 dark:text-slate-500" />
                    </div>
                    <input
                      type="text"
                      id="agentId"
                      name="agentId"
                      value={agent.agentId}
                      readOnly
                      required
                      className="flex-1 bg-gray-50 px-3 py-2 font-semibold uppercase text-gray-600 outline-none dark:bg-[#161C2C] dark:text-slate-200"
                    />
                    <button
                      type="button"
                      onClick={generateNewAgentId}
                      className="border-l border-gray-300 bg-white px-3 hover:bg-gray-50 dark:border-[#222B40] dark:bg-[#121829] dark:text-slate-300 dark:hover:bg-[#1C243A]"
                      title="Generate new ID"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-[#222B40]">
                    <div className="flex items-center bg-gray-50 px-3 dark:bg-[#0B0F19]">
                      <Lock size={16} className="text-gray-500 dark:text-slate-500" />
                    </div>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={agent.password}
                      onChange={inputHandler}
                      placeholder="Set login password"
                      required
                      className="flex-1 px-3 py-2 outline-none dark:bg-[#161C2C] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-[#3B82F6]">
                <Briefcase size={16} />
                Agent Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="agentName" className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="agentName"
                    name="agentName"
                    value={agent.agentName}
                    onChange={inputHandler}
                    placeholder="e.g., Rajesh Kumar"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 dark:border-[#222B40] dark:bg-[#161C2C] dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label htmlFor="phoneNumber" className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-[#222B40]">
                    <div className="flex items-center bg-gray-50 px-3 dark:bg-[#0B0F19]">
                      <Phone size={16} className="text-gray-500 dark:text-slate-500" />
                    </div>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      value={agent.phoneNumber}
                      onChange={inputHandler}
                      placeholder="e.g., 9876543210"
                      required
                      className="flex-1 px-3 py-2 outline-none dark:bg-[#161C2C] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-[#222B40]">
                    <div className="flex items-center bg-gray-50 px-3 dark:bg-[#0B0F19]">
                      <Mail size={16} className="text-gray-500 dark:text-slate-500" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={agent.email}
                      onChange={inputHandler}
                      placeholder="agent@dairy.com"
                      required
                      className="flex-1 px-3 py-2 outline-none dark:bg-[#161C2C] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-[#3B82F6]">
                <MapPin size={16} />
                Route Assignment
              </h3>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="building" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    Assigned Route / Building <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsManualEntry((prev) => !prev)}
                    className="rounded-md border border-blue-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10"
                  >
                    {isManualEntry ? "Select from List" : "Type Manually"}
                  </button>
                </div>

                {fetchError && <p className="text-sm text-red-500 mb-2">{fetchError}</p>}

                {isManualEntry ? (
                  <input
                    type="text"
                    id="building"
                    name="building"
                    value={agent.building}
                    onChange={inputHandler}
                    placeholder="Type new building name"
                    required
                    className="w-full rounded-lg border border-blue-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 dark:border-blue-500/40 dark:bg-[#161C2C] dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-blue-500/20"
                  />
                ) : (
                  <div>
                    <select
                      id="building"
                      name="building"
                      value={agent.building}
                      onChange={inputHandler}
                      disabled={isLoadingBuildings}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 dark:border-[#222B40] dark:bg-[#161C2C] dark:text-white dark:focus:ring-blue-500/20 dark:disabled:bg-[#0B0F19]"
                    >
                      <option value="" disabled>
                        -- Select Route --
                      </option>
                      {buildingNames.map((bName, index) => (
                        <option key={index} value={bName}>
                          {bName}
                        </option>
                      ))}
                    </select>
                    {isLoadingBuildings && (
                      <div className="mt-2 inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
                        <Loader2 size={14} className="animate-spin" />
                        Loading available routes...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <div className="flex items-center gap-2">
              <input
                className="h-4 w-4 rounded border-gray-300 text-blue-600 dark:border-[#222B40] dark:bg-[#161C2C]"
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={agent.isActive}
                onChange={inputHandler}
              />
              <label className="text-sm text-gray-700 dark:text-slate-300" htmlFor="isActive">
                Agent Account is <span className="font-semibold">Active</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t pt-2 dark:border-[#1E293B]">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-[#222B40] dark:bg-[#161C2C] dark:text-slate-300 dark:hover:bg-[#1C243A] dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isLoadingBuildings}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save Agent"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
