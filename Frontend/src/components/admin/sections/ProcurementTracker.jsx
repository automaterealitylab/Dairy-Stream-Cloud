import React, { useState, useMemo } from "react";
import { Plus, Landmark, Droplets, Scale, CheckCircle2, ChevronDown } from "lucide-react";
import { adminHeadingFont, adminShellFont } from "../adminTheme";

const ProcurementTracker = ({ suppliers = [], logs = [], onAddLog }) => {
  const [log, setLog] = useState({
    supplier_id: "",
    quantity: "",
    rate: "",
    fat_content: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supplierList = useMemo(() => (Array.isArray(suppliers) ? suppliers : []), [suppliers]);
  const procurementLogs = useMemo(() => (Array.isArray(logs) ? logs : []), [logs]);

  const handleSubmit = async () => {
    if (!log.supplier_id || !log.quantity || !log.rate) {
      alert("Please fill in Supplier, Quantity, and Rate.");
      return;
    }

    const selectedSupplier = supplierList.find((s) => String(s.id) === String(log.supplier_id));

    setIsSubmitting(true);
    try {
      await onAddLog?.({
        supplier_id: log.supplier_id,
        supplier_name: selectedSupplier?.name || "",
        quantity: parseFloat(log.quantity),
        rate_per_liter: parseFloat(log.rate),
        fat_percentage: parseFloat(log.fat_content || 0),
        snf_percentage: 0,
      });

      setLog({ supplier_id: "", quantity: "", rate: "", fat_content: "" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="rounded-[32px] border border-[#EDE8DF] bg-white/95 p-8 shadow-[0_18px_45px_rgba(92,61,30,0.08)]"
      style={adminShellFont}
    >
      <div className="mb-6 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-2xl text-[#2C1A0E]" style={adminHeadingFont}>
          <Landmark size={24} className="text-[#B8641A]" /> Milk Procurement
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A882]">Inventory Input</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="relative md:col-span-1">
          <select
            value={log.supplier_id}
            onChange={(e) => setLog({ ...log, supplier_id: e.target.value })}
            className="w-full cursor-pointer appearance-none rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] p-4 pr-10 text-sm font-bold text-[#2C1A0E] outline-none transition-all focus:ring-2 focus:ring-[#C98A42]"
          >
            <option value="" disabled>
              Select Supplier
            </option>
            {supplierList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#B89970]" size={16} />
        </div>

        <div className="relative">
          <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89970]" size={16} />
          <input
            type="number"
            placeholder="Qty (L)"
            value={log.quantity}
            onChange={(e) => setLog({ ...log, quantity: e.target.value })}
            className="w-full rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] py-4 pl-11 pr-4 text-sm font-bold text-[#2C1A0E] outline-none focus:ring-2 focus:ring-[#C98A42]"
          />
        </div>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#B89970]">Rs</span>
          <input
            type="number"
            placeholder="Rate/L"
            value={log.rate}
            onChange={(e) => setLog({ ...log, rate: e.target.value })}
            className="w-full rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] py-4 pl-11 pr-4 text-sm font-bold text-[#2C1A0E] outline-none focus:ring-2 focus:ring-[#C98A42]"
          />
        </div>

        <div className="relative">
          <Droplets className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89970]" size={16} />
          <input
            type="number"
            placeholder="Fat %"
            value={log.fat_content}
            onChange={(e) => setLog({ ...log, fat_content: e.target.value })}
            className="w-full rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] py-4 pl-11 pr-4 text-sm font-bold text-[#2C1A0E] outline-none focus:ring-2 focus:ring-[#C98A42]"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-black transition-all ${
            isSubmitting ? "bg-[#F2EDE4] text-[#B89970]" : "bg-[#B8641A] text-white hover:bg-[#9E5415]"
          }`}
        >
          {isSubmitting ? "Saving..." : <><Plus size={20} /> Add Log</>}
        </button>
      </div>

      <div className="mt-8 border-t border-[#F2EDE4] pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#B89970]">
            <CheckCircle2 size={14} className="text-[#6F8C45]" />
            Last Entry
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A882]">Today's Procurement</span>
        </div>

        {procurementLogs.length > 0 ? (
          <>
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#F2EDE4] bg-[#FFFDF8] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#B8641A] shadow-sm">
                  <Landmark size={14} />
                </div>
                <span className="text-sm font-bold text-[#2C1A0E]">{procurementLogs[0].supplier_name || "Unknown Supplier"}</span>
              </div>
              <div className="text-right">
                <span className="font-black text-[#2C1A0E]">{procurementLogs[0].quantity}L</span>
                <span className="ml-2 text-xs text-[#8B7355]">@ Rs {procurementLogs[0].rate_per_liter}/L</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="uppercase tracking-widest text-[#C4A882]">
                    <th className="pb-2 pr-4 font-bold">Supplier</th>
                    <th className="pb-2 pr-4 font-bold">Qty (L)</th>
                    <th className="pb-2 pr-4 font-bold">Rate/L</th>
                    <th className="pb-2 pr-4 font-bold">Fat %</th>
                    <th className="pb-2 pr-4 font-bold">Total</th>
                    <th className="pb-2 font-bold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {procurementLogs.slice(0, 5).map((entry) => (
                    <tr key={entry.id} className="border-t border-[#F2EDE4] text-[#6F4A27]">
                      <td className="py-2 pr-4 font-semibold">{entry.supplier_name}</td>
                      <td className="py-2 pr-4">{entry.quantity}</td>
                      <td className="py-2 pr-4">Rs {entry.rate_per_liter}</td>
                      <td className="py-2 pr-4">{entry.fat_percentage}</td>
                      <td className="py-2 pr-4">
                        Rs {entry.total_cost ?? Number(entry.quantity || 0) * Number(entry.rate_per_liter || 0)}
                      </td>
                      <td className="py-2 text-[#8B7355]">
                        {entry.created_at
                          ? new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#E5D9C7] bg-[#FFFDF8] p-4 text-xs text-[#B89970]">
            No procurement logs for today yet. Add your first entry above.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcurementTracker;
