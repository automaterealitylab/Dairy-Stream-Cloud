import React from "react";
import { CheckCircle2 } from "lucide-react";
import { formatProductStockLabel, isProductOutOfStock } from "../../utils/buyOnce.js";

const getProductImage = (type) => {
  const t = String(type || "").toUpperCase();
  switch (t) {
    case "MILK":
      return <img src="/images/products/milk.png" alt="Milk" width="64" height="64" loading="lazy" className="h-full w-full object-contain" />;
    case "CURD":
      return <img src="/images/products/curd.png" alt="Curd" width="64" height="64" loading="lazy" className="h-full w-full object-contain" />;
    case "PANEER":
      return <img src="/images/products/paneer.png" alt="Paneer" width="64" height="64" loading="lazy" className="h-full w-full object-contain" />;
    case "GHEE":
      return <img src="/images/products/ghee.png" alt="Ghee" width="64" height="64" loading="lazy" className="h-full w-full object-contain" />;
    default:
      return <img src="/images/products/other.png" alt="Other" width="64" height="64" loading="lazy" className="h-full w-full object-contain" />;
  }
};

export const ProductCard = ({ item, form, setForm, toggleProductSelection }) => (
  <button
    type="button"
    disabled={isProductOutOfStock(item.stockQuantity)}
    onClick={() => {
      setForm((prev) => ({ ...prev, milkType: item.name }));
      toggleProductSelection(item.name);
    }}
    className={`relative p-3 rounded-xl border-2 text-left transition-all group flex flex-col sm:flex-row gap-2.5 ${
      isProductOutOfStock(item.stockQuantity)
      ? "border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
      :
      Number(form.items?.[item.name] || 0) > 0
      ? "border-blue-600 bg-blue-50/50 ring-4 ring-blue-50"
      : "border-slate-100 hover:border-slate-300 bg-white"
    }`}
  >
    {/* Product Image */}
    <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-lg bg-[#FAF9F5] border border-slate-200/50 p-1 shadow-sm">
      {getProductImage(item.type)}
    </div>

    <div className="flex-1 min-w-0">
      {Number(form.items?.[item.name] || 0) > 0 && (
        <CheckCircle2 size={16} className="absolute top-2 right-2 text-blue-600" />
      )}
      <p className={`text-xs sm:text-sm font-bold truncate ${Number(form.items?.[item.name] || 0) > 0 ? "text-blue-900" : "text-slate-600"}`}>{item.name}</p>
      <p className="text-sm sm:text-base font-black text-slate-900 mt-0.5">Rs {item.ratePerUnit}<span className="text-[9px] text-slate-400 font-normal">/{item.unit}</span></p>
      <p className={`text-[9px] sm:text-[10px] mt-0.5 font-semibold ${isProductOutOfStock(item.stockQuantity) ? "text-red-500" : "text-emerald-600"}`}>
        Stock: {formatProductStockLabel(item.stockQuantity)}
      </p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
        {Number(form.items?.[item.name] || 0) > 0 ? `${form.items?.[item.name]}L selected` : "Tap to add"}
      </p>
    </div>
  </button>
);
