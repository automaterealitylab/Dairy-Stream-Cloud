import React from 'react';
import { CheckCircle } from 'lucide-react';

const PlanStep = ({ selected_plan, setPlan }) => {
  const plans = [
    { id: 'STARTER', price: '0', name: 'Starter' },
    { id: 'GROWTH', price: '999', name: 'Growth', popular: true },
    { id: 'ENTERPRISE', price: '2999', name: 'Enterprise' }
  ];

  return (
    <div className="p-10 animate-in fade-in slide-in-from-right-4 duration-500">
      <h2 className="text-2xl font-black mb-8 text-center">Select Your Business Plan</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div 
            key={plan.id}
            onClick={() => setPlan(plan.id)} // ✅ This updates the main state
            className={`cursor-pointer border-4 rounded-[32px] p-8 transition-all relative ${
              selected_plan === plan.id 
                ? 'border-blue-600 bg-blue-50 ring-8 ring-blue-50/50 scale-105' 
                : 'border-gray-50 bg-gray-50 hover:border-blue-200'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full">POPULAR</div>
            )}
            <h3 className="text-lg font-black uppercase mb-2">{plan.name}</h3>
            <p className="text-3xl font-black">₹{plan.price}</p>
            <div className={`mt-6 h-8 w-8 rounded-full flex items-center justify-center ${selected_plan === plan.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
              <CheckCircle size={18} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default PlanStep