import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, MapPin, Filter, Star, ShieldCheck, 
  Clock, Truck 
} from 'lucide-react';

// --- MOCK DATA (Replace this with API Call later) ---
const MOCK_DAIRIES = [
  {
    id: 'D001',
    name: 'Nandanvan Farms',
    rating: 4.8,
    reviews: 124,
    distance: '1.2 km',
    isVerified: true,
    isTrusted: true,
    slots: ['Morning', 'Evening'],
    image: 'https://images.unsplash.com/photo-1528498033373-3c6c08e93d79?auto=format&fit=crop&q=80&w=200',
    address: 'Kothrud, Pune'
  },
  {
    id: 'D002',
    name: 'Pure Desi Milk',
    rating: 4.2,
    reviews: 85,
    distance: '3.5 km',
    isVerified: true,
    isTrusted: false,
    slots: ['Morning Only'],
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=200',
    address: 'Baner, Pune'
  }
];

const ExploreDairiesPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [dairies, setDairies] = useState(MOCK_DAIRIES);

  // --- BACKEND INTEGRATION NOTE ---
  // useEffect(() => {
  //   fetch('/api/dairies/nearby?lat=...&long=...')
  //     .then(res => res.json())
  //     .then(data => setDairies(data));
  // }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      
      {/* --- HEADER --- */}
      <div className="bg-white sticky top-0 z-10 shadow-sm border-b border-gray-100">
        <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
          
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-2 text-blue-600">
                <MapPin size={20} />
                <span className="font-bold text-gray-900 truncate max-w-[200px]">Kothrud, Pune</span>
             </div>
             <button onClick={() => navigate('/')} className="text-sm font-semibold text-blue-600">Login</button>
          </div>

          <div className="relative">
             <Search className="absolute left-3 top-3 text-gray-400" size={18} />
             <input 
               type="text" 
               placeholder="Search 'Cow Milk' or 'Dairy Name'" 
               className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
             <button className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-semibold whitespace-nowrap hover:bg-gray-200">
                <Filter size={12}/> Filters
             </button>
             <button className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold whitespace-nowrap">
                Verified Only
             </button>
             <button className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold whitespace-nowrap">
                Within 5 km
             </button>
          </div>
        </div>
      </div>

      {/* --- DAIRY LIST --- */}
      <div className="p-4 max-w-lg mx-auto space-y-4">
         <h2 className="text-lg font-bold text-gray-800">Nearby Dairies</h2>
         
         {dairies.map((dairy) => (
            <div key={dairy.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer" onClick={() => navigate(`/join/${dairy.id}`)}>
               <div className="flex gap-4">
                  <img src={dairy.image} alt={dairy.name} className="w-20 h-20 rounded-xl object-cover bg-gray-200"/>
                  
                  <div className="flex-1">
                     <div className="flex justify-between items-start">
                        <h3 className="font-bold text-gray-900">{dairy.name}</h3>
                        <div className="flex items-center gap-1 bg-green-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-green-700">
                           {dairy.rating} <Star size={8} fill="currentColor"/>
                        </div>
                     </div>
                     
                     <p className="text-xs text-gray-500 mb-2">{dairy.address} • {dairy.distance}</p>
                     
                     <div className="flex gap-2 mb-3">
                        {dairy.isVerified && (
                           <span className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 font-medium">
                              <ShieldCheck size={10}/> Verified
                           </span>
                        )}
                        {dairy.isTrusted && (
                           <span className="flex items-center gap-1 text-[10px] bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-100 font-medium">
                              <Star size={10}/> Trusted
                           </span>
                        )}
                     </div>

                     <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1"><Clock size={12}/> {dairy.slots.length} Slots</div>
                        <div className="flex items-center gap-1"><Truck size={12}/> Delivery</div>
                     </div>
                  </div>
               </div>
               
               <button className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
                  View & Join
               </button>
            </div>
         ))}
      </div>
    </div>
  );
};

export default ExploreDairiesPage;