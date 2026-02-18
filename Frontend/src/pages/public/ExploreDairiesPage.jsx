import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import {
  Search, MapPin, Filter, Star, ShieldCheck,
  Clock, Truck, ChevronDown, User, LogOut
} from 'lucide-react';
import { fetchPublicDairies } from '../../api/public.api.js';
import LoadingIndicator from '../../components/common/LoadingIndicator.jsx';

const ExploreDairiesPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [dairies, setDairies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetchPublicDairies();
        const list = res?.dairies || [];
        if (active) {
          setDairies(list);
          setLoadError('');
        }
      } catch (err) {
        if (active) setLoadError('Failed to load dairies');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const mappedDairies = useMemo(() => {
    return dairies.map((d) => ({
      id: d.id,
      name: d.dairy_name || d.name || 'Dairy',
      rating: d.rating ?? null,
      reviews: d.reviews ?? null,
      distance: d.distance || '�',
      isVerified: Boolean(d.is_verified),
      isTrusted: Boolean(d.is_trusted),
      slots: Array.isArray(d.slots) && d.slots.length ? d.slots : ['Morning'],
      image: d.image_url || '',
      address: d.address || d.dairy_address || d.city || 'Address not set',
      minPrice: d.min_price ?? 50
    }));
  }, [dairies]);

  // Simple Filter Logic (Name or Address)
  const filteredDairies = mappedDairies.filter(dairy =>
    dairy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dairy.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLoggedIn = Boolean(user?.token || user?.role || localStorage.getItem("user"));

  const handleAuthAction = () => {
    if (isLoggedIn) {
      logout();
      navigate("/", { replace: true });
      return;
    }
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* --- HEADER (Full Width) --- */}
      <header className="bg-white sticky top-0 z-20 shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

             {/* Logo & Location */}
             <div className="flex items-center justify-between md:justify-start gap-6">
                <div onClick={() => navigate('/')} className="cursor-pointer font-bold text-2xl text-blue-600 tracking-tight flex items-center gap-2">
                   DairyStream
                </div>

                {/* Location Picker */}
                <div className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-full cursor-pointer transition">
                   <MapPin size={18} className="text-red-500" />
                   <div className="text-sm">
                      <span className="text-gray-500">Delivering to</span>
                      <span className="font-bold text-gray-800 ml-1">Kothrud, Pune</span>
                   </div>
                   <ChevronDown size={16} className="text-gray-400"/>
                </div>
             </div>

             {/* Search Bar (Wide) */}
             <div className="flex-1 max-w-2xl relative">
                <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search for dairies, milk, paneer..."
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>

             {/* Login Button */}
             <div className="hidden md:block">
                <button onClick={handleAuthAction} className="flex items-center gap-2 font-semibold text-gray-700 hover:text-blue-600 transition">
                   {isLoggedIn ? <LogOut size={20} /> : <User size={20} />}
                   {isLoggedIn ? "Logout" : "Login"}
                </button>
             </div>
          </div>

          {/* Filters Row */}
          <div className="flex gap-3 overflow-x-auto pb-1 mt-4 no-scrollbar">
             <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-semibold hover:border-gray-300 transition shadow-sm">
                <Filter size={14}/> Filters
             </button>
             <button className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium hover:border-blue-500 hover:text-blue-600 transition shadow-sm whitespace-nowrap">
                Verified Partners
             </button>
             <button className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium hover:border-blue-500 hover:text-blue-600 transition shadow-sm whitespace-nowrap">
                Rating 4.0+
             </button>
             <button className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium hover:border-blue-500 hover:text-blue-600 transition shadow-sm whitespace-nowrap">
                Morning Delivery
             </button>
             <button className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium hover:border-blue-500 hover:text-blue-600 transition shadow-sm whitespace-nowrap">
                Within 2 km
             </button>
          </div>
        </div>
      </header>

      {/* --- CONTENT GRID --- */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
         <h2 className="text-xl font-bold text-gray-900 mb-6">Nearby Dairies</h2>

         {loading ? (
            <LoadingIndicator className="py-20" message="Loading dairies..." />
         ) : loadError ? (
            <div className="text-center py-20 text-gray-500">{loadError}</div>
         ) : (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDairies.map((dairy) => (
               <div
                  key={dairy.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden group"
                  onClick={() => navigate(`/join/${dairy.id}`)}
               >
                  {/* Image Area */}
                  <div className="relative h-48 overflow-hidden bg-gray-100">
                     {dairy.image ? (
                        <img
                           src={dairy.image}
                           alt={dairy.name}
                           className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                           No image
                        </div>
                     )}
                     <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-gray-800 shadow-sm flex items-center gap-1">
                        <Clock size={12}/> {dairy.distance}
                     </div>
                     {dairy.isVerified && (
                        <div className="absolute bottom-3 left-3 bg-blue-600 text-white px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 shadow-md">
                           <ShieldCheck size={10}/> Verified
                        </div>
                     )}
                  </div>

                  {/* Content Area */}
                  <div className="p-4">
                     <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition">{dairy.name}</h3>
                        {dairy.rating != null && (
                          <div className="flex items-center gap-1 bg-green-100 px-1.5 py-0.5 rounded text-xs font-bold text-green-700">
                             {dairy.rating} <Star size={10} fill="currentColor"/>
                          </div>
                        )}
                     </div>

                     <p className="text-sm text-gray-500 mb-3">{dairy.address}</p>

                     <div className="flex items-center gap-2 mb-4">
                        {dairy.isTrusted && (
                           <span className="text-[10px] bg-yellow-50 text-yellow-700 px-2 py-1 rounded-md border border-yellow-100 font-medium flex items-center gap-1">
                              <Star size={10}/> Trusted
                           </span>
                        )}
                        <span className="text-[10px] bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100 font-medium">
                           {dairy.slots.length} Slots Available
                        </span>
                     </div>

                     <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                        <div>
                           <span className="text-xs text-gray-400">Starts at</span>
                           <p className="font-bold text-gray-900">₹{dairy.minPrice}<span className="text-xs font-normal text-gray-500">/L</span></p>
                        </div>
                        <button className="bg-blue-50 text-blue-600 p-2 rounded-full hover:bg-blue-600 hover:text-white transition">
                           <Truck size={20} />
                        </button>
                     </div>
                  </div>
               </div>
            ))}
         </div>
         )}

         {/* Empty State (if search fails) */}
         {!loading && !loadError && filteredDairies.length === 0 && (
            <div className="text-center py-20">
               <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search size={30} className="text-gray-400"/>
               </div>
               <h3 className="text-lg font-bold text-gray-900">No dairies found</h3>
               <p className="text-gray-500">Try searching for a different area or name.</p>
            </div>
         )}
      </div>
    </div>
  );
};

export default ExploreDairiesPage;



