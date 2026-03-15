import React, { useState, useMemo } from "react";
import { Plus, Landmark, Droplets, Scale, CheckCircle2, ChevronDown } from "lucide-react";

const ProcurementTracker = ({ suppliers = [], logs = [], onAddLog }) => {
  const [log, setLog] = useState({
    supplier_id: "",
    quantity: "",
    rate: "",
    fat_content: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ Use useMemo to ensure the list is always valid and sorted
  const supplierList = useMemo(() => {
    return Array.isArray(suppliers) ? suppliers : [];
  }, [suppliers]);

  const procurementLogs = useMemo(() => {
    return Array.isArray(logs) ? logs : [];
  }, [logs]);

  const handleSubmit = async () => {
    if (!log.supplier_id || !log.quantity || !log.rate) {
      alert("Please fill in Supplier, Quantity, and Rate.");
      return;
    }

    // Find the selected supplier so we can send its name to the backend
    const selectedSupplier = supplierList.find(
      (s) => String(s.id) === String(log.supplier_id)
    );

    setIsSubmitting(true);
    try {
      // Shape the payload to match the backend controller expectations:
      // supplier_name, quantity, rate_per_liter, fat_percentage, snf_percentage
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
        <div className="md:col-span-1 relative">
          <select
            value={log.supplier_id}
            onChange={(e) => setLog({ ...log, supplier_id: e.target.value })}
            className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer pr-10"
          >
            <option value="" disabled>
              Select Supp
            </option>
            {supplierList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {/* Add this icon to replace the hidden browser arrow */}
          <ChevronDown
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            size={16}
          />
        </div>

        {/* Quantity Input */}
        <div className="relative">
          <Scale
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={16}
          />
          <input
            type="number"
            placeholder="Qty (L)"
            value={log.quantity}
            onChange={(e) => setLog({ ...log, quantity: e.target.value })}
            className="w-full pl-11 pr-4 py-4 bg-gray-50 rounded-2xl border-none font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Rate Input */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
            ₹
          </span>
          <input
            type="number"
            placeholder="Rate/L"
            value={log.rate}
            onChange={(e) => setLog({ ...log, rate: e.target.value })}
            className="w-full pl-11 pr-4 py-4 bg-gray-50 rounded-2xl border-none font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Fat Content */}
        <div className="relative">
          <Droplets
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={16}
          />
          <input
            type="number"
            placeholder="Fat %"
            value={log.fat_content}
            onChange={(e) => setLog({ ...log, fat_content: e.target.value })}
            className="w-full pl-11 pr-4 py-4 bg-gray-50 rounded-2xl border-none font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all ${
            isSubmitting
              ? "bg-gray-200 text-gray-400"
              : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100 active:scale-95"
          }`}
        >
          {isSubmitting ? (
            "Saving..."
          ) : (
            <>
              <Plus size={20} /> Add Log
            </>
          )}
        </button>
      </div>

      {/* Quick History Preview + Table (for this dairy only, from DB) */}
      <div className="mt-8 pt-6 border-t border-gray-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <CheckCircle2 size={14} className="text-green-500" />
            Last Entry
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Today&apos;s Procurement
          </span>
        </div>

        {procurementLogs.length > 0 ? (
          <>
            {/* Last entry card */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center text-blue-500 shadow-sm">
                  <Landmark size={14} />
                </div>
                <span className="font-bold text-gray-700 text-sm">
                  {procurementLogs[0].supplier_name || "Unknown Supplier"}
                </span>
              </div>
              <div className="text-right">
                <span className="font-black text-gray-900">
                  {procurementLogs[0].quantity}L
                </span>
                <span className="text-gray-400 text-xs ml-2">
                  @ ₹{procurementLogs[0].rate_per_liter}/L
                </span>
              </div>
            </div>

            {/* Compact table of recent logs */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-400 uppercase tracking-widest">
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
                    <tr key={entry.id} className="border-t border-slate-100 text-gray-700">
                      <td className="py-2 pr-4 font-semibold">{entry.supplier_name}</td>
                      <td className="py-2 pr-4">{entry.quantity}</td>
                      <td className="py-2 pr-4">₹{entry.rate_per_liter}</td>
                      <td className="py-2 pr-4">{entry.fat_percentage}</td>
                      <td className="py-2 pr-4">
                        ₹{entry.total_cost ?? (Number(entry.quantity || 0) * Number(entry.rate_per_liter || 0))}
                      </td>
                      <td className="py-2 text-gray-500">
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
          <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200 text-xs text-gray-400">
            No procurement logs for today yet. Add your first entry above.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcurementTracker;
