import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CustomerLayout from '../../components/customer/layouts/CustomerLayout';
import { ArrowLeft, Phone, User, MapPin, ShieldCheck, MessageSquare } from 'lucide-react';

const TrackAgent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // 🛠️ MOCK DATA FOR TESTING
  const mockDelivery = {
    quantity: "2",
    product: "Full Cream Milk",
    startDate: "2026-02-21",
    agent: {
      name: "Rajesh Kumar",
      phone: "9876543210"
    }
  };
  const { delivery } = location.state || {delivery: mockDelivery};
  const agent = delivery?.agent;

  if (!delivery || !agent) {
    return (
      <CustomerLayout>
        <div className="p-8 text-center">
          <p>No active tracking information found.</p>
          <button onClick={() => navigate(-1)} className="text-blue-600 mt-4 underline">Go Back</button>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Track Delivery</h2>
        </div>

        {/* Status Card */}
        <div className="bg-blue-600 rounded-[32px] p-8 text-white shadow-xl shadow-blue-100">
          <p className="text-blue-100 text-sm font-medium uppercase tracking-wider">Estimated Delivery</p>
          <h3 className="text-3xl font-black mt-1">Coming Today</h3>
          <div className="mt-6 flex items-center gap-2 text-blue-100">
            <MapPin size={18} />
            <p className="text-sm">Agent is currently out for delivery</p>
          </div>
        </div>

        {/* Agent Profile Card */}
        <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm space-y-8">
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
              <User size={40} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xl font-bold text-gray-900">{agent.name}</h4>
                <ShieldCheck size={18} className="text-blue-500" />
              </div>
              <p className="text-gray-500">Authorized Delivery Partner</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Call Button */}
            <a
              href={`tel:${agent.phone}`}
              className="flex items-center justify-center gap-3 bg-green-600 text-white py-4 rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-100"
            >
              <Phone size={20} />
              Call Agent
            </a>
            
            {/* WhatsApp/Message Mockup */}
            <button className="flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-lg shadow-gray-100">
              <MessageSquare size={20} />
              Message
            </button>
          </div>
        </div>

        {/* Delivery Summary */}
        <div className="bg-gray-50 rounded-[32px] p-8 space-y-4">
          <h5 className="font-bold text-gray-900 uppercase text-xs tracking-widest">Order Details</h5>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Product</span>
            <span className="font-bold">{delivery.quantity} {delivery.product}</span>
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