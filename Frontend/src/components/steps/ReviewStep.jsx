import React from "react";
import { Phone, Mail } from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const ReviewStep = ({ formData, logoPreview }) => (
  <div className="animate-in fade-in slide-in-from-right-4 space-y-6 overflow-y-visible p-5 sm:max-h-[70vh] sm:overflow-y-auto sm:p-10">
    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">Final Review</p>
    <h2 className="text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
      Review Your Dairy Setup
    </h2>
    <p className="text-sm text-[#8B7355]">
      Double-check the brand, location, and payout details before launching the dairy account.
    </p>
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="col-span-2 flex flex-col items-start gap-4 rounded-[24px] border border-[#E7DAC6] bg-[#FBF7F0] p-5 sm:flex-row sm:items-center sm:rounded-[32px] sm:p-6">
        {logoPreview ? (
          <img
            src={logoPreview}
            className="h-20 w-20 rounded-2xl border border-[#EDE8DF] object-cover"
            alt="logo"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-[#D4B896] bg-white text-xs font-bold text-[#A88763]">
            No Logo
          </div>
        )}
        <div>
          <p className="text-xl font-black text-[#2C1A0E]">{formData.dairy_name || "Dairy Name"}</p>
          <div className="mt-1 flex flex-wrap gap-4 text-xs font-bold text-[#8B7355]">
            <span className="flex items-center gap-1">
              <Phone size={12} /> {formData.dairy_phone || "No phone added"}
            </span>
            <span className="flex items-center gap-1">
              <Mail size={12} /> {formData.dairy_email || "No email added"}
            </span>
          </div>
        </div>
      </div>
      <div className="rounded-[24px] border border-[#E7DAC6] bg-white p-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#A88763]">Location</p>
        <p className="text-sm font-bold text-[#5C3D1E]">
          {formData.address}, {formData.city}, {formData.state} - {formData.pincode}
        </p>
      </div>
      <div className="rounded-[24px] border border-[#EFD7B3] bg-[#FFF4E2] p-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B8641A]">Settlement</p>
        <p className="text-sm font-black text-[#2C1A0E]">{formData.bank_account_holder_name}</p>
        <p className="text-xs font-bold text-[#8B7355]">A/C: {formData.bank_account_number}</p>
      </div>
    </div>
  </div>
);

export default ReviewStep;
