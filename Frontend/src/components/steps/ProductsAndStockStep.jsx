import React, { useState } from "react";
import toast from "react-hot-toast";
import { Milk, Trash2, Search, PlusCircle } from "lucide-react";

const ProductsAndStockStep = ({ formData, setFormData }) => {

const [newProduct,setNewProduct]=useState({
name:"",
category:"Milk",
unit:"Liter",
rate:"",
stock:"",
isActive:true
});

const [searchTerm,setSearchTerm]=useState("");

const handleAddProduct=()=>{

if(!newProduct.name||!newProduct.rate||!newProduct.stock){
toast.error("Please fill Name, Rate and Stock");
return;
}

setFormData(prev=>({
...prev,
products:{
...prev.products,
[newProduct.name]:{
category:newProduct.category,
unit:newProduct.unit,
rate:parseInt(newProduct.rate),
stock:parseFloat(newProduct.stock),
status:newProduct.isActive?"Active":"Inactive"
}
}
}));

toast.success("Product added");

setNewProduct({
name:"",
category:"Milk",
unit:"Liter",
rate:"",
stock:"",
isActive:true
});

};

const removeProduct=(name)=>{

setFormData(prev=>{
const updated={...prev.products};
delete updated[name];
return {...prev,products:updated};
});

};

const productList=Object.entries(formData.products||{});

const filteredList=productList.filter(([name])=>
name.toLowerCase().includes(searchTerm.toLowerCase())
);

return(

<div className="p-10 animate-in fade-in slide-in-from-right-4 duration-500">

<div className="grid grid-cols-1 md:grid-cols-3 gap-8">

{/* LEFT PANEL */}

<div className="md:col-span-1 sticky top-10 self-start">

<div className="p-8 bg-white rounded-[32px] border border-gray-100 shadow-sm space-y-6">

<h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
<Milk size={20}/> Add Product
</h3>

<input
type="text"
placeholder="Product name (Milk, Dahi, Paneer)"
value={newProduct.name}
onChange={e=>setNewProduct({...newProduct,name:e.target.value})}
className="w-full p-4 bg-gray-50 rounded-xl font-medium"
/>

<div className="grid grid-cols-2 gap-4">

<select
value={newProduct.category}
onChange={e=>setNewProduct({...newProduct,category:e.target.value})}
className="w-full p-4 bg-gray-50 rounded-xl font-medium"
>
<option>Milk</option>
<option>Dahi</option>
<option>Paneer</option>
<option>Butter</option>
<option>Ghee</option>
</select>

<select
value={newProduct.unit}
onChange={e=>setNewProduct({...newProduct,unit:e.target.value})}
className="w-full p-4 bg-gray-50 rounded-xl font-medium"
>
<option>Liter</option>
<option>Kg</option>
<option>Packet</option>
<option>Piece</option>
</select>

</div>

<div className="grid grid-cols-2 gap-4">

<input
type="number"
placeholder="Rate (₹)"
value={newProduct.rate}
onChange={e=>setNewProduct({...newProduct,rate:e.target.value})}
className="w-full p-4 bg-gray-50 rounded-xl font-medium"
/>

<input
type="number"
placeholder="Stock"
value={newProduct.stock}
onChange={e=>setNewProduct({...newProduct,stock:e.target.value})}
className="w-full p-4 bg-gray-50 rounded-xl font-medium"
/>

</div>

<label className="flex items-center gap-2 text-sm font-medium text-gray-600">

<input
type="checkbox"
checked={newProduct.isActive}
onChange={e=>setNewProduct({...newProduct,isActive:e.target.checked})}
className="rounded text-blue-600 focus:ring-blue-500"
/>

Active product

</label>

<button
onClick={handleAddProduct}
className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
>

<PlusCircle size={18}/> Add Product

</button>

</div>

</div>

{/* RIGHT PANEL */}

<div className="md:col-span-2 flex flex-col">

{/* SEARCH */}

<div className="flex items-center bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3 mb-6">

<Search size={20} className="text-gray-400 mr-3"/>

<input
type="text"
placeholder="Search product..."
value={searchTerm}
onChange={e=>setSearchTerm(e.target.value)}
className="w-full bg-transparent outline-none font-medium"
/>

</div>

{/* PRODUCT LIST */}

<div className="bg-gray-50 rounded-[32px] border border-gray-100 flex flex-col">

{/* HEADER */}

<div className="grid grid-cols-6 text-xs font-black uppercase text-gray-400 tracking-widest px-6 py-4 border-b border-gray-100">

<span className="col-span-2">Product</span>
<span>Type</span>
<span>Rate</span>
<span>Stock</span>
<span>Action</span>

</div>

{/* LIST BODY */}

<div className="max-h-[420px] overflow-y-auto">

{filteredList.length===0&&(

<div className="text-center text-gray-400 font-medium py-16">
No products added yet
</div>

)}

{filteredList.map(([name,details])=>(

<div
key={name}
className="grid grid-cols-6 items-center px-6 py-4 border-b border-gray-100 bg-white hover:bg-gray-50 transition"
>

<span className="col-span-2 font-bold text-gray-800 flex items-center gap-3">

<Milk size={16} className="text-blue-500"/>

{name}

</span>

<span className="font-semibold text-gray-600 text-sm">
{details.category}
</span>

<span className="font-semibold text-gray-600 text-sm">
₹{details.rate}/{details.unit}
</span>

<span className="font-semibold text-gray-600 text-sm">
{details.stock}
</span>

<button
onClick={()=>removeProduct(name)}
className="text-red-400 hover:text-red-600 transition"
>

<Trash2 size={18}/>

</button>

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