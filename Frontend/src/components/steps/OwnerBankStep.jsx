import React from 'react';
import { Landmark } from 'lucide-react';

const OwnerBankStep = ({ formData, handleChange }) => (
  <div className="p-10 animate-in fade-in slide-in-from-right-4 max-h-[60vh] overflow-y-auto custom-scrollbar">

    <h2 className="text-2xl font-black mb-8">Owner & Bank Information</h2>

    <div className="grid grid-cols-2 gap-6 mb-8">

      <input
        type="text"
        name="owner_name"
        value={formData.owner_name}
        onChange={handleChange}
        placeholder="Owner Full Name *"
        className="col-span-2 px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold"
      />

      <input
        type="email"
        name="admin_email"
        value={formData.admin_email}
        onChange={handleChange}
        placeholder="Admin Email *"
        className="px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold"
      />

      <input
        type="password"
        name="password"
        value={formData.password}
        onChange={handleChange}
        placeholder="Password *"
        className="px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold"
      />

      <input
        type="password"
        name="confirmPassword"
        value={formData.confirmPassword}
        onChange={handleChange}
        placeholder="Confirm Password *"
        className="col-span-2 px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold"
      />

    </div>

    <div className="p-8 bg-slate-50 rounded-[32px] border border-gray-100 space-y-6">

      <h3 className="font-black text-xs uppercase text-blue-600 tracking-widest flex items-center gap-2">
        <Landmark size={18}/> Settlement Account
      </h3>

      <input
        type="text"
        name="bank_account_holder_name"
        value={formData.bank_account_holder_name}
        onChange={handleChange}
        placeholder="Account Holder Name *"
        className="w-full p-4 bg-white rounded-xl font-bold shadow-sm"
      />

      <div className="grid grid-cols-2 gap-4">

        <input
          type="text"
          name="bank_account_number"
          value={formData.bank_account_number}
          onChange={handleChange}
          placeholder="Account Number *"
          className="p-4 bg-white rounded-xl font-bold shadow-sm"
        />

        <input
          type="text"
          name="bank_ifsc_code"
          value={formData.bank_ifsc_code}
          onChange={handleChange}
          placeholder="IFSC Code *"
          className="p-4 bg-white rounded-xl font-bold shadow-sm uppercase"
        />

      </div>

      <div className="grid grid-cols-2 gap-4">

        <input
          type="text"
          name="bank_name"
          value={formData.bank_name}
          onChange={handleChange}
          placeholder="Bank Name *"
          className="p-4 bg-white rounded-xl font-bold shadow-sm"
        />

        <input
          type="text"
          name="bank_branch"
          value={formData.bank_branch}
          onChange={handleChange}
          placeholder="Branch *"
          className="p-4 bg-white rounded-xl font-bold shadow-sm"
        />

      </div>

      {/* UPI ID OPTIONAL */}
      <input
        type="text"
        name="upi_id"
        value={formData.upi_id}
        onChange={handleChange}
        placeholder="UPI ID (Optional)"
        className="w-full p-4 bg-white rounded-xl font-bold shadow-sm"
      />

    </div>

  </div>
);

export default OwnerBankStep;