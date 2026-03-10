import React, { useState } from 'react';
import { Plus, Landmark, Droplets } from 'lucide-react';

const ProcurementTracker = ({ suppliers = [], onAddLog }) => { // ✅ Default to empty array
  const [log, setLog] = useState({ supplier_id: '', quantity: '', rate: '', fat_content: '' });

  // ✅ Extra safety: ensure we are working with an array
  const supplierList = Array.isArray(suppliers) ? suppliers : [];

  return (
    <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm">
      <h3 className="text-xl font-black mb-6 flex items-center gap-2">
        <Landmark size={24} className="text-blue-600" /> Milk Procurement
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <select 
          onChange={(e) => setLog({...log, supplier_id: e.target.value})}
          className="p-4 bg-gray-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select Supplier</option>
          {/* ✅ Safe Mapping */}
          {supplierList.map(s => (
            <option key={s?.id} value={s?.id}>{s?.name}</option>
          ))}
        </select>
        
        {/* ... rest of the inputs ... */}
        <button 
          onClick={() => onAddLog?.(log)}
          className="bg-blue-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
        >
          <Plus size={20} /> Add Log
        </button>
      </div>
    </div>
  );
};

export default ProcurementTracker;