export const StatCard = ({ item }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`h-10 w-10 ${item.bg} ${item.col} rounded-xl flex items-center justify-center`}>
          <item.icon size={20} />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
      </div>
      <h3 className="text-2xl font-black text-slate-900 dark:text-white">{item.val}</h3>
    </div>
  );
};

export const TopPerformerRow = ({ agent, index }) => {
  return (
    <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800/40">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-xs">
          #{index + 1}
        </div>
        <div>
          <p className="font-black text-slate-800 dark:text-white text-sm leading-tight">{agent.name}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase">{agent.count} Completed</p>
        </div>
      </div>
      <p className="text-lg font-black text-blue-600 dark:text-blue-400">{agent.score}%</p>
    </div>
  );
};

export const FactorCard = ({ factor }) => {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5">
      <div className={`h-8 w-8 ${factor.bg} ${factor.col} rounded-lg flex items-center justify-center mb-1.5`}>
        <factor.icon size={16} />
      </div>
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{factor.label}</p>
      <p className="text-base font-black text-slate-800 dark:text-white leading-none mt-1">{factor.val}</p>
    </div>
  );
};

export const FailureReasonRow = ({ reason, count }) => {
  return (
    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
      <span className="truncate max-w-[120px]">{String(reason).replaceAll('_', ' ')}</span>
      <span>{count}</span>
    </div>
  );
};

export const MissedDeliveryRow = ({ item }) => {
  return (
    <tr className="hover:bg-blue-50/20 dark:hover:bg-slate-800/20 transition-all">
      <td className="px-3 py-3.5 align-middle">
        <div className="font-black text-slate-800 dark:text-slate-200 text-[11px] leading-snug truncate" title={item.agent}>{item.agent}</div>
        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate" title={item.customer}>To: {item.customer}</div>
      </td>
      <td className="px-2 py-3.5 text-center align-middle">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 uppercase tracking-widest">
          {item.reason.replace('_', ' ')}
        </span>
      </td>
      <td className="px-3 py-3.5 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 align-middle whitespace-nowrap">{item.date}</td>
    </tr>
  );
};
