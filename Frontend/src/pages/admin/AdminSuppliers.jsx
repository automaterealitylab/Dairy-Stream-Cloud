import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, X } from "lucide-react";
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import {
  createAdminSupplier,
  fetchAdminSuppliers,
  fetchProcurementLogs,
  removeAdminSupplier,
  updateAdminSupplier,
} from "../../api/admin.api";
import { adminHeadingFont, adminShellFont } from "../../components/admin/adminTheme";

const initialForm = {
  name: "",
  phone: "",
  address: "",
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "INR",
  }).format(Number(value || 0));

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

export default function AdminSuppliers() {
  const todayKey = useMemo(() => getLocalDateKey(new Date()), []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [procurementLogs, setProcurementLogs] = useState([]);
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [supplierPendingDeactivate, setSupplierPendingDeactivate] = useState(null);
  const [supplierSummaryTarget, setSupplierSummaryTarget] = useState(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [summaryDateRange, setSummaryDateRange] = useState({ from: todayKey, to: todayKey });
  const [form, setForm] = useState(initialForm);

  const adminName = useMemo(() => {
    try {
      const adminUserStr = localStorage.getItem("adminUser");
      return adminUserStr ? JSON.parse(adminUserStr)?.name : "Admin";
    } catch {
      return "Admin";
    }
  }, []);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const [supplierData, purchaseData] = await Promise.all([
        fetchAdminSuppliers(),
        fetchProcurementLogs(),
      ]);
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setProcurementLogs(Array.isArray(purchaseData) ? purchaseData : []);
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const resetForm = () => {
    setEditingSupplierId(null);
    setForm(initialForm);
    setShowSupplierForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      };

      if (editingSupplierId) {
        await updateAdminSupplier(editingSupplierId, payload);
        toast.success("Supplier updated");
      } else {
        await createAdminSupplier(payload);
        toast.success("Supplier added");
      }

      resetForm();
      await loadSuppliers();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplierId(supplier.id);
    setForm({
      name: supplier.name || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
    });
    setShowSupplierForm(true);
  };

  const handleDeactivate = async (supplier) => {
    try {
      await removeAdminSupplier(supplier.id);
      toast.success("Supplier deactivated");
      if (editingSupplierId === supplier.id) {
        resetForm();
      }
      await loadSuppliers();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to deactivate supplier");
    }
  };

  const filteredSupplierSummary = useMemo(() => {
    if (!supplierSummaryTarget) return null;

    const targetKey =
      supplierSummaryTarget.id != null
        ? String(supplierSummaryTarget.id)
        : String(supplierSummaryTarget.name || "").trim().toLowerCase();

    const filteredLogs = procurementLogs.filter((row) => {
      const rowSupplierKey =
        row.supplier_id != null
          ? String(row.supplier_id)
          : String(row.supplier_name || "").trim().toLowerCase();
      if (rowSupplierKey !== targetKey) return false;

      const rowDate = getLocalDateKey(row.created_at);
      const effectiveFrom = summaryDateRange.from || todayKey;
      const effectiveTo = summaryDateRange.to || todayKey;
      if (rowDate < effectiveFrom) return false;
      if (rowDate > effectiveTo) return false;
      return true;
    });

    const products = new Map();
    let grossTotal = 0;

    filteredLogs.forEach((row) => {
      const itemName = String(row.item_name || "Unknown Item").trim();
      const unit = String(row.unit || "UNIT").trim().toUpperCase();
      const itemKey = `${itemName}__${unit}`;
      const amount = Number(
        row.total_cost ?? Number(row.quantity || 0) * Number(row.rate_per_unit || row.rate_per_liter || 0)
      );
      const quantity = Number(row.quantity || 0);
      const current = products.get(itemKey) || {
        itemName,
        unit,
        category: String(row.item_category || "OTHER").trim(),
        quantity: 0,
        amount: 0,
      };

      current.quantity += Number.isFinite(quantity) ? quantity : 0;
      current.amount += Number.isFinite(amount) ? amount : 0;
      grossTotal += Number.isFinite(amount) ? amount : 0;
      products.set(itemKey, current);
    });

    return {
      grossTotal,
      totalEntries: filteredLogs.length,
      products: [...products.values()].sort((a, b) => b.amount - a.amount),
    };
  }, [procurementLogs, supplierSummaryTarget, summaryDateRange, todayKey]);

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#2C1A0E]" style={adminShellFont}>
      <AdminMobileTopbar adminName="Suppliers" onMenu={() => setSidebarOpen(true)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="px-4 py-8 sm:px-6 lg:ml-64 lg:px-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl text-[#2C1A0E]" style={adminHeadingFont}>Suppliers</h1>
            <p className="mt-1 text-sm text-[#8B7355]">
              Manage active suppliers and keep their details updated for purchase entries.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingSupplierId(null);
              setForm(initialForm);
              setShowSupplierForm(true);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#B8641A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#9E5415]"
          >
            + Add Supplier
          </button>
        </div>

        <div className="rounded-[28px] border border-[#EDE8DF] bg-white/95 shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
          <div className="flex flex-col gap-4 border-b border-[#F2EDE4] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-[#8B7355]">
                Total Suppliers <span className="font-medium text-[#2C1A0E]">{suppliers.length}</span>
              </p>
            </div>
            <div className="text-sm text-[#8B7355]">
              Edit details or deactivate suppliers that are no longer active.
            </div>
          </div>

          <div className="divide-y divide-[#F5EFE6]">
            {loading ? (
              <div className="px-6 py-10 text-center text-sm text-[#8B7355]">
                Loading suppliers...
              </div>
            ) : suppliers.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-[#8B7355]">
                No active suppliers available.
              </div>
            ) : (
              suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="flex flex-col justify-between gap-4 px-6 py-4 transition hover:bg-[#FFFDF8] sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FDF6EC] font-bold uppercase text-[#B8641A]">
                      {supplier.name?.charAt(0) || "S"}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 font-medium text-[#2C1A0E]">
                        <span>{supplier.name || "Unnamed Supplier"}</span>
                        <span className="rounded-full bg-[#F4F7ED] px-2 py-0.5 text-[10px] font-bold uppercase text-[#6F8C45]">
                          Active
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-sm text-[#8B7355]">
                        <span>{supplier.phone || "No phone"}</span>
                        {supplier.address ? <span className="text-gray-300">|</span> : null}
                        {supplier.address ? (
                          <span className="font-medium text-[#B8641A]">{supplier.address}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setSupplierSummaryTarget(supplier);
                        setSummaryDateRange({ from: todayKey, to: todayKey });
                      }}
                      className="rounded-full bg-[#F8F3EC] px-4 py-2 font-medium text-[#6F4A27] transition hover:bg-[#F1E3D0]"
                    >
                      View Purchases
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(supplier)}
                      className="rounded-full bg-[#FFF3E2] px-4 py-2 font-medium text-[#B8641A] transition hover:bg-[#FDE9C9]"
                    >
                      Edit Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupplierPendingDeactivate(supplier)}
                      className="rounded-full bg-[#FFF1EE] px-4 py-2 font-medium text-[#A85734] transition hover:bg-[#FBD8D0]"
                    >
                      Deactivate
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {supplierSummaryTarget ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 px-4">
          <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-[#EDE8DF] bg-white shadow-[0_24px_60px_rgba(44,26,14,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#F2EDE4] px-6 py-4 sm:px-8">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970]">
                  Supplier Purchases
                </span>
                <h2 className="mt-1 text-[2.2rem] leading-none text-[#2C1A0E]" style={adminHeadingFont}>
                  {supplierSummaryTarget.name}
                </h2>
                <p className="mt-1 text-sm text-[#8B7355]">
                  View product-wise purchases and total amount for any date range you need.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSupplierSummaryTarget(null)}
                className="rounded-full border border-[#E5D9C7] p-2 text-[#8B7355] transition hover:bg-[#FFF3E2] hover:text-[#B8641A]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 sm:px-8">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto_auto_auto] md:items-stretch">
                <label className="rounded-[22px] border border-[#E5D9C7] bg-[#FFFDF8] px-4 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970]">From Date</span>
                  <input
                    type="date"
                    value={summaryDateRange.from}
                    onChange={(e) => setSummaryDateRange((prev) => ({ ...prev, from: e.target.value }))}
                    className="mt-2 block w-full bg-transparent text-sm font-bold text-[#2C1A0E] outline-none"
                  />
                </label>
                <label className="rounded-[22px] border border-[#E5D9C7] bg-[#FFFDF8] px-4 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970]">To Date</span>
                  <input
                    type="date"
                    value={summaryDateRange.to}
                    onChange={(e) => setSummaryDateRange((prev) => ({ ...prev, to: e.target.value }))}
                    className="mt-2 block w-full bg-transparent text-sm font-bold text-[#2C1A0E] outline-none"
                  />
                </label>
                <div className="rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF8] px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B89970]">Products</p>
                  <p className="mt-1 text-xl font-black text-[#2C1A0E]">{filteredSupplierSummary?.products.length || 0}</p>
                </div>
                <div className="rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF8] px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B89970]">Entries</p>
                  <p className="mt-1 text-xl font-black text-[#2C1A0E]">{filteredSupplierSummary?.totalEntries || 0}</p>
                </div>
                <div className="rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF8] px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B89970]">Gross Total</p>
                  <p className="mt-1 text-xl font-black text-[#2C1A0E]">{formatCurrency(filteredSupplierSummary?.grossTotal || 0)}</p>
                </div>
              </div>

              {filteredSupplierSummary?.products.length ? (
                <div className="mt-5 grid grid-cols-1 gap-2.5 lg:grid-cols-3">
                  {filteredSupplierSummary.products.map((product) => (
                    <div
                      key={`${supplierSummaryTarget.id}-${product.itemName}-${product.unit}`}
                      className="rounded-[18px] border border-[#EADBC8] bg-[#FFFDF8] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[15px] font-black leading-5 text-[#2C1A0E]">{product.itemName}</p>
                          <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#B89970]">
                            {product.category}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#FFF3E2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#B8641A]">
                          {formatQuantity(product.quantity)} {product.unit}
                        </span>
                      </div>
                      <div className="mt-2 rounded-2xl bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#B89970]">Total Amount</p>
                        <p className="mt-1 text-sm font-black text-[#2C1A0E]">{formatCurrency(product.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-[#E5D9C7] bg-[#FFFDF8] px-4 py-5 text-sm text-[#8B7355]">
                  No purchases found for this supplier in the selected date range.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showSupplierForm ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-[32px] border border-[#EDE8DF] bg-white p-6 shadow-[0_24px_60px_rgba(44,26,14,0.18)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl text-[#2C1A0E]" style={adminHeadingFont}>
                  {editingSupplierId ? "Edit Supplier" : "Add Supplier"}
                </h2>
                <p className="mt-1 text-sm text-[#8B7355]">
                  {editingSupplierId
                    ? "Update the supplier information and save the changes."
                    : "Create a supplier that can be used in purchase entries."}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-[#E5D9C7] p-2 text-[#8B7355] transition hover:bg-[#FFF3E2] hover:text-[#B8641A]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4">
              <input
                type="text"
                placeholder="Supplier name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] px-4 py-4 text-sm font-bold text-[#2C1A0E] outline-none focus:ring-2 focus:ring-[#C98A42]"
                required
              />
              <input
                type="text"
                placeholder="Phone number"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] px-4 py-4 text-sm font-bold text-[#2C1A0E] outline-none focus:ring-2 focus:ring-[#C98A42]"
              />
              <input
                type="text"
                placeholder="Address"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                className="rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] px-4 py-4 text-sm font-bold text-[#2C1A0E] outline-none focus:ring-2 focus:ring-[#C98A42]"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-[#E5D9C7] px-5 py-3 text-sm font-black text-[#8B7355] transition hover:bg-[#F8F3EC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-[#B8641A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#9E5415] disabled:opacity-70"
                >
                  {saving ? "Saving..." : editingSupplierId ? "Update Supplier" : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {supplierPendingDeactivate ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-[32px] border border-[#EDE8DF] bg-white p-6 shadow-[0_24px_60px_rgba(44,26,14,0.18)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-[#FFF3E2] p-3 text-[#B8641A]">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-2xl text-[#2C1A0E]" style={adminHeadingFont}>Deactivate Supplier</h3>
                  <p className="mt-2 text-sm leading-6 text-[#7B6247]">
                    Deactivate <span className="font-black text-[#2C1A0E]">{supplierPendingDeactivate.name}</span> from active suppliers.
                    Old procurement entries will remain unchanged.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSupplierPendingDeactivate(null)}
                className="rounded-full border border-[#E5D9C7] p-2 text-[#8B7355] transition hover:bg-[#FFF3E2] hover:text-[#B8641A]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSupplierPendingDeactivate(null)}
                className="rounded-2xl border border-[#E5D9C7] px-5 py-3 text-sm font-black text-[#8B7355] transition hover:bg-[#F8F3EC]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetSupplier = supplierPendingDeactivate;
                  setSupplierPendingDeactivate(null);
                  await handleDeactivate(targetSupplier);
                }}
                className="rounded-2xl bg-[#B8641A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#9E5415]"
              >
                Deactivate Supplier
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
