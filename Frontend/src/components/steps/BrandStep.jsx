import React from 'react';
import { Upload } from 'lucide-react';

const BrandStep = ({ formData, handleChange, handleLogoChange, logoPreview }) => (
  <div className="p-10 animate-in fade-in slide-in-from-right-4">
    <h2 className="text-2xl font-black mb-8">Brand Information</h2>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

      {/* LOGO UPLOAD */}
      <div className="col-span-2 flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-[32px] hover:bg-gray-50 transition-colors cursor-pointer relative overflow-hidden group">
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
          onChange={handleLogoChange}
        />

        {logoPreview ? (
          <img src={logoPreview} alt="Logo Preview" className="h-32 w-32 object-contain rounded-xl" />
        ) : (
          <div className="flex flex-col items-center text-gray-400">
            <Upload size={40} className="mb-2 group-hover:text-blue-500 transition-colors" />
            <p className="text-sm font-bold">Upload Dairy Logo *</p>
          </div>
        )}
      </div>

      {/* DAIRY NAME */}
      <div className="col-span-2">
        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
          Dairy Name *
        </label>
        <input
          type="text"
          name="dairy_name"
          value={formData.dairy_name}
          onChange={handleChange}
          className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
        />
      </div>

      {/* PHONE */}
      <input
        type="tel"
        name="dairy_phone"
        value={formData.dairy_phone}
        onChange={handleChange}
        placeholder="Official Phone *"
        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
      />

      {/* EMAIL */}
      <input
        type="email"
        name="dairy_email"
        value={formData.dairy_email}
        onChange={handleChange}
        placeholder="Official Email *"
        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
      />

      {/* GSTIN (OPTIONAL) */}
      <div className="col-span-2">
        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
          GSTIN (Optional)
        </label>

        <input
          type="text"
          name="gstin"
          value={formData.gstin}
          onChange={handleChange}
          placeholder="22AAAAA0000A1Z5"
          className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
        />
      </div>

    </div>
  </div>
);

export default BrandStep;