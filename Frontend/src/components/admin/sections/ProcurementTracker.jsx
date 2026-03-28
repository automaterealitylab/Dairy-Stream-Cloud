import React, { useState, useMemo } from "react";
import toast from "react-hot-toast";
import { Plus, Landmark, Droplets, Scale, CheckCircle2, ChevronDown, Package, X, PencilLine } from "lucide-react";
import { adminHeadingFont, adminShellFont } from "../adminTheme";

const getLocalDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (value) => {
  const key = getLocalDateKey(value);
  if (!key) return "Unknown Date";

  const todayKey = getLocalDateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterday);

  if (key === todayKey) return "Today";
  if (key === yesterdayKey) return "Yesterday";

  return new Date(value).toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateInputLabel = (value) => {
  if (!value) return "No date selected";
  return new Date(value).toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTimeLabel = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const ProcurementTracker = ({
  suppliers = [],
  logs = [],
  selectedDate = "",
  maxDate = "",
  onChangeSelectedDate,
  onAddLog,
  onOpenSupplierForm,
}) => {
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [activeHistoryGroupKey, setActiveHistoryGroupKey] = useState("");
  const [editingLogId, setEditingLogId] = useState(null);
  const [log, setLog] = useState({
    supplier_id: "",
    item_name: "",
    item_category: "MILK",
    unit: "LITER",
    quantity: "",
    rate: "",
    fat_content: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supplierList = useMemo(() => (Array.isArray(suppliers) ? suppliers : []), [suppliers]);
  const procurementLogs = useMemo(() => (Array.isArray(logs) ? logs : []), [logs]);
  const selectedDayLogs = useMemo(
    () => procurementLogs.filter((entry) => getLocalDateKey(entry.created_at) === selectedDate),
    [procurementLogs, selectedDate]
  );
  const groupedLogs = useMemo(() => {
    const grouped = new Map();

    procurementLogs.forEach((entry) => {
      const key = getLocalDateKey(entry.created_at) || "unknown";
      const current = grouped.get(key) || {
        key,
        label: formatDateLabel(entry.created_at),
        logs: [],
      };

      current.logs.push(entry);
      grouped.set(key, current);
    });

    return [...grouped.values()].sort((a, b) => {
      if (a.key === "unknown") return 1;
      if (b.key === "unknown") return -1;
      return b.key.localeCompare(a.key);
    });
  }, [procurementLogs]);
  const activeHistoryGroup = useMemo(
    () => groupedLogs.find((group) => group.key === activeHistoryGroupKey) || null,
    [groupedLogs, activeHistoryGroupKey]
  );

  const resetEntryForm = () => {
    setEditingLogId(null);
    setLog({
      supplier_id: "",
      item_name: "",
      item_category: "MILK",
      unit: "LITER",
      quantity: "",
      rate: "",
      fat_content: "",
    });
  };

  const handleSubmit = async () => {
    if (!log.supplier_id || !log.item_name || !log.quantity || !log.rate) {
      toast.error("Please fill in Supplier, Item, Quantity, and Rate.");
      return;
    }

    const selectedSupplier = supplierList.find((s) => String(s.id) === String(log.supplier_id));

    setIsSubmitting(true);
    try {
      await onAddLog?.({
        supplier_id: log.supplier_id,
        supplier_name: selectedSupplier?.name || "",
        item_name: log.item_name,
        item_category: log.item_category,
        unit: log.unit,
        quantity: parseFloat(log.quantity),
        rate_per_unit: parseFloat(log.rate),
        fat_percentage: log.item_category === "MILK" ? parseFloat(log.fat_content || 0) : 0,
        snf_percentage: 0,
      }, editingLogId);

      resetEntryForm();
      setShowEntryForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditEntry = (entry) => {
    setEditingLogId(entry.id);
    setLog({
      supplier_id: entry.supplier_id != null ? String(entry.supplier_id) : "",
      item_name: entry.item_name || "",
      item_category: entry.item_category || "MILK",
      unit: entry.unit || "LITER",
      quantity: entry.quantity != null ? String(entry.quantity) : "",
      rate: String(entry.rate_per_unit || entry.rate_per_liter || ""),
      fat_content:
        String(entry.item_category || "MILK").toUpperCase() === "MILK" && entry.fat_percentage != null
          ? String(entry.fat_percentage)
          : "",
    });
    setShowEntryForm(true);
  };

  const handleCloseEntryForm = () => {
    setShowEntryForm(false);
    resetEntryForm();
  };

  const renderEntryCard = (entry, onEdit) => (
    <div
      key={entry.id}
      className="rounded-[20px] border border-[#EEDFCB] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(92,61,30,0.04)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-black text-[#2C1A0E]">{entry.item_name || "-"}</p>
            <span className="rounded-full bg-[#FFF3E2] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#B8641A]">
              {entry.item_category || "-"}
            </span>
            <span className="rounded-full border border-[#E9D8C3] bg-[#FFFDF8] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8B7355]">
              {formatTimeLabel(entry.created_at)}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-[#8B7355]">{entry.supplier_name || "-"}</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5D9C7] bg-white text-[#8B7355] transition hover:bg-[#FFF3E2] hover:text-[#B8641A]"
          aria-label="Edit entry"
          title="Edit entry"
        >
          <PencilLine size={15} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-2xl bg-[#FFF9F2] px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#B89970]">Quantity</p>
          <p className="mt-1 text-sm font-black text-[#2C1A0E]">{entry.quantity ?? "-"} {entry.unit || ""}</p>
        </div>
        <div className="rounded-2xl bg-[#FFF9F2] px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#B89970]">Rate</p>
          <p className="mt-1 text-sm font-black text-[#2C1A0E]">Rs {entry.rate_per_unit || entry.rate_per_liter || "-"}</p>
        </div>
        <div className="rounded-2xl bg-[#FFF9F2] px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#B89970]">Total</p>
          <p className="mt-1 text-sm font-black text-[#2C1A0E]">
            Rs {entry.total_cost ?? Number(entry.quantity || 0) * Number(entry.rate_per_unit || entry.rate_per_liter || 0)}
          </p>
        </div>
        <div className="rounded-2xl bg-[#FFF9F2] px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#B89970]">Unit</p>
          <p className="mt-1 truncate text-sm font-black text-[#2C1A0E]">{entry.unit || "-"}</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div
        className="rounded-[32px] border border-[#EDE8DF] bg-white/95 p-8 shadow-[0_18px_45px_rgba(92,61,30,0.08)]"
        style={adminShellFont}
      >
        <div className="rounded-[28px] border border-[#F0E2D0] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFFFFF_58%,#FFFCF7_100%)] p-5 shadow-[0_12px_30px_rgba(92,61,30,0.05)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-6">
              <div>
                <h3 className="flex items-center gap-3 text-3xl text-[#2C1A0E]" style={adminHeadingFont}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1DC] text-[#B8641A] shadow-sm">
                    <Landmark size={24} />
                  </span>
                  Purchase Entries
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#8B7355]">
                  Check purchase history by date, manage entries, and keep supplier activity organized from one place.
                </p>
              </div>

              <label className="inline-flex min-w-[220px] flex-col rounded-[24px] border border-[#E8D8C3] bg-white px-5 py-4 shadow-[0_10px_24px_rgba(184,100,26,0.06)]">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970]">Select Date</span>
                <input
                  type="date"
                  value={selectedDate}
                  max={maxDate}
                  onChange={(e) => onChangeSelectedDate?.(e.target.value)}
                  className="mt-3 block bg-transparent text-base font-black text-[#2C1A0E] outline-none"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C4A882]">Manage Entries</span>
              <button
                type="button"
                onClick={() => {
                  resetEntryForm();
                  setShowEntryForm(true);
                }}
                className="rounded-full bg-[#B8641A] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(184,100,26,0.2)] transition hover:-translate-y-0.5 hover:bg-[#9E5415]"
              >
                Add Entry
              </button>
              <button
                type="button"
                onClick={onOpenSupplierForm}
                className="rounded-full border border-[#E5D9C7] bg-white px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#B8641A] transition hover:bg-[#FFF3E2]"
              >
                Manage Suppliers
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-[#F2EDE4] pt-6">
        {procurementLogs.length > 0 ? (
          <>
            <div className="space-y-5">
              {groupedLogs.map((group) => (
                <div
                  key={group.key}
                  className={`rounded-[24px] border p-4 ${
                    group.key === selectedDate
                      ? "border-[#E5C79D] bg-[linear-gradient(180deg,#FFF8EF_0%,#FFFFFF_100%)] shadow-[0_14px_28px_rgba(184,100,26,0.08)]"
                      : "border-[#EDE8DF] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFFFFF_100%)]"
                  }`}
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF1DC] text-[#B8641A] shadow-sm">
                        <Landmark size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B89970]">
                          Purchase History
                        </p>
                        <p className="mt-1 text-base font-black text-[#2C1A0E]">{group.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-[#E9D8C3] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8B7355]">
                        {group.logs.length} entr{group.logs.length === 1 ? "y" : "ies"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {group.logs.slice(0, 5).map((entry) =>
                      renderEntryCard(entry, () => handleEditEntry(entry))
                    )}
                  </div>

                  {group.logs.length > 5 ? (
                    <div className="mt-4 flex items-center justify-between rounded-[18px] border border-[#F2E4D1] bg-[#FFF9F2] px-4 py-3">
                      <p className="text-sm text-[#8B7355]">
                        Showing 5 of <span className="font-black text-[#2C1A0E]">{group.logs.length}</span> entries.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveHistoryGroupKey(group.key)}
                        className="rounded-full bg-[#B8641A] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#9E5415]"
                      >
                        View All Entries
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#E5D9C7] bg-[#FFFDF8] p-4 text-xs text-[#B89970]">
            No purchase entries yet. Add your first entry above.
          </div>
        )}
        </div>
      </div>

      {showEntryForm ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-5xl rounded-[32px] border border-[#EDE8DF] bg-white p-6 shadow-[0_24px_60px_rgba(44,26,14,0.18)] sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-2xl text-[#2C1A0E]" style={adminHeadingFont}>
                  {editingLogId ? "Update Purchase Entry" : "Add Purchase Entry"}
                </h3>
                <p className="mt-1 text-sm text-[#8B7355]">
                  {editingLogId
                    ? "Correct the purchase details and save the changes."
                    : "Capture supplier, item, quantity, unit, and rate in one popup."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseEntryForm}
                className="rounded-full border border-[#E5D9C7] p-2 text-[#8B7355] transition hover:bg-[#FFF3E2] hover:text-[#B8641A]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <div className="relative md:col-span-2">
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

              <div className="relative md:col-span-2">
                <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89970]" size={16} />
                <input
                  type="text"
                  placeholder="Item name"
                  value={log.item_name}
                  onChange={(e) => setLog({ ...log, item_name: e.target.value })}
                  className="w-full rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] py-4 pl-11 pr-4 text-sm font-bold text-[#2C1A0E] outline-none focus:ring-2 focus:ring-[#C98A42]"
                />
              </div>

              <div className="relative md:col-span-2">
                <select
                  value={log.item_category}
                  onChange={(e) =>
                    setLog((prev) => ({
                      ...prev,
                      item_category: e.target.value,
                      unit: e.target.value === "MILK" ? "LITER" : prev.unit,
                    }))
                  }
                  className="w-full cursor-pointer appearance-none rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] p-4 pr-10 text-sm font-bold text-[#2C1A0E] outline-none transition-all focus:ring-2 focus:ring-[#C98A42]"
                >
                  <option value="MILK">Milk</option>
                  <option value="CURD">Curd / Dahi</option>
                  <option value="PANEER">Paneer</option>
                  <option value="GHEE">Ghee</option>
                  <option value="FEED">Cattle Feed</option>
                  <option value="PACKAGING">Packaging</option>
                  <option value="OTHER">Other</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#B89970]" size={16} />
              </div>

              <div className="relative md:col-span-2">
                <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89970]" size={16} />
                <input
                  type="number"
                  placeholder="Quantity"
                  value={log.quantity}
                  onChange={(e) => setLog({ ...log, quantity: e.target.value })}
                  className="w-full rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] py-4 pl-11 pr-4 text-sm font-bold text-[#2C1A0E] outline-none focus:ring-2 focus:ring-[#C98A42]"
                />
              </div>

              <div className="relative md:col-span-2">
                <select
                  value={log.unit}
                  onChange={(e) => setLog({ ...log, unit: e.target.value })}
                  className="w-full cursor-pointer appearance-none rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] p-4 pr-10 text-sm font-bold text-[#2C1A0E] outline-none transition-all focus:ring-2 focus:ring-[#C98A42]"
                >
                  <option value="LITER">Liter</option>
                  <option value="KG">Kg</option>
                  <option value="PACK">Pack</option>
                  <option value="PIECE">Piece</option>
                  <option value="BAG">Bag</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#B89970]" size={16} />
              </div>

              <div className="relative md:col-span-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#B89970]">Rs</span>
                <input
                  type="number"
                  placeholder="Rate / unit"
                  value={log.rate}
                  onChange={(e) => setLog({ ...log, rate: e.target.value })}
                  className="w-full rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] py-4 pl-11 pr-4 text-sm font-bold text-[#2C1A0E] outline-none focus:ring-2 focus:ring-[#C98A42]"
                />
              </div>

              <div className="relative md:col-span-3">
                <Droplets className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89970]" size={16} />
                <input
                  type="number"
                  placeholder={log.item_category === "MILK" ? "Fat %" : "Optional quality"}
                  value={log.fat_content}
                  onChange={(e) => setLog({ ...log, fat_content: e.target.value })}
                  className="w-full rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] py-4 pl-11 pr-4 text-sm font-bold text-[#2C1A0E] outline-none focus:ring-2 focus:ring-[#C98A42]"
                />
              </div>

              <div className="md:col-span-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseEntryForm}
                  className="rounded-2xl border border-[#E5D9C7] px-5 py-3 text-sm font-black text-[#8B7355] transition hover:bg-[#F8F3EC]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-black transition-all ${
                    isSubmitting ? "bg-[#F2EDE4] text-[#B89970]" : "bg-[#B8641A] text-white hover:bg-[#9E5415]"
                  }`}
                >
                  {isSubmitting ? "Saving..." : editingLogId ? "Update Entry" : <><Plus size={18} /> Add Log</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeHistoryGroup ? (
        <div className="fixed inset-0 z-[82] flex items-center justify-center bg-black/45 px-4">
          <div className="flex max-h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-[#EDE8DF] bg-white shadow-[0_24px_60px_rgba(44,26,14,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#F2EDE4] px-6 py-4 sm:px-8">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970]">
                  Purchase History
                </span>
                <h3 className="mt-1 text-3xl text-[#2C1A0E]" style={adminHeadingFont}>
                  {activeHistoryGroup.label}
                </h3>
                <p className="mt-2 text-sm text-[#7B6247]">
                  {activeHistoryGroup.logs.length} entr{activeHistoryGroup.logs.length === 1 ? "y" : "ies"} for this date.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveHistoryGroupKey("")}
                className="rounded-full border border-[#E5D9C7] p-2 text-[#8B7355] transition hover:bg-[#FFF3E2] hover:text-[#B8641A]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 sm:px-8">
              <div className="grid grid-cols-1 gap-4">
                {activeHistoryGroup.logs.map((entry) =>
                  renderEntryCard(entry, () => {
                    setActiveHistoryGroupKey("");
                    handleEditEntry(entry);
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default ProcurementTracker;
