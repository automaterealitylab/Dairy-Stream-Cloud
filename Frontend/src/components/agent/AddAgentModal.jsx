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
    } catch (_error) {
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
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={closeModal} />

      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div className="flex w-full max-w-2xl flex-col rounded-t-[28px] bg-[#FFFDF8] shadow-[0_28px_60px_rgba(44,26,14,0.18)] dark:border dark:border-[#1E293B] dark:bg-[#121829] sm:rounded-[28px]">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#F2EDE4] bg-[#FFFDF8] px-6 py-5 dark:border-[#1E293B] dark:bg-[#121829]">
            <div>
              <h2 className="text-xl font-bold text-[#2C1A0E] dark:text-white">Add New Delivery Agent</h2>
              <p className="text-xs font-semibold text-[#8B7355] dark:text-slate-400">Create agent login credentials and route assignment</p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#A88763] hover:bg-[#F5F0E8] hover:text-[#2C1A0E] transition dark:border-[#222B40] dark:bg-[#0B0F19] dark:hover:bg-[#1C243A]"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-6 dark:text-white">
            
            {/* Login Credentials Section */}
            <section className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[#B8641A] dark:text-[#fbbf24]">
                <Lock size={16} />
                Login Credentials
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="agentId" className="mb-1.5 block text-xs font-black uppercase text-[#8B7355] dark:text-slate-300">
                    Staff ID <span className="text-red-500">*</span>
                  </label>
                  <div className="flex overflow-hidden rounded-xl border border-[#EDE8DF] dark:border-[#222B40]">
                    <div className="flex items-center bg-[#FAF7F2] px-3 dark:bg-[#0B0F19]">
                      <User size={16} className="text-[#A88763] dark:text-slate-500" />
                    </div>
                    <input
                      type="text"
                      id="agentId"
                      name="agentId"
                      value={agent.agentId}
                      readOnly
                      required
                      className="flex-1 bg-[#FAF7F2] px-3 py-2.5 font-bold uppercase text-[#5C3D1E] outline-none dark:bg-[#161C2C] dark:text-slate-200"
                    />
                    <button
                      type="button"
                      onClick={generateNewAgentId}
                      className="border-l border-[#EDE8DF] bg-white px-3 text-[#B8641A] hover:bg-[#FDF6EC] transition dark:border-[#222B40] dark:bg-[#121829] dark:text-slate-300 dark:hover:bg-[#1C243A]"
                      title="Generate new ID"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-xs font-black uppercase text-[#8B7355] dark:text-slate-300">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="flex overflow-hidden rounded-xl border border-[#EDE8DF] dark:border-[#222B40] focus-within:ring-2 focus-within:ring-[#B8641A]/20">
                    <div className="flex items-center bg-[#FAF7F2] px-3 dark:bg-[#0B0F19]">
                      <Lock size={16} className="text-[#A88763] dark:text-slate-500" />
                    </div>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={agent.password}
                      onChange={inputHandler}
                      placeholder="Set login password"
                      required
                      className="flex-1 px-3 py-2.5 outline-none bg-white text-[#2C1A0E] dark:bg-[#161C2C] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Agent Details Section */}
            <section className="space-y-4 border-t border-[#F2EDE4] pt-6 dark:border-[#1E293B]">
              <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[#B8641A] dark:text-[#fbbf24]">
                <Briefcase size={16} />
                Agent Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="agentName" className="mb-1.5 block text-xs font-black uppercase text-[#8B7355] dark:text-slate-300">
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
                    className="w-full rounded-xl border border-[#EDE8DF] px-4 py-2.5 text-[#2C1A0E] outline-none transition focus:ring-2 focus:ring-[#B8641A]/20 focus:border-[#B8641A] dark:border-[#222B40] dark:bg-[#161C2C] dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label htmlFor="phoneNumber" className="mb-1.5 block text-xs font-black uppercase text-[#8B7355] dark:text-slate-300">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="flex overflow-hidden rounded-xl border border-[#EDE8DF] dark:border-[#222B40] focus-within:ring-2 focus-within:ring-[#B8641A]/20">
                    <div className="flex items-center bg-[#FAF7F2] px-3 dark:bg-[#0B0F19]">
                      <Phone size={16} className="text-[#A88763] dark:text-slate-500" />
                    </div>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      value={agent.phoneNumber}
                      onChange={inputHandler}
                      placeholder="e.g., 9876543210"
                      required
                      className="flex-1 px-3 py-2.5 outline-none bg-white text-[#2C1A0E] dark:bg-[#161C2C] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-black uppercase text-[#8B7355] dark:text-slate-300">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="flex overflow-hidden rounded-xl border border-[#EDE8DF] dark:border-[#222B40] focus-within:ring-2 focus-within:ring-[#B8641A]/20">
                    <div className="flex items-center bg-[#FAF7F2] px-3 dark:bg-[#0B0F19]">
                      <Mail size={16} className="text-[#A88763] dark:text-slate-500" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={agent.email}
                      onChange={inputHandler}
                      placeholder="agent@dairy.com"
                      required
                      className="flex-1 px-3 py-2.5 outline-none bg-white text-[#2C1A0E] dark:bg-[#161C2C] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Route Assignment Section */}
            <section className="space-y-4 border-t border-[#F2EDE4] pt-6 dark:border-[#1E293B]">
              <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[#B8641A] dark:text-[#fbbf24]">
                <MapPin size={16} />
                Route Assignment
              </h3>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="building" className="text-xs font-black uppercase text-[#8B7355] dark:text-slate-300">
                    Assigned Route / Building <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsManualEntry((prev) => !prev)}
                    className="rounded-full border border-[#EDE8DF] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#B8641A] hover:bg-[#FDF6EC] transition-colors dark:border-slate-800 dark:text-slate-300 dark:hover:bg-[#1C243A]"
                  >
                    {isManualEntry ? "Select from List" : "Type Manually"}
                  </button>
                </div>

                {fetchError && <p className="text-xs text-red-500 mb-2 font-bold">{fetchError}</p>}

                {isManualEntry ? (
                  <input
                    type="text"
                    id="building"
                    name="building"
                    value={agent.building}
                    onChange={inputHandler}
                    placeholder="Type new building name"
                    required
                    className="w-full rounded-xl border border-[#EDE8DF] px-4 py-2.5 text-[#2C1A0E] outline-none transition focus:ring-2 focus:ring-[#B8641A]/20 focus:border-[#B8641A] dark:border-[#222B40] dark:bg-[#161C2C] dark:text-white dark:placeholder:text-slate-500"
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
                      className="w-full rounded-xl border border-[#EDE8DF] px-4 py-2.5 text-[#2C1A0E] outline-none transition focus:ring-2 focus:ring-[#B8641A]/20 focus:border-[#B8641A] disabled:bg-gray-50 dark:border-[#222B40] dark:bg-[#161C2C] dark:text-white dark:disabled:bg-[#0B0F19]"
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
                      <div className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-[#8B7355] dark:text-slate-400">
                        <Loader2 size={12} className="animate-spin text-[#B8641A]" />
                        Loading available routes...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <div className="flex items-center gap-2 pt-2">
              <input
                className="h-4 w-4 rounded border-[#EDE8DF] text-[#B8641A] focus:ring-[#B8641A]/30 dark:border-[#222B40] dark:bg-[#161C2C]"
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={agent.isActive}
                onChange={inputHandler}
              />
              <label className="text-xs font-bold text-[#5C3D1E] dark:text-slate-300 cursor-pointer" htmlFor="isActive">
                Agent Account is <span className="font-semibold text-[#B8641A] dark:text-[#fbbf24]">Active</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#F2EDE4] pt-5 dark:border-[#1E293B]">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-[#EDE8DF] bg-white px-5 py-2.5 text-sm font-bold text-[#8B7355] hover:bg-[#FDF6EC] transition dark:border-[#222B40] dark:bg-[#161C2C] dark:text-slate-300 dark:hover:bg-[#1C243A]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isLoadingBuildings}
                className="rounded-xl bg-[#B8641A] px-6 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#9E5415] disabled:opacity-50"
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
