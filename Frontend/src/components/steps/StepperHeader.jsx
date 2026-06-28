import React from "react";
import { Building2, MapPin, User, Milk, CreditCard, CheckCircle } from "lucide-react";

const StepperHeader = ({ currentStep, onStepClick }) => {
  const steps = [
    { id: 1, label: "Brand", icon: Building2 },
    { id: 2, label: "Location", icon: MapPin },
    { id: 3, label: "Owner", icon: User },
    { id: 4, label: "Products", icon: Milk },
    { id: 5, label: "Plan", icon: CreditCard },
    { id: 6, label: "Final", icon: CheckCircle },
  ];

  return (
    <div className="w-full max-w-5xl overflow-x-auto rounded-[20px] border border-[#E7DAC6] bg-[#FFFDF7] px-3 py-3 shadow-[0_10px_24px_rgba(84,52,16,0.04)] sm:px-5">
      <div className="relative flex min-w-[540px] justify-between sm:min-w-0">
        <div className="absolute left-0 top-1/2 -z-0 h-1 w-full -translate-y-1/2 bg-[#E7DAC6]"></div>
        {steps.map((step) => (
          <div
            key={step.id}
            onClick={() => onStepClick && onStepClick(step.id)}
            className="relative z-10 flex min-w-[72px] cursor-pointer flex-col items-center bg-[#FFFDF7] px-2 sm:min-w-0 sm:px-3 hover:opacity-80 transition-opacity"
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full border-[3px] transition-all duration-500 sm:h-10 sm:w-10 ${
                currentStep >= step.id
                  ? "border-[#F3E1CB] bg-[#B8641A] text-white"
                  : "border-[#EFE7DB] bg-white text-[#C4A882]"
              }`}
            >
              <step.icon size={15} />
            </div>
            <span
              className={`mt-1.5 text-center text-[8px] font-black uppercase tracking-[0.14em] sm:text-[9px] sm:tracking-[0.16em] ${
                currentStep >= step.id ? "text-[#B8641A]" : "text-[#C4A882]"
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StepperHeader;
