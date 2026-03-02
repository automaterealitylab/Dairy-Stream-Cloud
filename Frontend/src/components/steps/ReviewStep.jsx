import React from 'react';
import { Phone, Mail } from 'lucide-react';

const ReviewStep = ({ formData, logoPreview }) => (
  <div className="p-10 animate-in fade-in slide-in-from-right-4 space-y-6 max-h-[70vh] overflow-y-auto">
    <h2 className="text-2xl font-black">Final Review</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-gray-50 p-6 rounded-[32px] flex items-center gap-4 col-span-2 border border-gray-100">
        <img src={logoPreview} className="h-20 w-20 rounded-2xl object-cover shadow-sm border-2 border-white" alt="logo" />
        <div>
          <p className="font-black text-xl text-gray-900">{formData.dairy_name}</p>
          <div className="flex gap-4 text-xs font-bold text-gray-500 mt-1">
            <span className="flex items-center gap-1"><Phone size={12}/> {formData.dairy_phone}</span>
            <span className="flex items-center gap-1"><Mail size={12}/> {formData.dairy_email}</span>
          </div>
        </div>
      </div>
      <div className="p-6 border border-gray-100 rounded-[24px]">
        <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Location</p>
        <p className="font-bold text-sm">{formData.address}, {formData.city}, {formData.state} - {formData.pincode}</p>
      </div>
      <div className="p-6 border border-blue-100 bg-blue-50/30 rounded-[24px]">
        <p className="text-[10px] font-black uppercase text-blue-400 mb-2">Settlement</p>
        <p className="text-sm font-black">{formData.bank_account_holder_name}</p>
        <p className="text-xs font-bold text-gray-600">A/C: {formData.bank_account_number}</p>
      </div>
    </div>
  </div>
);

export default ReviewStep;