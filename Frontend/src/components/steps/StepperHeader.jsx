import React from 'react';
import { Building2, MapPin, User, Milk, CreditCard, CheckCircle } from 'lucide-react'; // ✅ Import Milk icon

const StepperHeader = ({ currentStep }) => {
  const steps = [
    { id: 1, label: "Brand", icon: Building2 },
    { id: 2, label: "Location", icon: MapPin },
    { id: 3, label: "Owner", icon: User },
    { id: 4, label: "Products", icon: Milk }, // ✅ NEW STEP ADDED
    { id: 5, label: "Plan", icon: CreditCard },
    { id: 6, label: "Final", icon: CheckCircle }, // Final is now step 6
  ];

  return (
    <div className="w-full max-w-5xl mb-12 px-6 flex justify-between relative">
      <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-0 -translate-y-1/2"></div>
      {steps.map((step) => (
        <div key={step.id} className="relative z-10 flex flex-col items-center bg-slate-50 px-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${
            currentStep >= step.id ? 'bg-blue-600 border-blue-100 text-white' : 'bg-white border-gray-100 text-gray-300'
          }`}>
            <step.icon size={20} />
          </div>
          <span className={`text-[10px] font-black uppercase mt-2 tracking-widest ${
            currentStep >= step.id ? 'text-blue-600' : 'text-gray-400'
          }`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default StepperHeader;