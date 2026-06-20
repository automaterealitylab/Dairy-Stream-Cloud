import React, { useState } from 'react';
import { IndianRupee, Check, Wallet, X } from 'lucide-react';
import { adminHeadingFont, adminShellFont } from "../adminTheme";

const LegacyManualPaymentModal = ({ delivery, onSave, onClose }) => {
  const totalBill = Number(delivery?.amount_due ?? delivery?.amount ?? 0);
  const [received, setReceived] = useState(totalBill || 0);
  const [method, setMethod] = useState('CASH');
  const [note, setNote] = useState('');

  // Logic: Negative means they paid EXTRA (Credit)
  const numericReceived = Number(received || 0);
  const balance = Number((totalBill - numericReceived).toFixed(2));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95">
        <h2 className="text-2xl font-black mb-6">Record Payment</h2>
        
        <div className="space-y-5">
          <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <span className="text-xs font-bold text-slate-400 uppercase">Total Bill</span>
            <p className="text-2xl font-black text-slate-700">₹{totalBill}</p>
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

          <div>
            <label className="text-xs font-black uppercase text-gray-400 ml-1">Payment Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full mt-2 px-4 py-4 bg-gray-50 rounded-2xl font-black outline-none focus:ring-4 focus:ring-blue-100"
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-black uppercase text-gray-400 ml-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Receipt no / remark"
              className="w-full mt-2 px-4 py-4 bg-gray-50 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-100"
            />
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
              onClick={() => onSave({
                received: numericReceived,
                method,
                balance,
                note,
              })}
              disabled={!Number.isFinite(numericReceived) || numericReceived <= 0}
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

const ManualPaymentModal = ({ delivery, onSave, onClose }) => {
  const totalBill = Number(delivery?.amount_due ?? delivery?.amount ?? 0);
  const [received, setReceived] = useState(totalBill || 0);
  const [method, setMethod] = useState("CASH");
  const [note, setNote] = useState("");

  const numericReceived = Math.max(0, Number(received || 0));
  const balance = Number((totalBill - numericReceived).toFixed(2));
  const customerName = delivery?.customer || delivery?.customerName || "Customer";

  const handleReceivedChange = (e) => {
    const nextRaw = e.target.value;
    if (nextRaw === "") {
      setReceived("");
      return;
    }

    const nextValue = Math.max(0, Number(nextRaw));
    setReceived(Number.isFinite(nextValue) ? nextValue : 0);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(44,26,14,0.45)] p-0 sm:p-4 backdrop-blur-sm"
      style={adminShellFont}
    >
      <div className="flex min-h-full items-end justify-center sm:items-center">
      <div className="flex w-full max-w-xl max-h-[90vh] sm:max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-t-[24px] sm:rounded-[32px] border border-[#E7DAC6] bg-[#FFFDF8] shadow-[0_28px_70px_rgba(44,26,14,0.28)]">
        <div className="shrink-0 bg-gradient-to-r from-[#3E2B18] via-[#5B3E24] to-[#8A6A46] px-5 py-4 text-white sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F3D4A6]">
                Offline Collection
              </p>
              <h2 className="mt-2 text-2xl text-white" style={adminHeadingFont}>
                Record Payment
              </h2>
              <p className="mt-1 text-sm text-white/70">
                Collect and settle dues for {customerName}.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Close payment modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto">
        <div className="space-y-4 px-4 py-4 sm:space-y-5 sm:px-6 sm:py-6">
          <div className="rounded-[24px] border border-[#EDE8DF] bg-white p-4 shadow-[0_12px_30px_rgba(92,61,30,0.06)] sm:p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
              Total Bill
            </p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className="text-3xl font-black text-[#2C1A0E]">₹{totalBill.toFixed(2)}</p>
              <span className="rounded-full bg-[#FDF6EC] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#B8641A]">
                Due Now
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#A88763]">
                Amount Received
              </label>
              <div className="relative">
                <IndianRupee
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89970]"
                  size={18}
                />
                <input
                  type="number"
                  value={received}
                  onChange={handleReceivedChange}
                  min="0"
                  className="w-full rounded-[18px] border border-[#EDE8DF] bg-[#FAF7F1] py-4 pl-12 pr-4 font-bold text-[#2C1A0E] outline-none transition focus:border-[#B8641A] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#A88763]">
                Payment Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-[18px] border border-[#EDE8DF] bg-[#FAF7F1] px-4 py-4 font-bold text-[#2C1A0E] outline-none transition focus:border-[#B8641A] focus:bg-white"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#A88763]">
              Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Receipt no / remark"
              className="w-full rounded-[18px] border border-[#EDE8DF] bg-[#FAF7F1] px-4 py-4 font-semibold text-[#2C1A0E] outline-none transition placeholder:text-[#B89970] focus:border-[#B8641A] focus:bg-white"
            />
          </div>

          {balance > 0 ? (
            <div className="rounded-[18px] border border-[#F3D6A2] bg-[#FFF6E7] px-4 py-3 text-sm font-semibold text-[#B8641A]">
              Remaining balance: ₹{balance.toFixed(2)} will stay due.
            </div>
          ) : balance < 0 ? (
            <div className="flex items-center gap-2 rounded-[18px] border border-[#DDE8D1] bg-[#EEF5E7] px-4 py-3 text-sm font-semibold text-[#4A7C2F]">
              <Wallet size={16} />
              Extra payment: ₹{Math.abs(balance).toFixed(2)} will be added to wallet credit.
            </div>
          ) : (
            <div className="rounded-[18px] border border-[#E7DAC6] bg-[#F8F3EC] px-4 py-3 text-sm font-semibold text-[#6B5B3E]">
              Full bill amount will be settled with this payment.
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[16px] border border-[#E7DAC6] bg-white px-5 py-3 text-sm font-bold text-[#8B7355] transition hover:bg-[#FDF6EC] hover:text-[#5C3D1E]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                onSave({
                  received: Math.max(0, numericReceived),
                  method,
                  balance,
                  note,
                })
              }
              disabled={!Number.isFinite(numericReceived) || numericReceived <= 0}
              className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-[#B8641A] px-5 py-3 text-sm font-black text-white shadow-[0_16px_30px_rgba(184,100,26,0.22)] transition hover:bg-[#9F5414] disabled:cursor-not-allowed disabled:bg-[#D8C8B2]"
            >
              <Check size={16} />
              Save Payment
            </button>
          </div>
        </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ManualPaymentModal
