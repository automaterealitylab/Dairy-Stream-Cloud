import React, { useEffect, useState } from "react";
import SuperAdminSidebar from "./SuperAdminSidebar.jsx";
import { fetchTicketsApi, updateTicketApi } from "../../api/superAdmin.api.js";
import toast from "react-hot-toast";
import {
  LifeBuoy,
  MessageSquare,
  AlertTriangle,
  Clock,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Phone,
  User,
  X,
  Eye
} from "lucide-react";

const SuperAdminSupport = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // Selected Ticket for details View Modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await fetchTicketsApi({
        status: statusFilter,
        priority: priorityFilter
      });
      if (response.success) {
        setTickets(response.tickets || []);
      }
    } catch (err) {
      toast.error("Failed to load support tickets");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [statusFilter, priorityFilter]);

  const handleUpdateTicket = async (ticketId, nextStatus, nextPriority) => {
    setActionLoading(true);
    try {
      const response = await updateTicketApi(ticketId, {
        status: nextStatus,
        priority: nextPriority
      });

      if (response.success) {
        toast.success("Support ticket updated successfully!");
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: nextStatus, priority: nextPriority } : t));
        if (selectedTicket && selectedTicket.id === ticketId) {
          setSelectedTicket(prev => ({ ...prev, status: nextStatus, priority: nextPriority }));
        }
      }
    } catch (_err) {
      toast.error("Failed to update support ticket parameters");
    } finally {
      setActionLoading(false);
    }
  };

  const getPriorityBadgeColor = (priority) => {
    switch (priority) {
      case "CRITICAL": return "bg-rose-500/10 text-rose-400 border-rose-500/10";
      case "HIGH": return "bg-orange-500/10 text-orange-400 border-orange-500/10";
      case "MEDIUM": return "bg-cyan-500/10 text-cyan-400 border-cyan-500/10";
      default: return "bg-slate-500/10 text-slate-400 border-slate-500/10";
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "OPEN": return "bg-rose-500/10 text-rose-400 border-rose-500/15";
      case "PENDING": return "bg-amber-500/10 text-amber-400 border-amber-500/15";
      case "RESOLVED": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/15";
      default: return "bg-slate-500/10 text-slate-400 border-slate-500/15";
    }
  };

  return (
    <SuperAdminSidebar>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Support Desk & Tickets
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage complaints, payment disputes, plan upgrades requests, or general dairy support issues.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900/40 border border-slate-850/60 backdrop-blur rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mr-2">Filter Board:</span>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full md:w-44 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 text-slate-300 text-xs outline-none"
        >
          <option value="ALL">All Status States</option>
          <option value="OPEN">Open issues</option>
          <option value="PENDING">Pending updates</option>
          <option value="RESOLVED">Resolved issues</option>
          <option value="CLOSED">Closed tickets</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="w-full md:w-44 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 text-slate-300 text-xs outline-none"
        >
          <option value="ALL">All Priority Scales</option>
          <option value="CRITICAL">Critical Priority</option>
          <option value="HIGH">High Priority</option>
          <option value="MEDIUM">Medium Priority</option>
          <option value="LOW">Low Priority</option>
        </select>
      </div>

      {/* Tickets List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {loading ? (
          <div className="md:col-span-2 text-center py-20 text-slate-500 text-xs">
            Fetching ticket desk logs...
          </div>
        ) : tickets.length === 0 ? (
          <div className="md:col-span-2 text-center py-20 text-slate-500">
            No support tickets open matching the selected criteria.
          </div>
        ) : (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 hover:border-slate-800 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider bg-slate-950 border border-slate-850 px-2 py-0.5 rounded">
                      Category: {ticket.category}
                    </span>
                    <h4 className="font-bold text-slate-200 text-sm mt-2">{ticket.subject}</h4>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Dairy: {ticket.dairies?.dairy_name || "Platform Tenant"}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider font-mono ${getPriorityBadgeColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                    <span className={`inline-flex px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider font-mono ${getStatusBadgeColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                </div>

                <p className="text-slate-400 text-xs mt-3 leading-normal line-clamp-2">
                  {ticket.description}
                </p>
              </div>

              <div className="border-t border-slate-850 pt-4 mt-5 flex justify-between items-center bg-slate-900/10">
                <span className="text-[10px] text-slate-500 font-mono">
                  Created: {new Date(ticket.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={() => setSelectedTicket(ticket)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-850 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Eye size={12} />
                  <span>Inspect Details</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Ticket Inspector Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl relative animate-scaleUp">
            
            <div className="flex justify-between items-start mb-5">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-cyan-400 bg-cyan-500/5 border border-cyan-500/10 px-2 py-0.5 rounded">
                  Ticket #{selectedTicket.id}
                </span>
                <h3 className="font-extrabold text-slate-100 text-base mt-2">{selectedTicket.subject}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Reporter: {selectedTicket.dairies?.dairy_name} ({selectedTicket.dairies?.owner_name})</p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="p-2 rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-850 text-slate-400">
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Ticket Description */}
              <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-4 text-xs text-slate-350 leading-relaxed max-h-48 overflow-y-auto">
                {selectedTicket.description}
              </div>

              {/* Dairy Contact Details */}
              <div className="flex gap-4 p-3.5 bg-slate-950/10 border border-slate-850 rounded-xl text-xs text-slate-400">
                <div className="flex-1 flex items-center gap-2">
                  <User size={13} className="text-slate-500" />
                  <span className="truncate">{selectedTicket.dairies?.dairy_email}</span>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <Phone size={13} className="text-slate-500" />
                  <span>{selectedTicket.dairies?.dairy_phone || "-"}</span>
                </div>
              </div>

              {/* Adjust ticket parameters */}
              <div className="border-t border-slate-850 pt-4 grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px] font-mono">Toggle Ticket Status</label>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleUpdateTicket(selectedTicket.id, e.target.value, selectedTicket.priority)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-850 text-slate-300 outline-none"
                    disabled={actionLoading}
                  >
                    <option value="OPEN">OPEN / UNRESOLVED</option>
                    <option value="PENDING">PENDING UPDATE</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED / ARCHIVED</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px] font-mono">Assign Priority Rank</label>
                  <select
                    value={selectedTicket.priority}
                    onChange={(e) => handleUpdateTicket(selectedTicket.id, selectedTicket.status, e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-850 text-slate-300 outline-none"
                    disabled={actionLoading}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-850 pt-5 flex justify-end">
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Close View
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </SuperAdminSidebar>
  );
};

export default SuperAdminSupport;
