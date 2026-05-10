import React from "react";
import { ShieldCheck, UserCircle2 } from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const inputClassName =
  "w-full rounded-[16px] border border-[#E7DAC6] bg-white px-5 py-4 text-sm font-semibold text-[#2C1A0E] outline-none transition placeholder:text-[#B7A188] focus:border-[#B8641A] focus:ring-4 focus:ring-[#F4E1CB]";

const labelClassName =
  "mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-[#A88763]";

const sectionCardClassName =
  "space-y-4 rounded-[22px] border p-4 sm:rounded-[24px] sm:p-5";

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
    </div>
  </div>
);

export default OwnerBankStep;
