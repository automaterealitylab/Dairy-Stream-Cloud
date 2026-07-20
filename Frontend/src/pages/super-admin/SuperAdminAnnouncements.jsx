import React, { useEffect, useState } from "react";
import SuperAdminSidebar from "./SuperAdminSidebar.jsx";
import {
  fetchAnnouncementsApi,
  createAnnouncementApi,
  fetchDairiesApi
} from "../../api/superAdmin.api.js";
import toast from "react-hot-toast";
import { Send, Megaphone, Target, Users, Calendar, AlertTriangle, Layers, X } from "lucide-react";

const SuperAdminAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [dairies, setDairies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [announcementType, setAnnouncementType] = useState("NOTIFICATION");
  const [targetType, setTargetType] = useState("ALL");
  const [targetValue, setTargetValue] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [annResp, dairResp] = await Promise.all([
        fetchAnnouncementsApi(),
        fetchDairiesApi()
      ]);
      if (annResp.success) setAnnouncements(annResp.announcements || []);
      if (dairResp.success) setDairies(dairResp.dairies || []);
    } catch (err) {
      toast.error("Failed to load announcements log");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!title || !message) return;

    setActionLoading(true);
    try {
      const response = await createAnnouncementApi({
        title,
        message,
        announcementType,
        targetType,
        targetValue: targetType === "ALL" ? null : targetValue,
      });

      if (response.success) {
        toast.success("Broadcast announcement sent successfully!");
        setAnnouncements(prev => [response.announcement, ...prev]);
        // Reset form
        setTitle("");
        setMessage("");
        setAnnouncementType("NOTIFICATION");
        setTargetType("ALL");
        setTargetValue("");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to broadcast announcement");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SuperAdminSidebar>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Announcement & Notifications Board
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Broadcast platform announcements, maintenance down times, or campaign alerts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Broadcast Form */}
        <div className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 flex flex-col justify-between h-fit">
          <div>
            <h3 className="font-extrabold text-slate-200 text-sm mb-4 flex items-center gap-2">
              <Megaphone size={16} className="text-cyan-400" />
              <span>Compose Broadcast Alert</span>
            </h3>

            <form onSubmit={handleBroadcast} className="space-y-4 text-xs">
              {/* Type Option */}
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Alert Category</label>
                <select
                  value={announcementType}
                  onChange={(e) => setAnnouncementType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 text-slate-350 outline-none"
                >
                  <option value="NOTIFICATION">Standard Information Notice</option>
                  <option value="MAINTENANCE">Scheduled Server Maintenance</option>
                  <option value="PROMOTION">Promotional Plan Discount Offer</option>
                </select>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Broadcast Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="System maintenance warning, upgrade offers, etc."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                  required
                />
              </div>

              {/* Audience Target */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Target Audience</label>
                  <select
                    value={targetType}
                    onChange={(e) => {
                      setTargetType(e.target.value);
                      setTargetValue("");
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 text-slate-350 outline-none"
                  >
                    <option value="ALL">All Registered Dairies</option>
                    <option value="PLAN">Segment by Plan tier</option>
                    <option value="AREA">Segment by City</option>
                    <option value="SPECIFIC_DAIRIES">Target Specific Dairy</option>
                  </select>
                </div>

                {targetType !== "ALL" && (
                  <div className="space-y-1">
                    <label className="text-slate-400 font-semibold">Select Value</label>
                    {targetType === "PLAN" ? (
                      <select
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 text-slate-350 outline-none"
                        required
                      >
                        <option value="">Select Plan</option>
                        <option value="FREE">Starter Plan</option>
                        <option value="GROWTH">Growth Plan</option>
                        <option value="PRIME">Prime Plan</option>
                      </select>
                    ) : targetType === "AREA" ? (
                      <input
                        type="text"
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                        placeholder="e.g. Pune"
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500 outline-none text-slate-200"
                        required
                      />
                    ) : (
                      <select
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 text-slate-350 outline-none"
                        required
                      >
                        <option value="">Select Dairy</option>
                        {dairies.map(d => (
                          <option key={d.id} value={d.id}>{d.dairy_name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Message Details */}
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Broadcasting Message Body</label>
                <textarea
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter details of your message. HTML breaks (<br/>) are mapped automatically when sent."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200 font-sans resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold shadow-lg shadow-cyan-500/20 active:scale-98 transition-all duration-200 cursor-pointer"
              >
                <Send size={13} />
                <span>{actionLoading ? "Broadcasting Update..." : "Broadcast Update Alerts"}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Sent History List */}
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 flex flex-col min-h-[500px]">
          <h3 className="font-extrabold text-slate-200 text-sm mb-4">Past Broadcast Registry</h3>
          <div className="flex-1 space-y-4 max-h-[540px] overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                Retrieving sent broadcasts log...
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-20 text-slate-500 text-xs">
                No past announcements found. Create one on the left to display here.
              </div>
            ) : (
              announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-4 bg-slate-950/40 border border-slate-850/50 rounded-xl flex flex-col justify-between hover:border-slate-850 transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Megaphone size={13} className={ann.announcement_type === "MAINTENANCE" ? "text-amber-400" : "text-cyan-400"} />
                        <h4 className="font-bold text-slate-200 text-xs">{ann.title}</h4>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] font-mono text-slate-500 font-bold uppercase tracking-wider">
                        <span>Target: {ann.target_type}</span>
                        {ann.target_value && (
                          <>
                            <span>•</span>
                            <span>Scope: {ann.target_value.replace(/["'[\]]/g, "")}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <Calendar size={11} />
                      <span>{new Date(ann.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-3 whitespace-pre-line leading-relaxed">
                    {ann.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </SuperAdminSidebar>
  );
};

export default SuperAdminAnnouncements;
