import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ComposedChart, AreaChart, Area } from 'recharts';
import { TrendingUp, DollarSign, Activity, UserMinus, Users, Award, AlertCircle, UserCheck, Clock3, Zap } from 'lucide-react';
import { TopPerformerRow, FactorCard, FailureReasonRow, MissedDeliveryRow } from './index';

export const DailyDeliveryVolumeCard = ({ data }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60">
      <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-6 uppercase tracking-wider flex items-center gap-2">
        <TrendingUp size={16} className="text-emerald-500" /> Daily Delivery Volumes
      </h3>
      <div className="h-[320px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm font-semibold text-slate-500">
            No trend data available for this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-slate-800" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#1E293B', color: '#FFF' }} />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCompleted)" name="Successful" />
              <Area type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorFailed)" name="Failed" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export const MonthlyIncomeCard = ({ data }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60">
      <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-6 uppercase tracking-wider flex items-center gap-2">
        <DollarSign size={16} className="text-[#B8641A]" /> Monthly Income & Revenue
      </h3>
      <div className="h-[320px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm font-semibold text-slate-500">
            No revenue data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#B8641A" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#B8641A" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-slate-800" />
              <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
              <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Income']} contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#1E293B', color: '#FFF' }} />
              <Bar dataKey="income" fill="url(#colorIncome)" radius={[8, 8, 0, 0]} name="Income (₹)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export const SubscriptionTrendsCard = ({ data }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60">
      <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-6 uppercase tracking-wider flex items-center gap-2">
        <Activity size={16} className="text-blue-500" /> Subscription Trends
      </h3>
      <div className="h-[320px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm font-semibold text-slate-500">
            No subscription data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-slate-800" />
              <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#1E293B', color: '#FFF' }} />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Line type="monotone" dataKey="totalCustomers" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} name="Total Subscriptions" />
              <Line type="monotone" dataKey="activeCustomers" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Active Subscriptions" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export const ChurnAnalysisCard = ({ data }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60">
      <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-6 uppercase tracking-wider flex items-center gap-2">
        <UserMinus size={16} className="text-rose-500" /> Customer Churn & Onboarding
      </h3>
      <div className="h-[320px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm font-semibold text-slate-500">
            No churn data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-slate-800" />
              <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#EC4899', fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#1E293B', color: '#FFF' }} />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Bar yAxisId="left" dataKey="newCustomers" fill="#10B981" radius={[4, 4, 0, 0]} name="New Subscriptions" />
              <Bar yAxisId="left" dataKey="churnedCustomers" fill="#EF4444" radius={[4, 4, 0, 0]} name="Closed/Churned" />
              <Line yAxisId="right" type="monotone" dataKey="churnRate" stroke="#EC4899" strokeWidth={3} dot={{ r: 4 }} name="Churn Rate (%)" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export const DeliveryVolumeByAgentCard = ({ data }) => {
  return (
    <div className="xl:col-span-2 bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60">
      <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-6 uppercase tracking-wider flex items-center gap-2">
        <Users size={18} className="text-blue-500" /> Delivery Volume by Agent
      </h3>
      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-slate-800" />
            <XAxis dataKey="agent" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
            <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#1E293B', color: '#FFF' }} />
            <Bar dataKey="completed" fill="#3B82F6" radius={[6, 6, 0, 0]} name="Successful" />
            <Bar dataKey="failed" fill="#FDA4AF" radius={[6, 6, 0, 0]} name="Failed" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const TopAgentsCard = ({ data }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60">
      <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-5 uppercase tracking-wider flex items-center gap-2">
        <Award size={18} className="text-amber-500" /> Top Agents
      </h3>
      <div className="space-y-3">
        {data.length === 0 && (
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-sm text-slate-500">
            No performance data.
          </div>
        )}
        {data.map((agent, i) => (
          <TopPerformerRow key={i} agent={agent} index={i} />
        ))}
      </div>
    </div>
  );
};

export const EfficiencyClustersCard = ({ data }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60 flex flex-col h-[200px]">
      <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wider flex items-center gap-2 flex-shrink-0">
        <TrendingUp size={18} className="text-emerald-500" /> Efficiency Clusters
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={6} dataKey="value">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={20} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const OperationalFactorsCard = ({ data }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60 flex flex-col justify-between h-[280px]">
      <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wider">Operational Factors</h3>
      <div className="grid grid-cols-2 gap-3 mb-2">
        {[
          { label: 'Active Agents', val: String(data.activeAgents), icon: UserCheck, col: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
          { label: 'Pending', val: String(data.pending), icon: Clock3, col: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
          { label: 'Idle Agents', val: String(data.idleAgents), icon: Users, col: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40' },
          { label: 'Avg Load', val: data.avgLoadPerAgent.toFixed(1), icon: Zap, col: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
        ].map((factor, i) => (
          <FactorCard key={i} factor={factor} />
        ))}
      </div>
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Top Failure Reasons</p>
        <div className="space-y-1">
          {data.topFailureReasons.length === 0 && (
            <p className="text-xs font-semibold text-slate-500">No failed deliveries in this range.</p>
          )}
          {data.topFailureReasons.slice(0, 2).map(([reason, count]) => (
            <FailureReasonRow key={reason} reason={reason} count={count} />
          ))}
        </div>
      </div>
    </div>
  );
};

export const FailureReasonsAnalysisCard = ({ data }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60 flex flex-col h-[512px] flex-shrink-0">
      <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-5 uppercase tracking-wider flex items-center gap-2 flex-shrink-0">
        <AlertCircle size={18} className="text-rose-500" /> Failure Reasons Analysis
      </h3>
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-500">
          No failed deliveries recorded in this range.
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={6} dataKey="value">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export const RecentFailureLogsCard = ({ data }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60 overflow-hidden flex flex-col h-[512px] flex-shrink-0">
      <div className="px-7 py-5 border-b border-slate-50 dark:border-slate-800 flex-shrink-0">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Recent Failure Logs</h3>
      </div>
      <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0">
        <table className="w-full text-left table-fixed">
          <thead className="bg-slate-100 dark:bg-slate-950 text-slate-400 text-[9px] font-black uppercase tracking-widest sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-3 py-3 w-[50%]">Agent / Customer</th>
              <th className="px-3 py-3 text-center w-[28%]">Reason</th>
              <th className="px-3 py-3 text-right w-[22%]">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {data.length === 0 && (
              <tr>
                <td className="px-3 py-5 text-sm font-bold text-slate-500" colSpan={3}>
                  No failed deliveries for this period.
                </td>
              </tr>
            )}
            {data.map((item, i) => (
              <MissedDeliveryRow key={i} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
