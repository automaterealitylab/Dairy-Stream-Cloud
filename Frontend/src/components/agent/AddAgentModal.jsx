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

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden">
          <div className="px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Add New Delivery Agent</h2>
              <p className="text-sm text-gray-500">Create agent login and route assignment</p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="h-9 w-9 rounded-full border border-red-100 text-red-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 flex items-center justify-center"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
            <section>
              <h3 className="text-sm font-semibold text-blue-700 mb-4 flex items-center gap-2">
                <Lock size={16} />
                Login Credentials
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="agentId" className="block text-sm font-medium text-gray-700 mb-1">
                    Staff ID <span className="text-red-500">*</span>
                  </label>
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                    <div className="px-3 bg-gray-50 flex items-center">
                      <User size={16} className="text-gray-500" />
                    </div>
                    <input
                      type="text"
                      id="agentId"
                      name="agentId"
                      value={agent.agentId}
                      readOnly
                      required
                      className="flex-1 px-3 py-2 bg-gray-50 text-gray-600 font-semibold uppercase outline-none"
                    />
                    <button
                      type="button"
                      onClick={generateNewAgentId}
                      className="px-3 border-l border-gray-300 bg-white hover:bg-gray-50"
                      title="Generate new ID"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                    <div className="px-3 bg-gray-50 flex items-center">
                      <Lock size={16} className="text-gray-500" />
                    </div>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={agent.password}
                      onChange={inputHandler}
                      placeholder="Set login password"
                      required
                      className="flex-1 px-3 py-2 outline-none"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-blue-700 mb-4 flex items-center gap-2">
                <Briefcase size={16} />
                Agent Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="agentName" className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                    <div className="px-3 bg-gray-50 flex items-center">
                      <Phone size={16} className="text-gray-500" />
                    </div>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      value={agent.phoneNumber}
                      onChange={inputHandler}
                      placeholder="e.g., 9876543210"
                      required
                      className="flex-1 px-3 py-2 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                    <div className="px-3 bg-gray-50 flex items-center">
                      <Mail size={16} className="text-gray-500" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={agent.email}
                      onChange={inputHandler}
                      placeholder="agent@dairy.com"
                      required
                      className="flex-1 px-3 py-2 outline-none"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-blue-700 mb-4 flex items-center gap-2">
                <MapPin size={16} />
                Route Assignment
              </h3>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="building" className="text-sm font-medium text-gray-700">
                    Assigned Route / Building <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsManualEntry((prev) => !prev)}
                    className="text-xs px-3 py-1.5 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
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
                    className="w-full border border-blue-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
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
                      <div className="text-sm text-gray-500 mt-2 inline-flex items-center gap-2">
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
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={agent.isActive}
                onChange={inputHandler}
              />
              <label className="text-sm text-gray-700" htmlFor="isActive">
                Agent Account is <span className="font-semibold">Active</span>
              </label>
            </div>

            <div className="pt-2 border-t flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
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
