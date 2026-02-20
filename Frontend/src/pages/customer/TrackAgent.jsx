import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CustomerLayout from '../../components/customer/layouts/CustomerLayout';
import { ArrowLeft, Phone, User, MapPin, ShieldCheck, MessageSquare, CheckCircle2 } from 'lucide-react';

const TrackAgent = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // MOCK DATA: For testing purposes when backend is empty
  const mockDelivery = {
    quantity: "1",
    product: "Full Cream Milk",
    status: "OUT_FOR_DELIVERY", // Options: PENDING, OUT_FOR_DELIVERY, DELIVERED
    agent: { name: "Rajesh Kumar", phone: "9876543210" }
  };

  // Safe data extraction
  const { delivery } = location.state || { delivery: mockDelivery };
  // Added optional chaining to prevent crash if delivery is null
  const agent = delivery?.agent;

  // Progress Bar Configuration
  const steps = [
    { label: 'Order Placed', status: 'PENDING' },
    { label: 'Out for Delivery', status: 'OUT_FOR_DELIVERY' },
    { label: 'Delivered', status: 'DELIVERED' }
  ];

  // Logic to determine current step index - Added safety check for delivery
  const currentStepIndex = delivery ? steps.findIndex(s => s.status === delivery.status) : 0;

  // 1. CRITICAL FIX: If data is missing and mock failed, show a simple message instead of crashing
  if (!delivery || !agent) {
    return (
      <CustomerLayout>
        <div className="p-8 text-center">
          <p className="text-gray-500 font-bold">No active delivery tracking data available.</p>
          <button onClick={() => navigate(-1)} className="text-blue-600 mt-4 underline">Go Back</button>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto space-y-6 pb-10">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Track Order</h2>
        </div>

        {/* 🚀 Delivery Progress Bar (The Stepper) */}
        <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm">
          <div className="relative flex justify-between items-center">
            {/* Background Line */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 z-0"></div>
            {/* Active Progress Line */}
            <div 
              className="absolute top-1/2 left-0 h-1 bg-blue-600 -translate-y-1/2 transition-all duration-700 z-0"
              style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
            ></div>

            {steps.map((step, index) => {
              const isActive = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div key={step.label} className="relative z-10 flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCurrent ? 'bg-blue-600 ring-4 ring-blue-100 text-white' : 
                    isActive ? 'bg-blue-600 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'
                  }`}>
                    {isActive ? <CheckCircle2 size={20} /> : <div className="w-2 h-2 rounded-full bg-gray-300"></div>}
                  </div>
                  <span className={`absolute -bottom-7 text-[10px] font-black uppercase tracking-tighter whitespace-nowrap ${
                    isActive ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Agent Profile Card */}
        <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm space-y-8 mt-10">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 overflow-hidden">
                <User size={40} />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-green-500 h-5 w-5 rounded-full border-4 border-white animate-pulse"></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                {/* 2. FIX: Added optional chaining to agent property */}
                <h4 className="text-xl font-bold text-gray-900">{agent?.name}</h4>
                <ShieldCheck size={18} className="text-blue-500" />
              </div>
              <p className="text-gray-500 text-sm">On his way to your address</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <a
              href={`tel:${agent?.phone}`}
              className="flex items-center justify-center gap-3 bg-green-600 text-white py-4 rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-100"
            >
              <Phone size={20} /> Call Agent
            </a>
            <button className="flex items-center justify-center gap-3 bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all">
              <MessageSquare size={20} /> Message
            </button>
          </div>
        </div>
  

        {/* Delivery Summary */}
        <div className="bg-gray-50 rounded-[32px] p-8 space-y-4">
          <h5 className="font-bold text-gray-900 uppercase text-xs tracking-widest">Order Details</h5>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Product</span>
            {/* 3. FIX: Added optional chaining to delivery properties */}
            <span className="font-bold">{delivery?.quantity} {delivery?.product}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Delivery Address</span>
            <span className="font-bold text-right text-sm">Stored in Profile</span>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default TrackAgent;