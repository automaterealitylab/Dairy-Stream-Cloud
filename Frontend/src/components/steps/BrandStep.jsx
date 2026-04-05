import React from "react";
import { Upload } from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const inputClassName =
  "w-full rounded-[16px] border border-[#EDE8DF] bg-white px-5 py-4 text-sm font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A]";

const BrandStep = ({ formData, handleChange, handleLogoChange, logoPreview }) => (
  <div className="animate-in fade-in slide-in-from-right-4 p-5 sm:p-10">
    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">Brand Setup</p>
    <h2 className="mb-2 mt-2 text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
      Brand Information
    </h2>
    <p className="mb-8 text-sm text-[#8B7355]">
      Add the public identity customers will recognize across your dairy profile.
    </p>

    <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2">
      <div className="rounded-[24px] border border-dashed border-[#E7DAC6] bg-[#FBF7F0] p-5 transition-colors hover:bg-[#FDF6EC] md:col-span-2 sm:rounded-[28px] sm:p-8">
        <div className="group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[24px] border border-[#EDE8DF] bg-white px-6 py-10 text-center">
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 z-10 cursor-pointer opacity-0"
            onChange={handleLogoChange}
          />

          {logoPreview ? (
            <img src={logoPreview} alt="Logo Preview" className="h-32 w-32 rounded-2xl object-contain" />
          ) : (
            <div className="flex flex-col items-center text-[#A88763]">
              <Upload size={40} className="mb-3 transition-colors group-hover:text-[#B8641A]" />
              <p className="text-sm font-bold text-[#5C3D1E]">Upload Dairy Logo *</p>
              <p className="mt-1 text-xs text-[#A88763]">PNG, JPG, or WebP with a clean square crop works best.</p>
            </div>
          )}
        </div>
      </div>

      <div className="md:col-span-2">
        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">
          Dairy Name *
        </label>
        <input
          type="text"
          name="dairy_name"
          value={formData.dairy_name}
          onChange={handleChange}
          className={inputClassName}
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">
          Official Phone *
        </label>
        <input
          type="tel"
          name="dairy_phone"
          value={formData.dairy_phone}
          onChange={handleChange}
          placeholder="Enter dairy phone number"
          className={inputClassName}
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">
          Official Email *
        </label>
        <input
          type="email"
          name="dairy_email"
          value={formData.dairy_email}
          onChange={handleChange}
          placeholder="Enter dairy email"
          className={inputClassName}
        />
      </div>

      <div className="md:col-span-2">
        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">
          GSTIN (Optional)
        </label>
        <input
          type="text"
          name="gstin"
          value={formData.gstin}
          onChange={handleChange}
          placeholder="22AAAAA0000A1Z5"
          className={inputClassName}
        />
      </div>
    </div>
  </div>
);

export default BrandStep;
