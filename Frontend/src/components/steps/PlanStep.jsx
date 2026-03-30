import React from "react";
import { CheckCircle } from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const PlanStep = ({ selected_plan, setPlan }) => {
  const plans = [
    { id: "STARTER", price: "0", name: "Starter" },
    { id: "GROWTH", price: "999", name: "Growth", popular: true },
    { id: "ENTERPRISE", price: "2999", name: "Enterprise" },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-5 sm:p-10">
      <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">Subscription Plan</p>
      <h2 className="mb-2 mt-2 text-center text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
        Select Your Business Plan
      </h2>
      <p className="mb-8 text-center text-sm text-[#8B7355]">
        Choose the operating plan that best fits the size and growth stage of your dairy.
      </p>
      <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => setPlan(plan.id)}
            className={`relative cursor-pointer rounded-[24px] border p-5 transition-all sm:rounded-[32px] sm:p-8 ${
              selected_plan === plan.id
                ? "border-[#B8641A] bg-[#FFF4E2] shadow-[0_16px_30px_rgba(184,100,26,0.12)]"
                : "border-[#E7DAC6] bg-[#FBF7F0] hover:border-[#D4B896] hover:bg-[#FDF6EC]"
            }`}
          >
            {plan.popular && (
              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#B8641A] px-3 py-1 text-[10px] font-black text-white">
                POPULAR
              </div>
            )}
            <h3 className="mb-2 text-lg font-black uppercase text-[#2C1A0E]">{plan.name}</h3>
            <p className="text-3xl font-black text-[#B8641A]">Rs {plan.price}</p>
            <div
              className={`mt-6 flex h-8 w-8 items-center justify-center rounded-full ${
                selected_plan === plan.id ? "bg-[#B8641A] text-white" : "bg-[#EDE8DF] text-[#C4A882]"
              }`}
            >
              <CheckCircle size={18} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlanStep;
