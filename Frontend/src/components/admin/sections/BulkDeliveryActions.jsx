import React from 'react';
import { Calendar, UserPlus, PlayCircle } from 'lucide-react';

const BulkDeliveryActions = ({ selectedCount, onReschedule, onAssign }) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-8 animate-in slide-in-from-bottom-10 duration-300 z-50">
      <div className="flex items-center gap-2 pr-6 border-r border-gray-700">
        <span className="h-6 w-6 bg-blue-600 rounded-full flex items-center justify-center text-[10px] font-black">
          {selectedCount}
        </span>
        <span className="text-sm font-bold">Selected</span>
      </div>

      <div className="flex items-center gap-6">
        <button onClick={onReschedule} className="flex items-center gap-2 hover:text-blue-400 transition-colors">
          <Calendar size={18} />
          <span className="text-xs font-black uppercase tracking-wider">Reschedule</span>
        </button>

        <button onClick={onAssign} className="flex items-center gap-2 hover:text-blue-400 transition-colors">
          <UserPlus size={18} />
          <span className="text-xs font-black uppercase tracking-wider">Assign Agent</span>
        </button>

        <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95">
          <PlayCircle size={18} />
          <span className="text-xs font-black uppercase tracking-wider">Execute</span>
        </button>
      </div>
    </div>
  );
};

export default BulkDeliveryActions;