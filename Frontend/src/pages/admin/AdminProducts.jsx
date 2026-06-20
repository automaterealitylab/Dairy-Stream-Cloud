import { useEffect, useMemo, useState } from "react";
import {
  createAdminProduct,
  deleteAdminProduct,
  fetchAdminProducts,
  updateAdminProduct,
} from "../../api/admin.api.js";
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
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

const isOutOfStock = (value) => toDecimal(value) <= 0;

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
    <div className="min-h-screen bg-[#FAFAF7] text-[#2C1A0E]" style={adminShellFont}>
      <AdminMobileTopbar adminName="Products" onMenu={() => setSidebarOpen(true)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="px-4 py-8 sm:px-6 lg:ml-64 lg:px-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl text-[#2C1A0E]" style={adminHeadingFont}>Products & Stock</h1>
            <p className="mt-1 text-sm text-[#8B7355]">
              Add milk, dahi, paneer and track available stock for customer orders.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="rounded-xl border border-[#EDE8DF] bg-white px-4 py-2 text-sm text-[#8B7355]">
              Total SKUs: <span className="font-semibold text-[#2C1A0E]">{products.length}</span> | Total Stock:{" "}
              <span className="font-semibold text-[#2C1A0E]">{totalStock.toFixed(2)}</span>
            </div>
            <button type="button" onClick={startAddProduct} className="pro-btn-primary w-full sm:w-auto">
              Add Product
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <section className="rounded-[28px] border border-[#EDE8DF] bg-white/95 shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
            <div className="flex flex-col gap-3 border-b border-[#F2EDE4] p-5 sm:flex-row sm:items-center sm:justify-between">
              <input
                className="pro-input max-w-sm"
                placeholder="Search by name or type"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <LoadingIndicator className="py-10" message="Loading products..." />
            ) : products.length === 0 ? (
              <div className="px-6 py-10 text-[#8B7355]">No products yet. Add your first product.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#FFFDF8] text-xs uppercase text-[#C4A882]">
                    <tr>
                      <th className="px-5 py-3">Name</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Rate</th>
                      <th className="px-5 py-3">Stock</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((item) => {
                      const shouldShowActive = item.isActive && !isOutOfStock(item.stockQuantity);
                      return (
                      <tr key={item.id}>
                        <td className="px-5 py-3 font-medium text-gray-900">{item.name}</td>
                        <td className="px-5 py-3 text-gray-600">{item.type}</td>
                        <td className="px-5 py-3 text-gray-600">
                          Rs {toDecimal(item.ratePerUnit).toFixed(2)} / {item.unit}
                        </td>
                        <td className="px-5 py-3 text-gray-600">{formatStockValue(item.stockQuantity)}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              shouldShowActive
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {shouldShowActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="px-3 py-1.5 rounded border text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="px-3 py-1.5 rounded border text-sm text-red-600 hover:bg-red-50"
                            >
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
            )}
          </section>
        </div>

        {feedback.message && (
          <div
            className={`mt-5 rounded-xl px-4 py-3 text-sm ${
              feedback.type === "error"
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-green-50 text-green-700 border border-green-200"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {showProductModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-2xl rounded-[28px] border border-[#EDE8DF] bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl text-[#2C1A0E]" style={adminHeadingFont}>
                    {editingId ? "Edit Product" : "Add Product"}
                  </h2>
                  <p className="mt-1 text-sm text-[#8B7355]">
                    Fill in the product details and save them to the catalog.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-full border border-[#EDE8DF] px-3 py-1.5 text-sm text-[#6F4A27] hover:bg-[#FAF7F1]"
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
                <label className="inline-flex items-center gap-2 text-sm text-[#6F4A27]">
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
    </div>
  );
}
