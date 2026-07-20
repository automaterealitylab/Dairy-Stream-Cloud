import { useEffect, useState } from "react";
import {
  fetchAdminAgentsById,
  updateAdminAgent,
  deleteAdminAgent,
} from "../../api/admin.api";
import LoadingIndicator from "../common/LoadingIndicator.jsx";

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
    } catch (_err) {
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
    } catch (_err) {
      alert("Failed to delete agent");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:border dark:border-[#1E293B] dark:bg-[#121829] dark:text-white dark:ring-white/10">
          <div className="flex items-center justify-between border-b bg-gradient-to-r from-gray-50 to-white p-6 dark:border-[#1E293B] dark:from-[#161C2C] dark:to-[#121829]">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Agent Details</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">Profile and routing overview</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="h-9 w-9 rounded-full border border-red-100 text-red-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-[#222B40] dark:bg-[#0B0F19] dark:text-red-400 dark:hover:border-red-500/40 dark:hover:bg-red-500/10"
            >
              X
            </button>
          </div>

          {!data ? (
            <LoadingIndicator className="p-6" message="Loading agent details..." />
          ) : (
            <div className="space-y-8 p-6">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">Agent</h3>
                  {isEditing ? (
                    <div className="mt-3 space-y-4">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-slate-400">Full Name</label>
                        <input
                          name="agent_name"
                          value={form.agent_name}
                          onChange={onInput}
                          placeholder="Full name"
                          className="w-full border-b border-gray-200 p-2 focus:outline-none dark:border-[#222B40] dark:bg-[#121829] dark:text-white dark:placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-slate-400">Phone</label>
                        <input
                          name="phone_number"
                          value={form.phone_number}
                          onChange={onInput}
                          placeholder="Phone"
                          className="w-full border-b border-gray-200 p-2 focus:outline-none dark:border-[#222B40] dark:bg-[#121829] dark:text-white dark:placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-slate-400">Email</label>
                        <input
                          name="email"
                          value={form.email}
                          onChange={onInput}
                          placeholder="Email"
                          className="w-full border-b border-gray-200 p-2 focus:outline-none dark:border-[#222B40] dark:bg-[#121829] dark:text-white dark:placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Full Name</p>
                        <p className="font-medium text-gray-900 dark:text-white">{agent?.full_name || agent?.agent_name || "Unnamed"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Phone</p>
                        <p className="text-sm text-gray-700 dark:text-slate-300">{agent?.mobile || agent?.phone_number || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Email</p>
                        <p className="text-sm text-gray-700 dark:text-slate-300">{agent?.email || "-"}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">Route</h3>
                  {isEditing ? (
                    <div className="mt-3 space-y-4">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-slate-400">Building</label>
                        <input
                          name="building"
                          value={form.building}
                          onChange={onInput}
                          placeholder="Building"
                          className="w-full border-b border-gray-200 p-2 focus:outline-none dark:border-[#222B40] dark:bg-[#121829] dark:text-white dark:placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Building</p>
                        <p className="font-medium text-gray-900 dark:text-white">{agent?.building || "-"}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">Joined</h3>
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Date</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {agent?.created_at ? new Date(agent.created_at).toLocaleDateString() : "-"}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">Availability</h3>
                  <div className="mt-3 space-y-1">
                    <p className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                      String(agent?.status || "ACTIVE").toUpperCase() === "INACTIVE"
                        ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                        : "bg-green-100 text-green-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                    }`}>
                      {String(agent?.status || "ACTIVE").toUpperCase()}
                    </p>
                    {String(agent?.status || "ACTIVE").toUpperCase() === "INACTIVE" && agent?.inactive_until && (
                      <p className="text-xs text-gray-600 dark:text-slate-400">
                        Until {new Date(agent.inactive_until).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t bg-gray-50/60 p-4 dark:border-[#1E293B] dark:bg-[#161C2C]">
            <div className="text-xs text-gray-500 dark:text-slate-400">ID: {agent?.id}</div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-white dark:border-[#222B40] dark:bg-[#121829] dark:text-slate-300 dark:hover:bg-[#1C243A]"
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
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-white dark:border-[#222B40] dark:bg-[#121829] dark:text-slate-300 dark:hover:bg-[#1C243A]"
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
