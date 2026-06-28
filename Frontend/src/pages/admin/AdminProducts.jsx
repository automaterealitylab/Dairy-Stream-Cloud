import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  IndianRupee,
  PackagePlus,
  Pencil,
  Search,
  Trash2,
  XCircle,
  Milk,
  Droplets,
  Layers,
  Flame,
  Package,
} from "lucide-react";
import {
  createAdminProduct,
  deleteAdminProduct,
  fetchAdminProducts,
  updateAdminProduct,
} from "../../api/admin.api.js";
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import AdminMobileBottomNav from "../../components/admin/layout/AdminMobileBottomNav";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import { adminHeadingFont, adminShellFont } from "../../components/admin/adminTheme";

const defaultForm = {
  name: "",
  type: "MILK",
  unit: "LITER",
  ratePerUnit: "",
  stockQuantity: "",
  isActive: true,
};

const toDecimal = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatStockValue = (value) => {
  const stock = toDecimal(value);
  return stock <= 0 ? "Out of Stock" : stock.toFixed(2);
};

const formatRateValue = (value, unit) => `Rs ${toDecimal(value).toFixed(2)} / ${unit || "UNIT"}`;

const isOutOfStock = (value) => toDecimal(value) <= 0;

const getProductIcon = (type) => {
  const t = String(type || "").toUpperCase();
  switch (t) {
    case "MILK":
      return <img src="/images/products/milk.png" alt="Milk" className="h-full w-full object-contain" />;
    case "CURD":
      return <img src="/images/products/curd.png" alt="Curd" className="h-full w-full object-contain" />;
    case "PANEER":
      return <img src="/images/products/paneer.png" alt="Paneer" className="h-full w-full object-contain" />;
    case "GHEE":
      return <img src="/images/products/ghee.png" alt="Ghee" className="h-full w-full object-contain" />;
    default:
      return <img src="/images/products/other.png" alt="Other" className="h-full w-full object-contain" />;
  }
};

function ProductStatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-green-100 text-green-700 dark:bg-emerald-500/10 dark:text-[#00C896]"
          : "bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-slate-400"
      }`}
    >
      {active ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function AdminProducts() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm);

  const adminName = useMemo(() => {
    try {
      const adminUserStr = localStorage.getItem("adminUser");
      return adminUserStr ? JSON.parse(adminUserStr)?.name : "Admin";
    } catch {
      return "Admin";
    }
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetchAdminProducts({ search, includeInactive: true });
      setProducts(Array.isArray(res?.products) ? res.products : []);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Failed to load products",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search]);

  const totalStock = useMemo(
    () => products.reduce((acc, item) => acc + toDecimal(item.stockQuantity), 0),
    [products]
  );

  const resetForm = () => {
    setEditingId(null);
    setForm(defaultForm);
    setShowProductModal(false);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      type: item.type || "MILK",
      unit: item.unit || "LITER",
      ratePerUnit: item.ratePerUnit ?? "",
      stockQuantity: item.stockQuantity ?? "",
      isActive: Boolean(item.isActive),
    });
    setShowProductModal(true);
  };

  const startAddProduct = () => {
    setEditingId(null);
    setForm(defaultForm);
    setShowProductModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback({ type: "", message: "" });
    try {
      const payload = {
        name: form.name,
        type: form.type,
        unit: form.unit,
        ratePerUnit: Number(form.ratePerUnit),
        stockQuantity: Number(form.stockQuantity),
        isActive: form.isActive,
      };

      if (editingId) {
        await updateAdminProduct(editingId, payload);
        setFeedback({ type: "success", message: "Product updated" });
      } else {
        await createAdminProduct(payload);
        setFeedback({ type: "success", message: "Product added" });
      }
      resetForm();
      await loadProducts();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Failed to save product",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const shouldDelete = window.confirm("Delete this product?");
    if (!shouldDelete) return;

    setFeedback({ type: "", message: "" });
    try {
      await deleteAdminProduct(id);
      if (editingId && Number(editingId) === Number(id)) {
        resetForm();
      }
      setFeedback({ type: "success", message: "Product deleted" });
      await loadProducts();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Failed to delete product",
      });
    }
  };

  return (
    <div className="ds-portal ds-admin-portal min-h-screen bg-[#FAFAF7] text-[#2C1A0E] dark:bg-[#0B0F19] dark:text-white" style={adminShellFont}>
      <AdminMobileTopbar adminName={adminName} onMenu={() => setSidebarOpen(true)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="px-4 py-8 pb-32 sm:px-6 lg:ml-64 lg:px-10 xl:ml-80">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl text-[#2C1A0E] dark:text-white" style={adminHeadingFont}>Products & Stock</h1>
            <p className="mt-1 text-sm text-[#8B7355] dark:text-slate-400">
              Add milk, dahi, paneer and track available stock for customer orders.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[280px]">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-[#EDE8DF] bg-[#ffffff] px-4 py-3 dark:border-[#1E293B] dark:bg-[#121829]">
                <p className="text-[11px] font-semibold uppercase text-[#C4A882] dark:text-slate-500">Products</p>
                <p className="mt-1 text-xl font-bold text-[#2C1A0E] dark:text-white">{products.length}</p>
              </div>
              <div className="rounded-2xl border border-[#EDE8DF] bg-[#ffffff] px-4 py-3 dark:border-[#1E293B] dark:bg-[#121829]">
                <p className="text-[11px] font-semibold uppercase text-[#C4A882] dark:text-slate-500">Stock</p>
                <p className="mt-1 text-xl font-bold text-[#2C1A0E] dark:text-white">{totalStock.toFixed(2)}</p>
              </div>
            </div>
            <button type="button" onClick={startAddProduct} className="pro-btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto">
              <PackagePlus size={18} />
              Add Product
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <section className="overflow-hidden rounded-[24px] border border-[#EDE8DF] bg-white/95 shadow-[0_18px_45px_rgba(92,61,30,0.08)] dark:border-[#1E293B] dark:bg-[#121829] dark:shadow-none">
            <div className="border-b border-[#F2EDE4] p-4 sm:p-5 dark:border-[#1E293B]">
              <div className="relative max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#B89970] dark:text-slate-500" size={18} />
                <input
                  className="pro-input mt-0 !pl-12"
                  placeholder="Search by name or type"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <LoadingIndicator className="py-10" message="Loading products..." />
            ) : products.length === 0 ? (
              <div className="px-6 py-10 text-[#8B7355] dark:text-slate-400">No products yet. Add your first product.</div>
            ) : (
              <>
                <div className="grid gap-3 p-4 md:hidden">
                  {products.map((item) => {
                    const shouldShowActive = item.isActive && !isOutOfStock(item.stockQuantity);
                    return (
                      <article
                        key={item.id}
                        className="rounded-2xl border border-[#F2EDE4] bg-[#FFFDF8] p-4 dark:border-[#1E293B] dark:bg-[#161C2C]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-[#121829] border border-[#F2EDE4] dark:border-slate-700 shadow-sm p-1">
                              {getProductIcon(item.type)}
                            </div>
                            <div className="min-w-0">
                              <h2 className="truncate text-base font-bold text-[#2C1A0E] dark:text-white leading-tight">{item.name}</h2>
                              <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-[#C4A882] dark:text-slate-500">
                                {item.type || "Product"}
                              </p>
                            </div>
                          </div>
                          <ProductStatusBadge active={shouldShowActive} />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-[#F2EDE4] bg-white px-3 py-2 dark:border-[#222B40] dark:bg-[#121829]">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-[#C4A882] dark:text-slate-500">
                              <IndianRupee size={13} />
                              Rate
                            </div>
                            <p className="mt-1 text-sm font-semibold text-[#2C1A0E] dark:text-white">
                              {formatRateValue(item.ratePerUnit, item.unit)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-[#F2EDE4] bg-white px-3 py-2 dark:border-[#222B40] dark:bg-[#121829]">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-[#C4A882] dark:text-slate-500">
                              <Boxes size={13} />
                              Stock
                            </div>
                            <p className="mt-1 text-sm font-semibold text-[#2C1A0E] dark:text-white">
                              {formatStockValue(item.stockQuantity)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#E5D9C7] bg-white text-sm font-semibold text-[#6F4A27] hover:bg-[#FDF6EC] dark:border-[#1E293B] dark:bg-[#121829] dark:text-slate-300 dark:hover:bg-[#1C243A]"
                          >
                            <Pencil size={16} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/20 dark:bg-[#121829] dark:text-red-400 dark:hover:bg-red-500/10"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[760px] text-left">
                    <thead className="bg-[#FFFDF8] text-xs uppercase text-[#C4A882] dark:bg-[#161C2C] dark:text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Name</th>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3">Rate</th>
                        <th className="px-5 py-3">Stock</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {products.map((item) => {
                        const shouldShowActive = item.isActive && !isOutOfStock(item.stockQuantity);
                        return (
                          <tr key={item.id}>
                            <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-0.5">
                                  {getProductIcon(item.type)}
                                </div>
                                <span>{item.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-gray-600 dark:text-slate-300">{item.type}</td>
                            <td className="px-5 py-3 text-gray-600 dark:text-slate-300">
                              {formatRateValue(item.ratePerUnit, item.unit)}
                            </td>
                            <td className="px-5 py-3 text-gray-600 dark:text-slate-300">{formatStockValue(item.stockQuantity)}</td>
                            <td className="px-5 py-3">
                              <ProductStatusBadge active={shouldShowActive} />
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEdit(item)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-[#1E293B] dark:text-slate-300 dark:hover:bg-[#1C243A]"
                                >
                                  <Pencil size={14} />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item.id)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/10"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>

        {feedback.message && (
          <div
            className={`mt-5 rounded-xl px-4 py-3 text-sm ${
              feedback.type === "error"
                ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                : "bg-green-50 text-green-700 border border-green-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {showProductModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-2xl rounded-[28px] border border-[#EDE8DF] bg-[#ffffff] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.18)] dark:border-[#1E293B] dark:bg-[#121829]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl text-[#2C1A0E] dark:text-white" style={adminHeadingFont}>
                    {editingId ? "Edit Product" : "Add Product"}
                  </h2>
                  <p className="mt-1 text-sm text-[#8B7355] dark:text-slate-400">
                    Fill in the product details and save them to the catalog.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-full border border-[#EDE8DF] px-3 py-1.5 text-sm text-[#6F4A27] hover:bg-[#FAF7F1] dark:border-[#1E293B] dark:text-slate-400 dark:hover:bg-[#1C243A]"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                <input
                  className="pro-input"
                  placeholder="Product name (Milk, Dahi, Paneer)"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <select
                    className="pro-input"
                    value={form.type}
                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="MILK">Milk</option>
                    <option value="CURD">Dahi/Curd</option>
                    <option value="PANEER">Paneer</option>
                    <option value="GHEE">Ghee</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <select
                    className="pro-input"
                    value={form.unit}
                    onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                  >
                    <option value="LITER">Liter</option>
                    <option value="KG">Kg</option>
                    <option value="PIECE">Piece</option>
                    <option value="PACK">Pack</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="pro-input"
                    placeholder="Rate"
                    value={form.ratePerUnit}
                    onChange={(e) => setForm((prev) => ({ ...prev, ratePerUnit: e.target.value }))}
                    required
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="pro-input"
                    placeholder="Stock"
                    value={form.stockQuantity}
                    onChange={(e) => setForm((prev) => ({ ...prev, stockQuantity: e.target.value }))}
                    required
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-[#6F4A27] dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Active product
                </label>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="pro-btn-primary flex-1"
                  >
                    {saving ? "Saving..." : editingId ? "Update Product" : "Add Product"}
                  </button>
                  <button type="button" onClick={resetForm} className="pro-btn-outline">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
      <AdminMobileBottomNav />
    </div>
  );
}
