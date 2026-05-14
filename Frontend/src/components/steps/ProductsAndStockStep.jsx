import React, { useState } from "react";
import toast from "react-hot-toast";
import { Milk, Trash2, Search, PlusCircle } from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const controlClassName =
  "w-full rounded-[16px] border border-[#EDE8DF] bg-white px-4 py-3 text-sm font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A]";

const ProductsAndStockStep = ({ formData, setFormData }) => {
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "Milk",
    unit: "Liter",
    packagingQuantity: "",
    packagingUnit: "Liter",
    rate: "",
    stock: "",
    isActive: true,
  });

  const [searchTerm, setSearchTerm] = useState("");

  const handleAddProduct = () => {
    if (!newProduct.name || !newProduct.rate || !newProduct.stock) {
      toast.error("Please fill Name, Rate and Stock");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      products: {
        ...prev.products,
        [newProduct.name]: {
          category: newProduct.category,
          unit: newProduct.unit,
          packagingQuantity: parseFloat(newProduct.packagingQuantity) || 0,
          packagingUnit: newProduct.packagingUnit,
          rate: parseInt(newProduct.rate),
          stock: parseFloat(newProduct.stock),
          status: newProduct.isActive ? "Active" : "Inactive",
        },
      },
    }));

    toast.success("Product added");

    setNewProduct({
      name: "",
      category: "Milk",
      unit: "Liter",
      packagingQuantity: "",
      packagingUnit: "Liter",
      rate: "",
      stock: "",
      isActive: true,
    });
  };

  const removeProduct = (name) => {
    setFormData((prev) => {
      const updated = { ...prev.products };
      delete updated[name];
      return { ...prev, products: updated };
    });
  };

  const productList = Object.entries(formData.products || {});

  const filteredList = productList.filter(([name]) =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-5 sm:p-10">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">Catalog Setup</p>
      <h2 className="mb-2 mt-2 text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
        Products & Stock
      </h2>
      <p className="mb-8 text-sm text-[#8B7355]">
        Add each product customers can order, along with rate, stock, and availability.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-5">
        <div className="self-start md:sticky md:top-10 md:col-span-2">
          <div className="space-y-6 rounded-[24px] border border-[#E7DAC6] bg-[#FBF7F0] p-5 sm:rounded-[28px] sm:p-8">
            <h3 className="flex items-center gap-2 text-xl font-bold text-[#2C1A0E]">
              <Milk size={20} className="text-[#B8641A]" />
              Add Product
            </h3>

            <input
              type="text"
              placeholder="Product name (Milk, Dahi, Paneer)"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              className={controlClassName}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <select
                value={newProduct.category}
                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                className={controlClassName}
              >
                <option>Milk</option>
                <option>Dahi</option>
                <option>Paneer</option>
                <option>Butter</option>
                <option>Ghee</option>
              </select>

              <select
                value={newProduct.unit}
                onChange={(e) => {
                  const selectedUnit = e.target.value;
                  const packagingUnit =
                    selectedUnit === "Liter"
                      ? "Liter"
                      : selectedUnit === "Kg"
                        ? "Kg"
                        : selectedUnit;
                  setNewProduct({ ...newProduct, unit: selectedUnit, packagingUnit });
                }}
                className={controlClassName}
              >
                <option>Liter</option>
                <option>Kg</option>
                <option>Packet</option>
                <option>Piece</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#A88763]">Rate</p>
                <input
                  type="number"
                  placeholder="Rate (Rs)"
                  value={newProduct.rate}
                  onChange={(e) => setNewProduct({ ...newProduct, rate: e.target.value })}
                  className={controlClassName}
                />
              </div>

              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#A88763]">Stock</p>
                <input
                  type="number"
                  placeholder="Stock"
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                  className={controlClassName}
                />
              </div>

              <div className="sm:col-span-2">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#A88763]">
                  Packaging Quantity
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                  <input
                    type="number"
                    placeholder={`Packaging quantity in ${newProduct.packagingUnit}`}
                    value={newProduct.packagingQuantity}
                    onChange={(e) => setNewProduct({ ...newProduct, packagingQuantity: e.target.value })}
                    className={controlClassName}
                  />
                  <select
                    value={newProduct.packagingUnit}
                    onChange={(e) => setNewProduct({ ...newProduct, packagingUnit: e.target.value })}
                    className={controlClassName}
                  >
                    {newProduct.unit === "Liter" ? (
                      <>
                        <option>Liter</option>
                        <option>ml</option>
                      </>
                    ) : newProduct.unit === "Kg" ? (
                      <>
                        <option>Kg</option>
                        <option>gram</option>
                      </>
                    ) : (
                      <option>{newProduct.unit}</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-[#8B7355]">
              <input
                type="checkbox"
                checked={newProduct.isActive}
                onChange={(e) => setNewProduct({ ...newProduct, isActive: e.target.checked })}
                className="rounded border-[#D4B896] text-[#B8641A] focus:ring-[#B8641A]"
              />
              Active product
            </label>

            <button
              onClick={handleAddProduct}
              className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#B8641A] py-4 font-bold text-white transition hover:bg-[#9F5313]"
            >
              <PlusCircle size={18} /> Add Product
            </button>
          </div>
        </div>

        <div className="flex flex-col md:col-span-3">
          <div className="mb-6 flex items-center rounded-[18px] border border-[#EDE8DF] bg-white px-5 py-3">
            <Search size={20} className="mr-3 text-[#C4A882]" />
            <input
              type="text"
              placeholder="Search product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm font-medium text-[#2C1A0E] outline-none"
            />
          </div>

          <div className="flex flex-col overflow-hidden rounded-[24px] border border-[#E7DAC6] bg-[#FBF7F0] sm:rounded-[32px]">
            <div className="max-h-[420px] overflow-y-auto">
              {filteredList.length === 0 && (
                <div className="py-16 text-center text-sm font-medium text-[#A88763]">
                  No products added yet
                </div>
              )}

              {filteredList.map(([name, details]) => (
                <div key={name} className="border-b border-[#F2EDE4] bg-white px-4 py-4 transition hover:bg-[#FDF6EC] sm:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="flex items-center gap-3 font-bold text-[#2C1A0E]">
                        <Milk size={16} className="text-[#B8641A]" />
                        <span className="truncate">{name}</span>
                      </span>
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                        <div>
                          <p className="font-bold uppercase tracking-[0.14em] text-[#A88763]">Type</p>
                          <p className="mt-1 text-sm font-semibold text-[#8B7355]">{details.category}</p>
                        </div>
                        <div>
                          <p className="font-bold uppercase tracking-[0.14em] text-[#A88763]">Rate</p>
                          <p className="mt-1 text-sm font-semibold text-[#8B7355]">Rs {details.rate}/{details.unit}</p>
                        </div>
                        <div>
                          <p className="font-bold uppercase tracking-[0.14em] text-[#A88763]">Stock</p>
                          <p className="mt-1 text-sm font-semibold text-[#8B7355]">{details.stock}</p>
                        </div>
                        <div>
                          <p className="font-bold uppercase tracking-[0.14em] text-[#A88763]">Pack Qty</p>
                          <p className="mt-1 text-sm font-semibold text-[#8B7355]">
                            {details.packagingQuantity || 0} {details.packagingUnit || details.unit}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => removeProduct(name)}
                      className="shrink-0 text-[#C0392B] transition hover:text-[#A33A2B]"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsAndStockStep;
