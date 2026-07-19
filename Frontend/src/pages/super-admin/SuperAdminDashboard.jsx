import React, { useEffect, useState } from "react";
import SuperAdminSidebar from "./SuperAdminSidebar.jsx";
import { fetchDashboardMetrics, fetchDashboardCharts } from "../../api/superAdmin.api.js";
import toast from "react-hot-toast";
import {
  TrendingUp,
  Users,
  Store,
  DollarSign,
  Globe,
  Tag,
  CreditCard,
  Download,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingDown
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import jsPDF from "jspdf";
import "jspdf-autotable";

const COLORS = ["#06b6d4", "#6366f1", "#a855f7", "#10b981", "#f59e0b"];

const SuperAdminDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [chartsData, setChartsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [metricsResp, chartsResp] = await Promise.all([
          fetchDashboardMetrics(),
          fetchDashboardCharts(),
        ]);

        if (metricsResp.success) setMetrics(metricsResp.metrics);
        if (chartsResp.success) setChartsData(chartsResp);
      } catch (err) {
        toast.error("Failed to load dashboard statistics");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const exportCSVReport = () => {
    if (!metrics) return;
    const csvContent = [
      ["Telemetry Metric", "Current Value"],
      ["Total Registered Dairies", metrics.totalRegisteredDairies],
      ["Total Active Dairies", metrics.totalActiveDairies],
      ["Total Customers", metrics.totalCustomers],
      ["Total Delivery Agents", metrics.totalDeliveryAgents],
      ["Total Revenue", `INR ${metrics.totalRevenue}`],
      ["Monthly SaaS Revenue", `INR ${metrics.monthlyRevenue}`],
      ["Active Users Today", metrics.activeUsersToday],
      ["New Dairies Today", metrics.newDairiesToday],
      ["Renewals Scheduled Today", metrics.renewalsToday],
      ["Coupons Redeemed", metrics.couponsRedeemed],
      ["Total Transactions Processed", metrics.totalTransactions],
      ["Website Unique Visitors", metrics.uniqueVisitors],
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `platform_telemetry_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Report exported successfully!");
  };

  const exportPDFReport = () => {
    if (!metrics) return;
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text("DairyStream Cloud Platform Report", 14, 22);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    doc.text("Portal: Company Super Admin Dashboard", 14, 33);

    const tableRows = [
      ["Registered Dairies", metrics.totalRegisteredDairies, "Active Platform Dairies", metrics.totalActiveDairies],
      ["Total Customers", metrics.totalCustomers, "Total Delivery Agents", metrics.totalDeliveryAgents],
      ["Cumulative Revenue", `INR ${metrics.totalRevenue}`, "Monthly Intake (SaaS)", `INR ${metrics.monthlyRevenue}`],
      ["Transactions Checked", metrics.totalTransactions, "Coupons Redeemed", metrics.couponsRedeemed],
      ["Active Users Today", metrics.activeUsersToday, "New Registrations Today", metrics.newDairiesToday],
      ["Platform Traffic (Hits)", metrics.totalVisitors, "Unique Visitors", metrics.uniqueVisitors],
    ];

    doc.autoTable({
      startY: 40,
      head: [["Metric A", "Value A", "Metric B", "Value B"]],
      body: tableRows,
      theme: "striped",
      headStyles: { fillColor: [99, 102, 241] },
      styles: { cellPadding: 5, fontSize: 10 }
    });

    if (chartsData?.topDairies) {
      const topDairiesRows = chartsData.topDairies.map((d, index) => [
        index + 1,
        d.name,
        d.customers,
        d.orders,
        `INR ${d.revenue}`
      ]);
      doc.text("Top Performing Platform Dairies", 14, doc.lastAutoTable.finalY + 15);
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 20,
        head: [["Rank", "Dairy Name", "Total Customers", "Orders Processed", "Total Revenue"]],
        body: topDairiesRows,
        theme: "grid",
        headStyles: { fillColor: [6, 182, 212] },
        styles: { fontSize: 9 }
      });
    }

    doc.save(`dairystream_hq_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF Report generated and saved!");
  };

  if (loading) {
    return (
      <SuperAdminSidebar>
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
          <div className="w-12 h-12 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin mb-4"></div>
          <p className="text-slate-400 font-medium">Aggregating Cloud Platform Telemetry...</p>
        </div>
      </SuperAdminSidebar>
    );
  }

  return (
    <SuperAdminSidebar>
      {/* Upper Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Platform Command Center
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            System overview and SaaS transaction logs for DairyStream Cloud network.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSVReport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-xs font-semibold transition-all duration-200 cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={exportPDFReport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 active:scale-98 transition-all duration-200 cursor-pointer"
          >
            <Layers size={14} />
            <span>Generate Executive PDF</span>
          </button>
        </div>
      </div>

      {/* Main Core metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { title: "Registered Dairies", val: metrics.totalRegisteredDairies, sub: `${metrics.totalActiveDairies} Active Now`, icon: Store, trend: "+8.2%", color: "text-cyan-400 border-cyan-500/10" },
          { title: "Monthly SaaS Intake", val: `₹${metrics.monthlyRevenue.toLocaleString()}`, sub: `Cumulative: ₹${metrics.totalRevenue.toLocaleString()}`, icon: DollarSign, trend: "+12.4%", color: "text-emerald-400 border-emerald-500/10" },
          { title: "Global Customer Base", val: metrics.totalCustomers.toLocaleString(), sub: `${metrics.activeUsersToday.toLocaleString()} Active Today`, icon: Users, trend: "+5.1%", color: "text-indigo-400 border-indigo-500/10" },
          { title: "Platform Traffic", val: metrics.totalVisitors.toLocaleString(), sub: `${metrics.uniqueVisitors.toLocaleString()} Unique IP sessions`, icon: Globe, trend: "+18.3%", color: "text-purple-400 border-purple-500/10" },
        ].map((card, i) => (
          <div key={i} className="bg-slate-900/40 border border-slate-850/60 backdrop-blur rounded-2xl p-5 hover:border-slate-800 transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 font-mono">{card.title}</span>
              <card.icon size={20} className={card.color.split(" ")[0]} />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-100">{card.val}</span>
              <span className="text-[10px] font-bold text-emerald-500 flex items-center bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">
                <ArrowUpRight size={10} />
                {card.trend}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Secondary Dashboard Grid metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Delivery Agents", val: metrics.totalDeliveryAgents, icon: Users },
          { label: "New Dairies Today", val: metrics.newDairiesToday, icon: Calendar },
          { label: "SaaS Renewals Today", val: metrics.renewalsToday, icon: CreditCard },
          { label: "Coupons Redeemed", val: metrics.couponsRedeemed, icon: Tag }
        ].map((sub, idx) => (
          <div key={idx} className="bg-slate-900/20 border border-slate-900 rounded-xl p-4 flex items-center gap-3.5">
            <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-slate-400">
              <sub.icon size={16} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-mono leading-tight">{sub.label}</p>
              <h5 className="text-base font-extrabold text-slate-200 mt-0.5">{sub.val}</h5>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Analytics Charts */}
      {chartsData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue and Traffic Chart */}
          <div className="lg:col-span-2 bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-200 text-sm">Monthly Revenue Growth</h3>
                <span className="text-[10px] text-slate-500">Platform subscription fees collection trend (SaaS)</span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsData.monthlyRevenueGrowth}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155" }} />
                  <Bar dataKey="revenue" fill="url(#colorRevenue)">
                    {chartsData.monthlyRevenueGrowth.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 5 ? "#06b6d4" : "#6366f1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subscription Plans breakdown */}
          <div className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <h3 className="font-extrabold text-slate-200 text-sm">SaaS Plan Analytics</h3>
              <span className="text-[10px] text-slate-500">Breakdown of active subscription plan tiers</span>
            </div>
            <div className="h-44 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartsData.subscriptionPlans}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartsData.subscriptionPlans.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {chartsData.subscriptionPlans.map((entry, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                    <span>{entry.plan}</span>
                  </div>
                  <span className="font-bold text-slate-200">{entry.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Daily user growth & registrations */}
          <div className="lg:col-span-2 bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-200 text-sm">Visitor Traffic & Engagement</h3>
              <span className="text-[10px] text-slate-500">Daily unique sessions vs pageviews</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartsData.websiteVisitors}>
                  <defs>
                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155" }} />
                  <Area type="monotone" dataKey="visitors" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorVisitors)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Performing Dairies */}
          <div className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-200 text-sm">Top Performing Dairies</h3>
              <span className="text-[10px] text-slate-500">Top revenue generating dairies on platform</span>
            </div>
            <div className="space-y-3">
              {chartsData.topDairies.map((dairy, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-950/40 border border-slate-850/40 hover:border-slate-800 transition-colors">
                  <div>
                    <h5 className="text-xs font-semibold text-slate-200">{dairy.name}</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">{dairy.customers} active customers</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-cyan-400">₹{dairy.revenue.toLocaleString()}</span>
                    <p className="text-[9px] text-slate-500 mt-0.5">{dairy.orders} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </SuperAdminSidebar>
  );
};

export default SuperAdminDashboard;
