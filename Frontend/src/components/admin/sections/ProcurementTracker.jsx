import React, { useState } from 'react';
import { Plus, Landmark, Droplets, Scale, CheckCircle2 } from 'lucide-react';

const ProcurementTracker = ({ suppliers = [], onAddLog }) => {
  const [log, setLog] = useState({ supplier_id: '', quantity: '', rate: '', fat_content: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supplierList = Array.isArray(suppliers) ? suppliers : [];

  const handleSubmit = async () => {
    if (!log.supplier_id || !log.quantity || !log.rate) {
      alert("Please fill in Supplier, Quantity, and Rate.");
      return;
    }

    setIsSubmitting(true);
    // onAddLog is called from AdminDashboard
    await onAddLog?.(log);
    
    // Reset form after successful "submission"
    setLog({ supplier_id: '', quantity: '', rate: '', fat_content: '' });
    setIsSubmitting(false);
  };

  return (
    <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-black flex items-center gap-2">
          <Landmark size={24} className="text-blue-600" /> Milk Procurement
        </h3>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Inventory Input
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Supplier Selection */}
        <div className="md:col-span-1">
          <select 
            value={log.supplier_id}
            onChange={(e) => setLog({...log, supplier_id: e.target.value})}
            className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="">Supplier</option>
            {supplierList.map(s => (
              <option key={s?.id} value={s?.id}>{s?.name}</option>
            ))}
          </select>
        </div>

        {/* Quantity Input */}
        <div className="relative">
          <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="number" 
            placeholder="Qty (L)" 
            value={log.quantity}
            onChange={(e) => setLog({...log, quantity: e.target.value})}
            className="w-full pl-11 pr-4 py-4 bg-gray-50 rounded-2xl border-none font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Rate Input */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
          <input 
            type="number" 
            placeholder="Rate/L" 
            value={log.rate}
            onChange={(e) => setLog({...log, rate: e.target.value})}
            className="w-full pl-11 pr-4 py-4 bg-gray-50 rounded-2xl border-none font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Fat Content (Optional but good for quality tracking) */}
        <div className="relative">
          <Droplets className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="number" 
            placeholder="Fat %" 
            value={log.fat_content}
            onChange={(e) => setLog({...log, fat_content: e.target.value})}
            className="w-full pl-11 pr-4 py-4 bg-gray-50 rounded-2xl border-none font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Submit Button */}
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all ${
            isSubmitting ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100 active:scale-95'
          }`}
        >
          {isSubmitting ? 'Saving...' : <><Plus size={20} /> Add Log</>}
        </button>
      </div>

      {/* Quick History Preview */}
      <div className="mt-8 pt-6 border-t border-gray-50">
        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
          <CheckCircle2 size={14} className="text-green-500" />
          Last Entry
        </div>
        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
           <div className="flex items-center gap-3">
             <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center text-blue-500 shadow-sm">
               <Landmark size={14} />
             </div>
             <span className="font-bold text-gray-700 text-sm">Organic Farm Co.</span>
           </div>
           <div className="text-right">
             <span className="font-black text-gray-900">120L</span>
             <span className="text-gray-400 text-xs ml-2">@ ₹42/L</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ProcurementTracker;