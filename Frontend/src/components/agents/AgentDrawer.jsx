import { useEffect, useState } from "react";
import {
  fetchAdminAgentsById,
  updateAdminAgent,
  deleteAdminAgent,
} from "../../api/admin.api";

export default function AgentDrawer({ agentId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({
    agent_name: "",
    phone_number: "",
    email: "",
    building: "",
  });

  useEffect(() => {
    if (!agentId) return;

    fetchAdminAgentsById(agentId)
      .then((res) => {
        setData(res);
        const a = res?.agent || {};
        setForm({
          agent_name: a.agent_name || a.full_name || "",
          phone_number: a.phone_number || a.mobile || "",
          email: a.email || "",
          building: a.building || "",
        });
        setIsEditing(false);
      })
      .catch(() => setData(null));
  }, [agentId]);

  if (!agentId) return null;

  const agent = data?.agent;

  const onInput = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await updateAdminAgent(agentId, form);
      setData({ agent: res.agent });
      setIsEditing(false);
      if (onChanged) onChanged();
    } catch (err) {
      alert("Failed to update agent");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm("Delete this agent? This cannot be undone.");
    if (!ok) return;

    try {
      setIsDeleting(true);
      await deleteAdminAgent(agentId);
      if (onChanged) onChanged();
      onClose();
    } catch (err) {
      alert("Failed to delete agent");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden">
          <div className="p-6 border-b bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Agent Details</h2>
              <p className="text-sm text-gray-500">Profile and routing overview</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="h-9 w-9 rounded-full border border-red-100 text-red-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
            >
              X
            </button>
          </div>

          {!data ? (
            <div className="p-6 text-gray-500">Loading...</div>
          ) : (
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wide">Agent</h3>
                  {isEditing ? (
                    <div className="mt-3 space-y-4">
                      <div>
                        <label className="text-xs text-gray-500">Full Name</label>
                        <input
                          name="agent_name"
                          value={form.agent_name}
                          onChange={onInput}
                          placeholder="Full name"
                          className="w-full border-b border-gray-200 p-2 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Phone</label>
                        <input
                          name="phone_number"
                          value={form.phone_number}
                          onChange={onInput}
                          placeholder="Phone"
                          className="w-full border-b border-gray-200 p-2 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Email</label>
                        <input
                          name="email"
                          value={form.email}
                          onChange={onInput}
                          placeholder="Email"
                          className="w-full border-b border-gray-200 p-2 focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500">Full Name</p>
                        <p className="font-medium">{agent?.full_name || agent?.agent_name || "Unnamed"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="text-sm text-gray-700">{agent?.mobile || agent?.phone_number || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-sm text-gray-700">{agent?.email || "-"}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wide">Route</h3>
                  {isEditing ? (
                    <div className="mt-3 space-y-4">
                      <div>
                        <label className="text-xs text-gray-500">Building</label>
                        <input
                          name="building"
                          value={form.building}
                          onChange={onInput}
                          placeholder="Building"
                          className="w-full border-b border-gray-200 p-2 focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500">Building</p>
                        <p className="font-medium">{agent?.building || "-"}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wide">Joined</h3>
                  <div className="mt-3">
                    <p className="text-xs text-gray-500">Date</p>
                    <p className="text-sm">
                      {agent?.created_at ? new Date(agent.created_at).toLocaleDateString() : "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 border-t bg-gray-50/60 flex items-center justify-between">
            <div className="text-xs text-gray-500">ID: {agent?.id}</div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-2 text-sm border rounded-lg hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-2 text-sm border rounded-lg hover:bg-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? "Removing..." : "Remove"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
