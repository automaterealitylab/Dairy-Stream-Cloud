import React from "react";
import { Phone, Mail, Landmark, QrCode, ShieldCheck } from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const formatPaymentMethod = (value) =>
  value === "RAZORPAY" ? "Razorpay Checkout" : "Direct UPI QR";

const ReviewStep = ({ formData, logoPreview }) => (
  <div className="animate-in fade-in slide-in-from-right-4 space-y-6 overflow-y-visible p-5 sm:max-h-[70vh] sm:overflow-y-auto sm:p-10">
    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">Final Review</p>
    <h2 className="text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
      Review Your Dairy Setup
    </h2>
    <p className="text-sm text-[#8B7355]">
      Double-check the brand, location, owner access, products, and plan before launching the dairy account.
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
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B8641A]">
          <ShieldCheck size={14} />
          Owner Access
        </p>
        <p className="text-sm font-black text-[#2C1A0E]">{formData.owner_name || "Owner name"}</p>
        <p className="mt-1 text-xs font-bold text-[#8B7355]">{formData.admin_email || "Admin email"}</p>
        <p className="text-xs font-bold text-[#5C3D1E]">
          {formData.razorpay_linked_account_id || "Not added yet"}
        </p>
      </div>
      <div className="rounded-[24px] border border-[#E7DAC6] bg-white p-6 md:col-span-2">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B8641A]">
          <QrCode size={14} />
          Customer Payment Options
        </p>
        <div className="grid gap-3 text-sm font-bold text-[#5C3D1E] sm:grid-cols-2">
          <div className="rounded-[18px] border border-[#EDE8DF] bg-[#FBF7F0] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#A88763]">One-Time Orders</p>
            <p className="mt-1">{formatPaymentMethod(formData.one_time_payment_method)}</p>
          </div>
          <div className="rounded-[18px] border border-[#EDE8DF] bg-[#FBF7F0] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#A88763]">Monthly Subscription</p>
            <p className="mt-1">{formatPaymentMethod(formData.subscription_payment_method)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs font-semibold leading-5 text-[#8B7355]">
          Direct UPI requires a screenshot or payment reference id. Razorpay uses a 2% charge plus 18% GST on that charge.
        </p>
      </div>
    </div>
  </div>
);

export default ReviewStep;
