import React, { useState } from 'react';
import { IndianRupee, Check, Wallet } from 'lucide-react';

const ManualPaymentModal = ({ delivery, onSave, onClose }) => {
  const [received, setReceived] = useState(delivery.amount_due || 0);
  const [method, setMethod] = useState('CASH');

  // Logic: Negative means they paid EXTRA (Credit)
  const balance = delivery.amount_due - received;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95">
        <h2 className="text-2xl font-black mb-6">Record Payment</h2>
        
        <div className="space-y-5">
          <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <span className="text-xs font-bold text-slate-400 uppercase">Total Bill</span>
            <p className="text-2xl font-black text-slate-700">₹{delivery.amount_due}</p>
          </div>

          <div>
            <label className="text-xs font-black uppercase text-gray-400 ml-1">Amount Received</label>
            <div className="relative mt-2">
              <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="number" value={received} onChange={(e) => setReceived(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl font-black outline-none focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Balance / Credit Notification */}
          {balance > 0 ? (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-700 text-xs font-bold text-center">
              ⚠️ Remaining balance: ₹{balance} will be due.
            </div>
          ) : balance < 0 ? (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700 text-xs font-bold text-center flex items-center justify-center gap-2">
              <Wallet size={14} /> Extra Payment: ₹{Math.abs(balance)} will be added as Credit.
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-4 font-bold text-gray-400">Cancel</button>
            <button 
              onClick={() => onSave({ received, method, balance })} 
              className="flex-[2] bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2"
            >
              <Check size={18} /> Save Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ManualPaymentModal