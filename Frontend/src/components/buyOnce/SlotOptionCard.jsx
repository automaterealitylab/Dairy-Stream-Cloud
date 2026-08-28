import React from "react";
import { Clock3 } from "lucide-react";

export const SlotOptionCard = ({ slot, form, setForm }) => (
  <button
    type="button"
    disabled={!slot.available}
    onClick={() => slot.available && setForm((prev) => ({ ...prev, slot: slot.id }))}
    className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
      form.slot === slot.id && slot.available
        ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
        : slot.available
        ? "border-slate-200 hover:border-blue-200 bg-white"
        : "border-slate-100 bg-slate-50 opacity-60 grayscale cursor-not-allowed"
    }`}
  >
    <Clock3 size={20} className={form.slot === slot.id ? "text-blue-600" : "text-slate-400"} />
    <div>
      <p className="font-bold text-sm text-slate-800">{slot.id}</p>
      <p className="text-[10px] text-slate-500 font-medium">{slot.label}</p>
      <p className={`text-[10px] mt-1 font-bold ${slot.available ? "text-green-600" : "text-red-500"}`}>{slot.reason}</p>
    </div>
  </button>
);
