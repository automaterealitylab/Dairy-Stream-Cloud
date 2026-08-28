import React from "react";
import { Minus, Plus } from "lucide-react";

export const SelectedItemRow = ({ item, updateSelectedItemQuantity }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-semibold text-slate-900">{item.name}</p>
        <p className="text-xs text-slate-500">Rs {item.ratePerUnit}/{item.unit}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => updateSelectedItemQuantity(item.name, item.quantity - 0.5)}
          className="rounded-full border border-slate-200 p-2 text-slate-500"
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          min="0.5"
          step="0.5"
          value={item.quantity}
          onChange={(e) => updateSelectedItemQuantity(item.name, e.target.value)}
          className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-center font-bold outline-none focus:border-blue-500"
        />
        <button
          type="button"
          onClick={() => updateSelectedItemQuantity(item.name, item.quantity + 0.5)}
          className="rounded-full border border-slate-200 p-2 text-slate-500"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  </div>
);
