import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, CheckCircle, XCircle, Zap, Calendar, Target, Award, Search, Filter,Loader2 } from 'lucide-react';

// Layout Components
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";

const AdminPerformance = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dateRange, setDateRange] = useState('7days');
  const [loading, setLoading] = useState(true);

  // Mock Data (Aligned with your project brief requirements)
  const performanceData = [
    { agent: 'Raj Kumar', completed: 45, failed: 5, efficiency: 90 },
    { agent: 'Priya Singh', completed: 42, failed: 3, efficiency: 93 },
    { agent: 'Amit Patel', completed: 38, failed: 7, efficiency: 84 },
    { agent: 'Neha Verma', completed: 40, failed: 5, efficiency: 89 },
    { agent: 'Sanjay Gupta', completed: 35, failed: 8, efficiency: 81 },
  ];

  const topPerformers = [
    { name: 'Priya Singh', score: 93, count: 42 },
    { name: 'Raj Kumar', score: 90, count: 45 },
    { name: 'Neha Verma', score: 89, count: 40 },
  ];

  const missedDeliveries = [
    { agent: 'Sanjay Gupta', customer: 'John Doe', reason: 'CUSTOMER_UNAVAILABLE', date: '13/03/2026' },
    { agent: 'Amit Patel', customer: 'Jane Smith', reason: 'PAYMENT_ISSUE', date: '12/03/2026' },
  ];

  const efficiencyStats = [
    { name: '90-100%', value: 2, color: '#10b981' },
    { name: '80-90%', value: 3, color: '#f59e0b' },
    { name: '< 80%', value: 0, color: '#ef4444' },
  ];

  useEffect(() => {
    // Simulate API fetch
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, [dateRange]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-blue-600" size={40} />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Analyzing Metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <AdminMobileTopbar title="Performance Analytics" onMenu={() => setSidebarOpen(true)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="lg:ml-64 px-4 sm:px-8 lg:px-12 py-10 pb-32">
        
        {/* HEADER AREA */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Agent Intelligence</h1>
            <p className="text-slate-500 font-medium text-sm">Real-time delivery efficiency and reliability scores.</p>
          </div>
          
          <div className="flex bg-slate-100 p-1.5 rounded-[20px] border border-slate-200">
            {['7days', '30days', 'month'].map((range) => (
              <button 
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-6 py-2.5 text-[10px] font-black rounded-[14px] transition-all uppercase tracking-widest ${
                  dateRange === range ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* KPI GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[
            { label: 'Avg Efficiency', val: '88.4%', icon: Target, col: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Total Deliveries', val: '223', icon: Zap, col: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Success Rate', val: '91.2%', icon: CheckCircle, col: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Missed Hits', val: '28', icon: XCircle, col: 'text-rose-600', bg: 'bg-rose-50' }
          ].map((kpi, i) => (
            <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-blue-200 transition-all">
              <div className={`h-14 w-14 ${kpi.bg} ${kpi.col} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <kpi.icon size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
                <h3 className="text-2xl font-black text-slate-900">{kpi.val}</h3>
              </div>
            </div>
          ))}
        </div>

        {/* CHARTS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Bar Chart */}
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
            <h3 className="text-lg font-black text-slate-800 mb-8 uppercase tracking-tighter flex items-center gap-2">
              <Users size={20} className="text-blue-500" /> Delivery Volume by Agent
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="agent" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                  <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="completed" fill="#3B82F6" radius={[6, 6, 0, 0]} name="Successful" />
                  <Bar dataKey="failed" fill="#FDA4AF" radius={[6, 6, 0, 0]} name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
            <h3 className="text-lg font-black text-slate-800 mb-8 uppercase tracking-tighter flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-500" /> Efficiency Clusters
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={efficiencyStats}
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {efficiencyStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* TOP PERFORMERS LIST */}
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
            <h3 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-tighter flex items-center gap-2">
              <Award size={20} className="text-amber-500" /> Top Agents
            </h3>
            <div className="space-y-4">
              {topPerformers.map((agent, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-hover hover:border-blue-200">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-sm shadow-md shadow-blue-200">
                      #{i+1}
                    </div>
                    <div>
                      <p className="font-black text-slate-800 text-sm">{agent.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{agent.count} Completed</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-blue-600">{agent.score}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAILED DELIVERY TRACKER */}
          <div className="lg:col-span-2 bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-50">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Recent Failure Logs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-4">Agent / Customer</th>
                    <th className="px-8 py-4">Status / Reason</th>
                    <th className="px-8 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {missedDeliveries.map((item, i) => (
                    <tr key={i} className="hover:bg-blue-50/20 transition-all">
                      <td className="px-8 py-5">
                        <div className="font-black text-slate-800 text-sm">{item.agent}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">To: {item.customer}</div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-widest">
                          {item.reason.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-500">{item.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default AdminPerformance;