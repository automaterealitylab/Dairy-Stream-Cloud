import React from 'react';
import CustomerLayout from '../../layouts/CustomerLayout';
import { 
  CheckCircle, AlertCircle, Calendar, Plus, 
  PauseCircle, Banknote, ChevronRight, Droplets 
} from 'lucide-react';

// --- MOCK DASHBOARD DATA ---
const DASHBOARD_DATA = {
  todayStatus: 'DELIVERED', // 'PENDING' | 'DELIVERED' | 'NOT_DELIVERED'
  deliveryTime: '07:15 AM',
  products: [{ name: 'Buffalo Milk', qty: '1.5 L' }],
  nextDelivery: 'Tomorrow, Morning',
  walletBalance: 450,
  monthlyBill: 1200
};

const CustomerDashboard = () => {
  // --- BACKEND INTEGRATION NOTE ---
  // useEffect(() => {
  //   fetch('/api/customer/dashboard', { headers: { Authorization: token } })
  //     .then(res => res.json())
  //     .then(data => setDashboardData(data));
  // }, []);

  return (
    <CustomerLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        
        {/* --- WELCOME HEADER --- */}
        <div className="flex justify-between items-center">
           <div>
              <h2 className="text-2xl font-bold text-gray-900">Good Morning, Rahul!</h2>
              <div className="flex items-center gap-2 mt-1">
                 <span className="text-sm text-gray-500">Member of</span>
                 <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                    Nandanvan Farms
                 </span>
              </div>
           </div>
           <button className="text-sm text-blue-600 font-semibold hover:underline">Switch</button>
        </div>

        {/* --- WIDGET 1: TODAY'S STATUS --- */}
        <div className={`p-6 rounded-2xl border ${
           DASHBOARD_DATA.todayStatus === 'DELIVERED' 
             ? 'bg-green-50 border-green-200' 
             : 'bg-yellow-50 border-yellow-200'
        }`}>
           <div className="flex items-start justify-between">
              <div className="flex gap-4">
                 <div className={`p-3 rounded-full ${
                    DASHBOARD_DATA.todayStatus === 'DELIVERED' ? 'bg-green-200 text-green-700' : 'bg-yellow-200 text-yellow-700'
                 }`}>
                    {DASHBOARD_DATA.todayStatus === 'DELIVERED' ? <CheckCircle size={24}/> : <AlertCircle size={24}/>}
                 </div>
                 <div>
                    <h3 className="text-lg font-bold text-gray-900">
                       {DASHBOARD_DATA.todayStatus === 'DELIVERED' ? 'Delivered Successfully' : 'Delivery Pending'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                       {DASHBOARD_DATA.products[0].qty} • {DASHBOARD_DATA.products[0].name}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                       {DASHBOARD_DATA.todayStatus === 'DELIVERED' && `Dropped at Doorstep • ${DASHBOARD_DATA.deliveryTime}`}
                    </p>
                 </div>
              </div>
              <button className="text-xs font-semibold text-gray-500 underline">Report Issue</button>
           </div>
        </div>

        {/* --- WIDGET 2: QUICK ACTIONS --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <QuickActionCard icon={Plus} label="Add Extra" color="blue" />
           <QuickActionCard icon={PauseCircle} label="Pause" color="orange" />
           <QuickActionCard icon={Calendar} label="Calendar" color="purple" />
           <QuickActionCard icon={Banknote} label="Pay Bill" color="green" />
        </div>

        {/* --- WIDGET 3: NEXT DELIVERY & BILLING --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Tomorrow</h3>
              <div className="flex items-center gap-4">
                 <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                    <Droplets size={24} />
                 </div>
                 <div className="flex-1">
                    <h4 className="font-bold text-gray-900">1.5 Liters Milk</h4>
                    <p className="text-sm text-gray-500">Morning Slot (6:00 - 8:00 AM)</p>
                 </div>
                 <button className="text-sm font-bold text-blue-600 border border-blue-200 px-3 py-1 rounded-lg">Edit</button>
              </div>
           </div>

           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                 <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Billing Summary</h3>
                 <div className="flex justify-between items-end">
                    <div>
                       <p className="text-3xl font-bold text-gray-900">₹{DASHBOARD_DATA.monthlyBill}</p>
                       <p className="text-xs text-red-500 font-medium mt-1">Due in 5 days</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Wallet Balance</p>
                        <p className="font-semibold text-gray-700">₹{DASHBOARD_DATA.walletBalance}</p>
                    </div>
                 </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-50 rounded-lg p-2 -mx-2 transition">
                 <span className="text-sm font-medium text-blue-600">View Full Invoice</span>
                 <ChevronRight size={16} className="text-blue-400"/>
              </div>
           </div>

        </div>
      </div>
    </CustomerLayout>
  );
};

// --- SUB-COMPONENT: ACTION CARD ---
const QuickActionCard = ({ icon: Icon, label, color }) => {
   const colors = {
      blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
      orange: 'bg-orange-50 text-orange-600 hover:bg-orange-100',
      purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
      green: 'bg-green-50 text-green-600 hover:bg-green-100',
   };

   return (
      <button className={`flex flex-col items-center justify-center p-4 rounded-xl transition ${colors[color]}`}>
         <Icon size={24} className="mb-2"/>
         <span className="text-xs font-bold">{label}</span>
      </button>
   );
}

export default CustomerDashboard;