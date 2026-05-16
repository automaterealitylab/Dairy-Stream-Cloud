import React, { useState } from "react";
import { Check } from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const PlanStep = ({ selected_plan, setPlan }) => {
  const [billingCycle, setBillingCycle] = useState("MONTHLY");

  const plans = [
    {
      id: "STARTER",
      name: "Starter",
      monthlyPrice: 499,
      yearlyPrice: 4990,
      features: [
        "Basic customer and product management",
        "Manual delivery scheduling",
        "Limited payment tracking dashboard",
        "Single dairy admin access",
      ],
    },
    {
      id: "GROWTH",
      name: "Growth",
      monthlyPrice: 999,
      yearlyPrice: 9990,
      popular: true,
      features: [
        "Customer, agent, and subscription management",
        "Delivery approvals and route assignment",
        "UPI payment tracking and verification queue",
        "Performance dashboard with delivery analytics",
      ],
    },
    {
      id: "ENTERPRISE",
      name: "Enterprise",
      monthlyPrice: 1499,
      yearlyPrice: 14990,
      features: [
        "Everything in Growth plan",
        "Procurement and supplier management",
        "Push notifications and ETA visibility",
        "Offline-ready delivery operations support",
      ],
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-5 sm:p-10">
      <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-[#C4A882]">Subscription Upgrade</p>
      <h2 className="mb-2 mt-2 text-center text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
        Select Dairy Plan
      </h2>
      <p className="mb-8 text-center text-sm text-[#8B7355]">
        Choose the plan that best fits your dairy operations.
      </p>

      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-[14px] border border-[#E7DAC6] bg-[#F6F1E7] p-1">
          <button
            type="button"
            onClick={() => setBillingCycle("MONTHLY")}
            className={`rounded-[10px] px-5 py-2 text-xs font-black tracking-[0.14em] transition ${
              billingCycle === "MONTHLY"
                ? "bg-[#B8641A] text-white shadow-sm"
                : "text-[#8B7355] hover:text-[#5C3D1E]"
            }`}
          >
            MONTHLY
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("YEARLY")}
            className={`rounded-[10px] px-5 py-2 text-xs font-black tracking-[0.14em] transition ${
              billingCycle === "YEARLY"
                ? "bg-[#B8641A] text-white shadow-sm"
                : "text-[#8B7355] hover:text-[#5C3D1E]"
            }`}
          >
            YEARLY
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-[24px] border bg-white p-5 transition-all sm:rounded-[32px] sm:p-6 ${
              selected_plan === plan.id
                ? "border-[#D7BB8E] shadow-[0_16px_28px_rgba(84,52,16,0.08)]"
                : "border-[#E7DAC6]"
            }`}
          >
            {plan.popular && (
              <div className="absolute right-5 top-5 rounded-full bg-[#F8EBD8] px-3 py-1 text-[10px] font-black tracking-[0.12em] text-[#B8641A]">
                POPULAR
              </div>
            )}

            <h3 className="text-[38px] font-semibold leading-none text-[#2C1A0E]" style={headingFont}>
              {plan.name}
            </h3>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#C4A882]">Dairy SaaS Plan</p>

            <p className="mt-5 text-4xl font-black text-[#2C1A0E]">
              Rs{" "}
              {billingCycle === "MONTHLY"
                ? plan.monthlyPrice.toLocaleString("en-IN")
                : plan.yearlyPrice.toLocaleString("en-IN")}
              <span className="text-lg font-semibold text-[#8B7355]">/{billingCycle === "MONTHLY" ? "mo" : "yr"}</span>
            </p>

            <div className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-start gap-2 text-sm text-[#5C3D1E]">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#D7BB8E] bg-[#FFF6EA] text-[#B8641A]">
                    <Check size={12} />
                  </span>
                  <span className="leading-5">{feature}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPlan(plan.id)}
              disabled={selected_plan === plan.id}
              className={`mt-8 w-full rounded-[14px] py-3 text-sm font-black tracking-[0.12em] transition ${
                selected_plan === plan.id
                  ? "cursor-default bg-[#EEE9E0] text-[#B8AA95]"
                  : "bg-[#B8641A] text-white hover:bg-[#9F5313]"
              }`}
            >
              {selected_plan === plan.id ? "CURRENT" : "SELECT"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlanStep;
