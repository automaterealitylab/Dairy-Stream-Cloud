import React from "react";
import { CreditCard, Landmark, ShieldCheck, UserCircle2 } from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const inputClassName =
  "w-full rounded-[16px] border border-[#E7DAC6] bg-white px-5 py-4 text-sm font-semibold text-[#2C1A0E] outline-none transition placeholder:text-[#B7A188] focus:border-[#B8641A] focus:ring-4 focus:ring-[#F4E1CB]";

const labelClassName =
  "mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-[#A88763]";

const sectionCardClassName =
  "space-y-4 rounded-[22px] border p-4 sm:rounded-[24px] sm:p-5";

const OwnerBankStep = ({ formData, handleChange }) => (
  <div className="custom-scrollbar animate-in fade-in slide-in-from-right-4 max-h-[calc(100vh-320px)] overflow-y-auto p-5 pb-24 pr-3 sm:max-h-[calc(100vh-340px)] sm:p-8 sm:pb-28 sm:pr-4">
    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">Ownership & Payouts</p>
    <h2 className="mb-2 mt-2 text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
      Owner & Bank Information
    </h2>
    <p className="mb-8 text-sm text-[#8B7355]">
      Add the owner account and settlement details used for admin access and payouts.
    </p>

    <div className="mb-6 rounded-[20px] border border-[#F0DFC7] bg-[linear-gradient(180deg,#FFF8EE_0%,#FFF6EA_100%)] p-4 sm:rounded-[22px] sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#B8641A] shadow-sm">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#8B4C16]">
              Quick Note
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-[#8B7355]">
              Add bank details and the Razorpay linked account id to enable direct settlement to the dairy.
            </p>
          </div>
        </div>

        <div className="grid gap-1.5 text-sm text-[#6A5137] lg:max-w-[420px]">
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 rounded-full bg-[#B8641A]" />
            <span>UPI is optional.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 rounded-full bg-[#B8641A]" />
            <span>`razorpay_linked_account_id` is required for Route transfers.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 rounded-full bg-[#B8641A]" />
            <span>Admins can update these later if needed.</span>
          </div>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-4">
      <div className={`${sectionCardClassName} border-[#E7DAC6] bg-white`}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FBF2E8] text-[#B8641A]">
            <UserCircle2 size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[#5C3D1E]">
              Owner Access
            </h3>
            <p className="mt-1 text-sm text-[#8B7355]">
              These details create the dairy admin account used to manage customers, products, and payments.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <div>
            <label className={labelClassName}>Owner Full Name</label>
            <input
              type="text"
              name="owner_name"
              value={formData.owner_name}
              onChange={handleChange}
              placeholder="Enter owner full name"
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>Admin Email</label>
            <input
              type="email"
              name="admin_email"
              value={formData.admin_email}
              onChange={handleChange}
              placeholder="owner@dairy.com"
              className={inputClassName}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className={labelClassName}>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                className={inputClassName}
              />
            </div>

            <div>
              <label className={labelClassName}>Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter password"
                className={inputClassName}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={`${sectionCardClassName} border-[#E7DAC6] bg-[#FBF7F0]`}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#B8641A] shadow-sm">
            <Landmark size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[#5C3D1E]">
              Settlement Account
            </h3>
            <p className="mt-1 text-sm text-[#8B7355]">
              This is the payout profile used for direct dairy settlement and bookkeeping.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClassName}>Account Holder Name</label>
            <input
              type="text"
              name="bank_account_holder_name"
              value={formData.bank_account_holder_name}
              onChange={handleChange}
              placeholder="Name as per bank account"
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>Account Number</label>
            <input
              type="text"
              name="bank_account_number"
              value={formData.bank_account_number}
              onChange={handleChange}
              placeholder="Enter bank account number"
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>IFSC Code</label>
            <input
              type="text"
              name="bank_ifsc_code"
              value={formData.bank_ifsc_code}
              onChange={handleChange}
              placeholder="HDFC0001234"
              className={`${inputClassName} uppercase`}
            />
          </div>

          <div>
            <label className={labelClassName}>Bank Name</label>
            <input
              type="text"
              name="bank_name"
              value={formData.bank_name}
              onChange={handleChange}
              placeholder="State Bank of India"
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>Branch</label>
            <input
              type="text"
              name="bank_branch"
              value={formData.bank_branch}
              onChange={handleChange}
              placeholder="Andheri East"
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>UPI ID</label>
            <input
              type="text"
              name="upi_id"
              value={formData.upi_id}
              onChange={handleChange}
              placeholder="dairyname@bank"
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>Razorpay Linked Account ID</label>
            <div className="relative">
              <CreditCard
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#B8641A]"
              />
              <input
                type="text"
                name="razorpay_linked_account_id"
                value={formData.razorpay_linked_account_id}
                onChange={handleChange}
                placeholder="acc_xxxxxxxxxxxxx"
                className="w-full rounded-[16px] border border-[#E7DAC6] bg-white py-4 pl-11 pr-5 text-sm font-semibold text-[#2C1A0E] outline-none transition placeholder:text-[#B7A188] focus:border-[#B8641A] focus:ring-4 focus:ring-[#F4E1CB]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default OwnerBankStep;
