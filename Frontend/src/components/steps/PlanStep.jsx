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
      monthlyPrice: 2499,
      yearlyPrice: 24990,
      features: [
        "Everything in Growth plan",
        "Procurement and supplier management",
        "Push notifications and ETA visibility",
        "Offline-ready delivery operations support",
      ],
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 px-4 py-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#B8641A]">Subscription Upgrade</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight text-[#2C1A0E] sm:text-3xl" style={headingFont}>
              Select Dairy Plan
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#7A644A]">
              Choose the plan that best fits your dairy operations.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 rounded-full border border-[#E7DAC6] bg-white p-1 shadow-[0_8px_24px_rgba(92,61,30,0.06)] sm:w-64">
          <button
            type="button"
            onClick={() => setBillingCycle("MONTHLY")}
            className={`rounded-full px-4 py-2.5 text-xs font-black tracking-[0.08em] transition ${
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
            className={`rounded-full px-4 py-2.5 text-xs font-black tracking-[0.08em] transition ${
              billingCycle === "YEARLY"
                ? "bg-[#B8641A] text-white shadow-sm"
                : "text-[#8B7355] hover:text-[#5C3D1E]"
            }`}
          >
            YEARLY
          </button>
          </div>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex min-h-full flex-col overflow-hidden rounded-[18px] border bg-white p-5 transition-all sm:p-6 ${
              selected_plan === plan.id
                ? "border-[#B8641A] shadow-[0_18px_40px_rgba(184,100,26,0.14)]"
                : "border-[#E7DAC6] shadow-[0_12px_30px_rgba(92,61,30,0.06)]"
            }`}
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${plan.popular ? "bg-[#B8641A]" : "bg-[#E7DAC6]"}`} />
            {plan.popular && (
              <div className="absolute right-4 top-4 rounded-full bg-[#FFF1E4] px-3 py-1 text-[10px] font-black tracking-[0.1em] text-[#B8641A]">
                POPULAR
              </div>
            )}

            <h3 className="pr-20 text-2xl font-semibold leading-tight text-[#2C1A0E]" style={headingFont}>
              {plan.name}
            </h3>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#B89970]">Dairy SaaS Plan</p>

            <p className="mt-5 text-3xl font-black leading-none text-[#2C1A0E]">
              Rs{" "}
              {billingCycle === "MONTHLY"
                ? plan.monthlyPrice.toLocaleString("en-IN")
                : plan.yearlyPrice.toLocaleString("en-IN")}
              <span className="ml-1 text-sm font-semibold text-[#8B7355]">/{billingCycle === "MONTHLY" ? "mo" : "yr"}</span>
            </p>
            {billingCycle === "YEARLY" && (
              <p className="mt-2 text-xs font-bold text-[#2F7D4F]">Includes two months free</p>
            )}

            <div className="mt-6 flex-1 space-y-3 border-t border-[#F1E8DC] pt-5">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-start gap-2.5 text-sm font-medium text-[#5C3D1E]">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFF6EA] text-[#B8641A]">
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
              className={`mt-7 w-full rounded-full py-3 text-sm font-black tracking-[0.08em] transition ${
                selected_plan === plan.id
                  ? "cursor-default bg-[#F1ECE4] text-[#B89970]"
                  : "bg-[#2C1A0E] text-white hover:bg-[#B8641A]"
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
