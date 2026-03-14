import React from 'react';
import { AlertTriangle, UserX } from 'lucide-react';

const DeliveryExceptionDashboard = ({ 
  exceptions = [], 
  selectedIds = [], 
  onToggleSelect, 
  onReschedule 
}) => {
  const items = Array.isArray(exceptions) ? exceptions : [];

  return (
    <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 text-red-500 rounded-lg">
            <AlertTriangle size={20}/>
          </div>
          <h3 className="text-xl font-black text-gray-900">Delivery Exceptions</h3>
        </div>
        
        {items.length > 0 && (
          <span className="text-[10px] font-black uppercase text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
            {items.length} Issues Found
          </span>
        )}
      </div>

      <div className="space-y-3">
        {items.length > 0 ? (
          items.map((exc) => {
            const isSelected = selectedIds.includes(exc.id);
            
            return (
              <div 
                key={exc.id} 
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  isSelected 
                    ? 'bg-blue-50 border-blue-200 shadow-sm' 
                    : 'bg-gray-50 border-gray-100'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* ✅ CHECKBOX FOR SELECTION */}
                  <input 
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(exc.id)}
                    className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  
                  <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-red-400 shadow-sm">
                    <UserX size={20}/>
                  </div>
                  
                  <div>
                    <p className="font-bold text-gray-800">
                      {exc?.customer_name || `Customer #${exc?.customer_id}`}
                    </p>
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-tighter">
                      {exc?.notes?.split('FAILED_REASON]: ')[1] || 'Unknown Reason'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right mr-4 hidden sm:block">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Quantity</p>
                    <p className="font-black text-gray-700">{exc?.quantity_liters}L</p>
                  </div>
                  
                  <button 
                    onClick={() => onReschedule?.(exc?.id)}
                    className="text-xs font-black text-blue-600 uppercase bg-white border border-blue-100 px-4 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                  >
                    Reschedule
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-10 bg-gray-50 rounded-[24px] border border-dashed border-gray-200">
            <p className="text-gray-400 font-bold text-sm italic">All deliveries running smoothly today!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryExceptionDashboard;