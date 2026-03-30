import React from "react";
import { Landmark } from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const inputClassName =
  "w-full rounded-[16px] border border-[#EDE8DF] bg-white px-5 py-4 text-sm font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A]";

const OwnerBankStep = ({ formData, handleChange }) => (
  <div className="custom-scrollbar animate-in fade-in slide-in-from-right-4 overflow-y-visible p-5 sm:max-h-[60vh] sm:overflow-y-auto sm:p-10">
    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">Ownership & Payouts</p>
    <h2 className="mb-2 mt-2 text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
      Owner & Bank Information
    </h2>
    <p className="mb-8 text-sm text-[#8B7355]">
      Add the owner account and settlement details used for admin access and payouts.
    </p>

    <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
      <input
        type="text"
        name="owner_name"
        value={formData.owner_name}
        onChange={handleChange}
        placeholder="Owner Full Name *"
        className={`md:col-span-2 ${inputClassName}`}
      />

      <input
        type="email"
        name="admin_email"
        value={formData.admin_email}
        onChange={handleChange}
        placeholder="Admin Email *"
        className={inputClassName}
      />

      <input
        type="password"
        name="password"
        value={formData.password}
        onChange={handleChange}
        placeholder="Password *"
        className={inputClassName}
      />

      <input
        type="password"
        name="confirmPassword"
        value={formData.confirmPassword}
        onChange={handleChange}
        placeholder="Confirm Password *"
        className={`md:col-span-2 ${inputClassName}`}
      />
    </div>

    <div className="space-y-6 rounded-[24px] border border-[#E7DAC6] bg-[#FBF7F0] p-5 sm:rounded-[28px] sm:p-8">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#B8641A]">
        <Landmark size={18} />
        Settlement Account
      </h3>

      <input
        type="text"
        name="bank_account_holder_name"
        value={formData.bank_account_holder_name}
        onChange={handleChange}
        placeholder="Account Holder Name *"
        className={inputClassName}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <input
          type="text"
          name="bank_account_number"
          value={formData.bank_account_number}
          onChange={handleChange}
          placeholder="Account Number *"
          className={inputClassName}
        />

        <input
          type="text"
          name="bank_ifsc_code"
          value={formData.bank_ifsc_code}
          onChange={handleChange}
          placeholder="IFSC Code *"
          className={`${inputClassName} uppercase`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <input
          type="text"
          name="bank_name"
          value={formData.bank_name}
          onChange={handleChange}
          placeholder="Bank Name *"
          className={inputClassName}
        />

        <input
          type="text"
          name="bank_branch"
          value={formData.bank_branch}
          onChange={handleChange}
          placeholder="Branch *"
          className={inputClassName}
        />
      </div>

      <input
        type="text"
        name="upi_id"
        value={formData.upi_id}
        onChange={handleChange}
        placeholder="UPI ID (Optional)"
        className={inputClassName}
      />
    </div>
  </div>
);

export default OwnerBankStep;
