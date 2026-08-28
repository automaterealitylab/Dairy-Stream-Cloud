/* ======================================================
   SUB-COMPONENTS (Styling & Layout)
   Extracted from pages/customer/CustomerSubscription.jsx
====================================================== */

import React from 'react';
import { Store, X } from 'lucide-react';
import { headingFont } from '../../../utils/customerSubscription.js';

export const StatCard = ({ icon, label, value }) => (
  <div className="flex min-w-0 items-center gap-3 rounded-[20px] border border-[#EDE8DF] bg-[#FFFDF7] p-4 shadow-sm transition hover:shadow-md sm:gap-4 sm:rounded-[22px] sm:p-7">
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#FFF4E2] text-[#B8641A] sm:h-14 sm:w-14">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.16em] text-[#C4A882] sm:text-xs">{label}</p>
      <p className="mt-1 break-words text-base font-semibold leading-snug text-[#2C1A0E] sm:text-lg">{value}</p>
    </div>
  </div>
);

export const ExploreOtherDairiesSection = ({ onExplore }) => (
  <section className="rounded-[22px] border border-[#EFD7B3] bg-[linear-gradient(135deg,#FFF8EC_0%,#FFF1E4_100%)] p-5 sm:rounded-[24px] sm:p-6 md:p-7">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[14px] border border-[#EFD7B3] bg-white text-[#B8641A]">
          <Store size={22} />
        </div>
        <div className="min-w-0">
          <h3 className="text-[24px] font-semibold leading-tight text-[#2C1A0E] sm:text-[28px]" style={headingFont}>Explore Other Dairies</h3>
          <p className="mt-2 max-w-lg text-sm leading-6 text-[#8B7355]">
            Compare dairies, check plans, and switch to a better option anytime.
          </p>
        </div>
      </div>
      <button
        onClick={onExplore}
        className="min-h-[46px] w-full rounded-[14px] border border-[#2D231E] text-[#2D231E] bg-transparent hover:bg-stone-100 px-5 py-2 text-sm font-medium transition md:w-auto"
      >
        Browse Dairies
      </button>
    </div>
  </section>
);

export const ModalWrapper = ({ children, small }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm animate-in fade-in sm:items-center sm:p-6">
    <div
      className={`my-auto w-full max-h-[calc(100vh-1.5rem)] flex flex-col overflow-hidden animate-in zoom-in-95 border border-[#EDE8DF] bg-[#FFFDF7] shadow-2xl sm:max-h-[calc(100vh-3rem)] ${
        small ? 'max-w-md rounded-[24px] sm:rounded-[28px]' : 'max-w-2xl rounded-[24px] sm:rounded-[28px]'
      }`}
    >
      {children}
    </div>
  </div>
);

export const ModalHeader = ({ title, subtitle, onClose }) => (
  <div className="flex items-start justify-between gap-4 border-b border-[#F2EDE4] px-5 py-4 sm:px-8 sm:py-5">
    <div>
      <h3 className="text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>{title}</h3>
      <p className="mt-1 text-sm text-[#8B7355]">{subtitle}</p>
    </div>
    <button onClick={onClose} className="rounded-full p-2 transition hover:bg-[#FBF7F0]">
      <X size={22} className="text-[#A88763]" />
    </button>
  </div>
);

export const ModalFooter = ({ onCancel, onConfirm, confirmText }) => (
  <div className="flex flex-col-reverse gap-3 border-t border-[#F2EDE4] px-5 py-4 sm:flex-row sm:justify-end sm:gap-4 sm:px-8 sm:py-5">
    <button onClick={onCancel} className="rounded-[14px] border border-[#EDE8DF] px-6 py-2 transition hover:bg-[#FBF7F0]">
      Cancel
    </button>
    <button onClick={onConfirm} className="rounded-[14px] bg-[#B8641A] px-8 py-2 text-white transition hover:bg-[#9F5313]">
      {confirmText}
    </button>
  </div>
);

export const InputBlock = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-sm font-medium text-[#8B7355]">{label}</label>
    {children}
  </div>
);
