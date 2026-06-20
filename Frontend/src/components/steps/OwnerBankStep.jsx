import React from "react";
import { CreditCard, Landmark, QrCode, ReceiptText, ShieldCheck, UserCircle2 } from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const inputClassName =
  "w-full rounded-[16px] border border-[#E7DAC6] bg-white px-5 py-4 text-sm font-semibold text-[#2C1A0E] outline-none transition placeholder:text-[#B7A188] focus:border-[#B8641A] focus:ring-4 focus:ring-[#F4E1CB]";

const labelClassName =
  "mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-[#A88763]";

const sectionCardClassName =
  "space-y-4 rounded-[22px] border p-4 sm:rounded-[24px] sm:p-5";

const paymentOptions = [
  {
    key: "one_time",
    title: "One-Time Orders",
    description: "Extra products and single delivery orders placed by customers.",
    Icon: ReceiptText,
    methodName: "one_time_payment_method",
  },
  {
    key: "subscription",
    title: "Monthly Subscription",
    description: "Recurring customer milk bills and monthly subscription dues.",
    Icon: CreditCard,
    methodName: "subscription_payment_method",
  },
];

const PaymentMethodRadio = ({ name, value, checked, onChange, title, description, icon }) => (
  <label
    className={`flex cursor-pointer items-start gap-3 rounded-[18px] border px-4 py-3 transition ${
      checked
        ? "border-[#B8641A] bg-[#FFF4E2] shadow-sm"
        : "border-[#E7DAC6] bg-white hover:border-[#D4B896]"
    }`}
  >
    <input
      type="radio"
      name={name}
      value={value}
      checked={Boolean(checked)}
      onChange={onChange}
      className="mt-1 h-4 w-4 accent-[#B8641A]"
    />
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
        checked ? "bg-white text-[#B8641A]" : "bg-[#FBF7F0] text-[#8B7355]"
      }`}>
        {React.createElement(icon, { size: 17 })}
      </div>
      <div>
        <p className="text-sm font-black text-[#2C1A0E]">{title}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-[#8B7355]">{description}</p>
      </div>
    </div>
  </label>
);

const OwnerBankStep = ({ formData, handleChange }) => (
  <div className="animate-in fade-in slide-in-from-right-4 p-5 sm:p-8">
    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">Ownership</p>
    <h2 className="mb-2 mt-2 text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
      Owner Information
    </h2>
    <p className="mb-6 text-sm text-[#8B7355]">
      Create the dairy admin account first. Payment setup can be completed after registration.
    </p>

    <div className="mb-6 rounded-[20px] border border-[#F0DFC7] bg-[linear-gradient(180deg,#FFF8EE_0%,#FFF6EA_100%)] p-4 sm:rounded-[22px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3 lg:max-w-xl">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#B8641A] shadow-sm">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#8B4C16]">
              Before You Continue
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-[#8B7355]">
              These login details let the dairy owner manage customers, products, deliveries, and billing.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#6A5137]">
          <span className="rounded-full bg-white px-3 py-1.5">Payment setup after launch</span>
          <span className="rounded-full bg-white px-3 py-1.5">Razorpay guide included</span>
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
              These details create the dairy admin account.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
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

      <div className={`${sectionCardClassName} border-[#E7DAC6] bg-white`}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FBF2E8] text-[#B8641A]">
            <QrCode size={19} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[#5C3D1E]">
              Customer Payment Acceptance
            </h3>
            <p className="mt-1 text-sm text-[#8B7355]">
              Choose how customers can pay for one-time orders and monthly subscription bills.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {paymentOptions.map(({ key, title, description, Icon: purposeIcon, methodName }) => (
            <div key={key} className="rounded-[20px] border border-[#E7DAC6] bg-[#FBF7F0] p-4">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-[#B8641A]">
                  {React.createElement(purposeIcon, { size: 17 })}
                </div>
                <div>
                  <p className="text-sm font-black text-[#2C1A0E]">{title}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#8B7355]">{description}</p>
                </div>
              </div>

              <div className="grid gap-3">
                <PaymentMethodRadio
                  name={methodName}
                  value="DIRECT_UPI"
                  checked={formData[methodName] === "DIRECT_UPI"}
                  onChange={handleChange}
                  title="Direct UPI QR"
                  description="Customer pays to your UPI QR and must share a screenshot or payment reference id."
                  icon={QrCode}
                />
                <PaymentMethodRadio
                  name={methodName}
                  value="RAZORPAY"
                  checked={formData[methodName] === "RAZORPAY"}
                  onChange={handleChange}
                  title="Razorpay Checkout"
                  description="Gateway payment with 2% Razorpay charge plus 18% GST on that charge."
                  icon={CreditCard}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 rounded-[18px] border border-dashed border-[#DDBF95] bg-[#FFF8EE] px-4 py-3 text-xs font-semibold leading-5 text-[#7B6247] sm:grid-cols-2">
          <span>Direct UPI proof rule: screenshot or payment reference id is required.</span>
          <span>Razorpay fee rule: 2% platform charge + 18% GST on that charge.</span>
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
