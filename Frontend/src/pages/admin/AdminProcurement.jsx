import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Landmark, Boxes, IndianRupee, PackageSearch, X, ArrowUpRight } from "lucide-react";
import {
  addProcurementLog,
  fetchAdminDashboard,
  fetchAdminSuppliers,
  fetchProcurementLogs,
  getCachedAdminDashboard,
  updateProcurementLog,
} from "../../api/admin.api";
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import AdminMobileBottomNav from "../../components/admin/layout/AdminMobileBottomNav";
import ProcurementTracker from "../../components/admin/sections/ProcurementTracker";
import { adminHeadingFont, adminShellFont } from "../../components/admin/adminTheme";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "INR",
  }).format(Number(value || 0));

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatQuantity = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(1);
};

const getLocalDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function AdminProcurement() {
  const cachedDashboard = useMemo(() => getCachedAdminDashboard(), []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProductKey, setSelectedProductKey] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [dashboardMeta, setDashboardMeta] = useState(() => ({
    dairyName: cachedDashboard?.dairyName || null,
    suppliers: cachedDashboard?.suppliers || [],
    stats: cachedDashboard?.stats || {},
  }));
  const [procurementLogs, setProcurementLogs] = useState([]);
  const navigate = useNavigate();
  const todayKey = useMemo(() => getLocalDateKey(new Date()), []);

  const adminName = useMemo(() => {
    try {
      const adminUserStr = localStorage.getItem("adminUser");
      return adminUserStr ? JSON.parse(adminUserStr)?.name : "Admin";
    } catch {
      return "Admin";
    }
  }, []);

  const loadProcurementData = useCallback(async (force = false) => {
    setError("");
    setLoading(true);

    try {
      const [dashboardRes, procurementRes, suppliersRes] = await Promise.all([
        fetchAdminDashboard({ forceRefresh: force }),
        fetchProcurementLogs(),
        fetchAdminSuppliers(),
      ]);

      setDashboardMeta({
        dairyName: dashboardRes?.dairyName || null,
        suppliers: suppliersRes,
        stats: dashboardRes?.stats || {},
      });
      setProcurementLogs(procurementRes);
    } catch (err) {
      setError(err?.message || "Failed to load procurement data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedDate(todayKey);
  }, [todayKey]);

  useEffect(() => {
    loadProcurementData();
  }, [loadProcurementData]);

  const handleSaveProcurement = async (logData, editingLogId = null) => {
    try {
      if (editingLogId) {
        await updateProcurementLog(editingLogId, logData);
        toast.success("Entry updated successfully!");
      } else {
        await addProcurementLog(logData);
        toast.success("Log added successfully!");
      }
      await loadProcurementData(true);
    } catch (_err) {
      toast.error(editingLogId ? "Failed to update entry" : "Failed to add log");
    }
  };

  const selectedDateKey = selectedDate || todayKey;
  const filteredProcurementLogs = useMemo(
    () => procurementLogs.filter((row) => getLocalDateKey(row.created_at) === selectedDateKey),
    [procurementLogs, selectedDateKey]
  );

  const totalSpend = filteredProcurementLogs.reduce(
    (sum, row) => sum + Number(row.total_cost ?? Number(row.quantity || 0) * Number(row.rate_per_unit || row.rate_per_liter || 0)),
    0
  );
  const totalEntries = filteredProcurementLogs.length;
  const uniqueItemsCount = new Set(
    filteredProcurementLogs.map((row) => String(row.item_name || "").trim()).filter(Boolean)
  ).size;
  const uniqueSuppliersCount = new Set(
    filteredProcurementLogs.map((row) => row.supplier_id || row.supplier_name).filter(Boolean)
  ).size;
  const itemBreakdown = useMemo(() => {
    const grouped = new Map();

    filteredProcurementLogs.forEach((row) => {
      const itemName = String(row.item_name || "Unknown Item").trim();
      const unit = String(row.unit || "UNIT").trim().toUpperCase();
      const key = `${itemName}__${unit}`;
      const current = grouped.get(key) || {
        key,
        itemName,
        unit,
        category: String(row.item_category || "OTHER").trim(),
        quantity: 0,
        spend: 0,
        entries: 0,
      };

      current.quantity += toFiniteNumber(row.quantity);
      current.spend += Number(
        row.total_cost ?? Number(row.quantity || 0) * Number(row.rate_per_unit || row.rate_per_liter || 0)
      );
      current.entries += 1;

      grouped.set(key, current);
    });

    return [...grouped.values()].sort((a, b) => b.entries - a.entries || b.quantity - a.quantity);
  }, [filteredProcurementLogs]);
  const selectedProduct = itemBreakdown.find((item) => item.key === selectedProductKey) || null;
  const selectedProductLogs = useMemo(() => {
    if (!selectedProduct) return [];

    return filteredProcurementLogs.filter((row) => {
      const itemName = String(row.item_name || "Unknown Item").trim();
      const unit = String(row.unit || "UNIT").trim().toUpperCase();
      return itemName === selectedProduct.itemName && unit === selectedProduct.unit;
    });
  }, [filteredProcurementLogs, selectedProduct]);

  const productBreakdownSection = (
    <section className="rounded-[20px] border border-[#EDE8DF] bg-white/95 p-4 shadow-[0_12px_28px_rgba(92,61,30,0.06)] dark:border-[#1E293B] dark:bg-[#121829] dark:shadow-none lg:rounded-[28px] lg:p-6 lg:shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl text-[#2C1A0E] dark:text-white lg:text-2xl" style={adminHeadingFont}>Product Breakdown</h2>
          <p className="mt-1 text-sm text-[#8B7355] dark:text-slate-400">
            See exactly how much of each purchased item came in on the selected date. Click any product card to open its purchase details.
          </p>
        </div>
        <div className="text-sm text-[#8B7355] dark:text-slate-400">
          {itemBreakdown.length} tracked item{itemBreakdown.length === 1 ? "" : "s"}
        </div>
      </div>

      {itemBreakdown.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:mt-6 lg:gap-4 xl:grid-cols-3">
          {itemBreakdown.map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => setSelectedProductKey(item.key)}
              className="rounded-[18px] border border-[#EDE8DF] bg-[#FFFDF8] p-4 text-left transition hover:border-[#E5C79D] hover:bg-[#FFF8EF] hover:shadow-[0_14px_28px_rgba(184,100,26,0.10)] dark:border-[#222B40] dark:bg-[#161C2C] dark:hover:border-[#d97706]/40 dark:hover:bg-[#1C243A] dark:hover:shadow-none lg:rounded-[24px] lg:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-[#2C1A0E] dark:text-white">{item.itemName}</h3>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#B89970] dark:text-slate-400">
                    {item.category}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-[#FDE9C9] px-3 py-1 text-xs font-bold text-[#B8641A] dark:bg-[#d97706]/10 dark:text-[#fbbf24]">
                    {item.entries} entr{item.entries === 1 ? "y" : "ies"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#EAD9C2] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8B7355] dark:border-[#222B40] dark:bg-[#0B0F19] dark:text-slate-300">
                    View Details
                    <ArrowUpRight size={13} />
                  </span>
                </div>
              </div>
              <div className="mt-4 text-3xl font-black text-[#2C1A0E] dark:text-white">
                {formatQuantity(item.quantity)} <span className="text-lg text-[#8B7355] dark:text-slate-400">{item.unit}</span>
              </div>
              <div className="mt-2 text-sm text-[#6F4A27] dark:text-slate-300">
                Spend: <span className="font-bold">{formatCurrency(item.spend)}</span>
              </div>
              <div className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-[#B89970] dark:text-slate-500">
                Click to inspect supplier-wise details
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-[#E5D9C7] bg-[#FFFDF8] p-4 text-sm text-[#8B7355] dark:border-[#222B40] dark:bg-[#161C2C] dark:text-slate-400">
          No product-wise procurement entries yet.
        </div>
      )}
    </section>
  );

  return (
    <div className="ds-portal ds-admin-portal min-h-screen bg-[#FAFAF7] text-[#2C1A0E] dark:bg-[#0B0F19] dark:text-white" style={adminShellFont}>
      <AdminMobileTopbar adminName={dashboardMeta?.dairyName || adminName} onMenu={() => setSidebarOpen(true)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="px-4 py-5 pb-32 sm:px-6 lg:ml-64 lg:px-10 lg:py-8 xl:ml-80">
        <section className="rounded-[24px] border border-[#EDE8DF] bg-white/95 p-5 shadow-[0_12px_30px_rgba(92,61,30,0.06)] dark:border-[#1E293B] dark:bg-[#121829] dark:shadow-none lg:rounded-[32px] lg:p-8 lg:shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#B89970]">
                Supply Operations
              </span>
              <h1 className="mt-2 text-3xl text-[#2C1A0E] dark:text-white sm:text-4xl lg:mt-3" style={adminHeadingFont}>
                Purchase Records
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7B6247] dark:text-slate-400 lg:mt-3">
                Record supplier purchases for milk, dairy products, feed, packaging, and other items in one place.
              </p>
            </div>

            <div className="inline-flex items-center gap-3 rounded-[16px] border border-[#EDE8DF] bg-[#FFF8EF] px-3 py-2.5 dark:border-[#222B40] dark:bg-[#161C2C] lg:rounded-2xl lg:px-4 lg:py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#B8641A] shadow-sm dark:bg-[#0B0F19] dark:text-[#fbbf24] dark:shadow-none lg:h-11 lg:w-11 lg:rounded-2xl">
                <Landmark size={18} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970] dark:text-slate-400">
                  {selectedDateKey === todayKey ? "Today's Entries" : "Selected Day Entries"}
                </p>
                <p className="text-lg font-black text-[#2C1A0E] dark:text-white">{totalEntries}</p>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <section className="mt-4 grid grid-cols-3 overflow-hidden rounded-[20px] border border-[#EDE8DF] bg-white shadow-[0_10px_30px_rgba(92,61,30,0.06)] dark:border-[#1E293B] dark:bg-[#121829] dark:shadow-none md:mt-8 md:gap-4 md:overflow-visible md:border-0 md:bg-transparent md:shadow-none">
          <div className="border-r border-[#EDE8DF] p-3 dark:border-[#1E293B] md:rounded-[24px] md:border md:bg-white md:p-6 md:shadow-[0_10px_30px_rgba(92,61,30,0.06)] md:dark:bg-[#121829] md:dark:shadow-none">
            <div className="flex flex-col items-center gap-2 text-center md:flex-row md:gap-3 md:text-left">
              <div className="rounded-xl bg-[#FFF3E2] p-2.5 text-[#B8641A] dark:bg-[#d97706]/10 dark:text-[#fbbf24] md:rounded-2xl md:p-3">
                <PackageSearch size={18} />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase leading-3 tracking-[0.1em] text-[#B89970] dark:text-slate-400 md:text-xs md:tracking-[0.18em]">Items Procured</p>
                <p className="mt-1 text-xl font-black text-[#2C1A0E] dark:text-white md:text-2xl">{uniqueItemsCount}</p>
              </div>
            </div>
          </div>

          <div className="border-r border-[#EDE8DF] p-3 dark:border-[#1E293B] md:rounded-[24px] md:border md:bg-white md:p-6 md:shadow-[0_10px_30px_rgba(92,61,30,0.06)] md:dark:bg-[#121829] md:dark:shadow-none">
            <div className="flex flex-col items-center gap-2 text-center md:flex-row md:gap-3 md:text-left">
              <div className="rounded-xl bg-[#EEF7EB] p-2.5 text-[#6F8C45] dark:bg-emerald-500/10 dark:text-emerald-300 md:rounded-2xl md:p-3">
                <IndianRupee size={18} />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase leading-3 tracking-[0.1em] text-[#B89970] dark:text-slate-400 md:text-xs md:tracking-[0.18em]">Selected Spend</p>
                <p className="mt-1 text-lg font-black text-[#2C1A0E] dark:text-white md:text-2xl">{formatCurrency(totalSpend)}</p>
              </div>
            </div>
          </div>

          <div className="p-3 md:rounded-[24px] md:border md:border-[#EDE8DF] md:bg-white md:p-6 md:shadow-[0_10px_30px_rgba(92,61,30,0.06)] md:dark:border-[#1E293B] md:dark:bg-[#121829] md:dark:shadow-none">
            <div className="flex flex-col items-center gap-2 text-center md:flex-row md:gap-3 md:text-left">
              <div className="rounded-xl bg-[#EAF6FB] p-2.5 text-[#2E7D9A] dark:bg-cyan-500/10 dark:text-cyan-300 md:rounded-2xl md:p-3">
                <Boxes size={18} />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase leading-3 tracking-[0.1em] text-[#B89970] dark:text-slate-400 md:text-xs md:tracking-[0.18em]">Suppliers Used</p>
                <p className="mt-1 text-xl font-black text-[#2C1A0E] dark:text-white md:text-2xl">{uniqueSuppliersCount}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 lg:mt-8">
          {loading ? (
            <div className="rounded-[32px] border border-[#EDE8DF] bg-white p-8 text-sm text-[#8B7355] shadow-[0_18px_45px_rgba(92,61,30,0.08)] dark:border-[#1E293B] dark:bg-[#121829] dark:text-slate-400 dark:shadow-none">
              Loading procurement data...
            </div>
          ) : (
            <ProcurementTracker
              suppliers={dashboardMeta.suppliers}
              logs={procurementLogs}
              selectedDate={selectedDateKey}
              maxDate={todayKey}
              breakdownSection={productBreakdownSection}
              onChangeSelectedDate={(nextDate) => {
                setSelectedDate(nextDate);
                setSelectedProductKey("");
              }}
              onAddLog={handleSaveProcurement}
              onOpenSupplierForm={() => navigate("/admin/suppliers")}
            />
          )}
        </section>
      </main>

      {selectedProduct ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 px-4">
          <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-[#EDE8DF] bg-white shadow-[0_24px_60px_rgba(44,26,14,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#F2EDE4] px-6 py-4 sm:px-8">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970]">
                  Product Details
                </span>
                <h3 className="mt-1 text-[2.1rem] leading-none text-[#2C1A0E]" style={adminHeadingFont}>
                  {selectedProduct.itemName}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#FFF3E2] px-3 py-1 text-sm font-black text-[#B8641A]">
                    {formatQuantity(selectedProduct.quantity)} {selectedProduct.unit}
                  </span>
                  <span className="rounded-full border border-[#E5D9C7] px-3 py-1 text-sm font-semibold text-[#7B6247]">
                    {selectedProduct.entries} entr{selectedProduct.entries === 1 ? "y" : "ies"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductKey("")}
                className="rounded-full border border-[#E5D9C7] p-2 text-[#8B7355] transition hover:bg-[#FFF3E2] hover:text-[#B8641A]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 sm:px-8">
              <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF8] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B89970]">Category</p>
                  <p className="mt-2 text-xl font-black text-[#2C1A0E]">{selectedProduct.category}</p>
                </div>
                <div className="rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF8] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B89970]">Quantity</p>
                  <p className="mt-2 text-xl font-black text-[#2C1A0E]">
                    {formatQuantity(selectedProduct.quantity)} <span className="text-base text-[#8B7355]">{selectedProduct.unit}</span>
                  </p>
                </div>
                <div className="rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF8] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B89970]">Suppliers</p>
                  <p className="mt-2 text-xl font-black text-[#2C1A0E]">
                    {new Set(selectedProductLogs.map((entry) => entry.supplier_name || "-")).size}
                  </p>
                </div>
                <div className="rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF8] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B89970]">Spend</p>
                  <p className="mt-2 text-xl font-black text-[#2C1A0E]">{formatCurrency(selectedProduct.spend)}</p>
                </div>
              </section>

              <section className="mt-5 rounded-[28px] border border-[#EDE8DF] bg-[#FFFDF8] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-2xl text-[#2C1A0E]" style={adminHeadingFont}>Purchase Details</h4>
                    <p className="mt-1 text-sm text-[#8B7355]">
                      Supplier-wise entries for this product in one place.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {selectedProductLogs.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] border border-[#ECE2D5] bg-white px-4 py-3 text-xs text-[#6F4A27]"
                    >
                      <span className="min-w-[120px] font-bold text-[#2C1A0E]">
                        {entry.supplier_name || "-"}
                      </span>
                      <span className="rounded-full bg-[#FFF3E2] px-2.5 py-1 font-semibold text-[#B8641A]">
                        {formatQuantity(entry.quantity)} {entry.unit || ""}
                      </span>
                      <span>
                        Rate: <span className="font-semibold">Rs {entry.rate_per_unit || entry.rate_per_liter || "-"}</span>
                      </span>
                      <span>
                        Total: <span className="font-semibold">
                          {formatCurrency(
                            entry.total_cost ?? Number(entry.quantity || 0) * Number(entry.rate_per_unit || entry.rate_per_liter || 0)
                          )}
                        </span>
                      </span>
                      <span className="text-[#8B7355] sm:ml-auto">
                        {entry.created_at
                          ? new Date(entry.created_at).toLocaleString([], {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
      <AdminMobileBottomNav />
    </div>
  );
}
