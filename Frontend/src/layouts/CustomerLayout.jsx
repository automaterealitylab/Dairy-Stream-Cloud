import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Calendar, ShoppingBag, CreditCard, User, 
  Bell, LogOut 
} from 'lucide-react';

const CustomerLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation Config
  const navItems = [
    { icon: Home, label: 'Home', path: '/customer-dashboard' },
    { icon: Calendar, label: 'Deliveries', path: '/customer/deliveries' },
    { icon: ShoppingBag, label: 'Subscribe', path: '/customer/subscriptions' },
    { icon: CreditCard, label: 'Payments', path: '/customer/payments' },
    { icon: User, label: 'Profile', path: '/customer/profile' },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
      localStorage.clear();
      navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-screen fixed">
        <div className="p-6 border-b border-gray-100">
           <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
              DairyStream
           </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
           {navItems.map((item) => (
              <button 
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive(item.path) 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                 <item.icon size={20} />
                 {item.label}
              </button>
           ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
           <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl text-sm font-medium transition">
              <LogOut size={20} /> Logout
           </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 md:ml-64 pb-20 md:pb-0">
         {/* Mobile Header */}
         <header className="bg-white sticky top-0 z-20 px-4 py-3 shadow-sm flex justify-between items-center md:hidden">
            <h1 className="font-bold text-gray-900">Dashboard</h1>
            <Bell size={20} className="text-gray-600" />
         </header>

         {/* Dynamic Page Content */}
         <div className="p-4 md:p-8 max-w-5xl mx-auto">
            {children}
         </div>
      </main>

      {/* --- MOBILE BOTTOM NAVIGATION --- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-2 flex justify-between z-30 shadow-lg safe-area-bottom">
         {navItems.map((item) => (
            <button 
               key={item.label}
               onClick={() => navigate(item.path)}
               className={`flex flex-col items-center gap-1 p-2 rounded-lg transition ${
                 isActive(item.path) ? 'text-blue-600' : 'text-gray-400'
               }`}
            >
               <item.icon size={24} strokeWidth={isActive(item.path) ? 2.5 : 2} />
               <span className="text-[10px] font-medium">{item.label}</span>
            </button>
         ))}
      </div>

    </div>
  );
};

export default CustomerLayout;