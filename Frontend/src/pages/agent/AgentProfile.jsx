import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  User, Phone, Mail, MapPin, Award, 
  TrendingUp, Route as RouteIcon, ToggleLeft, 
  ToggleRight, Home, List, History 
} from 'lucide-react';
import { fetchAgentProfile, updateAgentAvailability } from "../../api/agent/agent.api";

const EMPTY_AGENT_PROFILE = {
  agentId: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  status: 'ACTIVE',
  isActive: false,
  inactiveFrom: null,
  inactiveUntil: null,
  inactiveDaysRemaining: 0,
  joinedDate: null,
  deliveryRoutes: [],
};

const AgentProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(EMPTY_AGENT_PROFILE);
  const [showInactiveDaysInput, setShowInactiveDaysInput] = useState(false);
  const [inactiveDays, setInactiveDays] = useState("1");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");

  // Logic to determine active state
  const isActive = typeof profile?.isActive === "boolean" 
    ? profile.isActive 
    : String(profile?.status || "ACTIVE").toUpperCase() !== "INACTIVE";

  useEffect(() => {
    // Initial load from LocalStorage for speed
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setProfile((prev) => ({
          ...prev,
          agentId: user?.agentId || '',
          name: user?.name || '',
          email: user?.email || '',
        }));
      } catch (e) { console.error("Malformed local storage"); }
    }

    // Actual Backend Fetch
    const loadProfile = async () => {
      try {
        const payload = await fetchAgentProfile();
        if (payload) setProfile(payload);
      } catch (_err) { console.error("Backend fetch failed"); }
    };
    loadProfile();
  }, []);

  const handleToggleStatus = async () => {
    if (statusSaving) return;
    setStatusError("");

    if (isActive) {
      setShowInactiveDaysInput(true);
      return;
    }

    try {
      setStatusSaving(true);
      const payload = await updateAgentAvailability({ isActive: true });
      setProfile((prev) => ({ ...prev, ...payload, isActive: true }));
      setShowInactiveDaysInput(false);
    } catch (err) {
      setStatusError(err?.message || "Failed to update status.");
    } finally { setStatusSaving(false); }
  };

  const confirmSetInactive = async () => {
    const parsedDays = Number(inactiveDays);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      setStatusError("Enter valid days.");
      return;
    }

    try {
      setStatusSaving(true);
      const payload = await updateAgentAvailability({ isActive: false, inactiveDays: parsedDays });
      setProfile((prev) => ({ ...prev, ...payload, isActive: false }));
      setShowInactiveDaysInput(false);
    } catch (err) {
      setStatusError(err?.message || "Failed to update.");
    } finally { setStatusSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-32 px-4 pt-4 font-sans">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="px-1">
          <h2 className="text-xl font-black tracking-tight">Agent Profile</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Identity & Availability</p>
        </div>

        {/* PROFILE CARD */}
        <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm text-center relative overflow-hidden">
          {/* Subtle Background Accent */}
          <div className="absolute top-0 left-0 w-full h-24 bg-blue-600/5 -z-0" />
          
          <div className="relative z-10">
            <div className="w-20 h-20 bg-blue-50 rounded-full mx-auto flex items-center justify-center border-4 border-white shadow-md">
              <User size={32} className="text-blue-600" />
            </div>
            
            <h3 className="text-lg font-black mt-4">{profile.name || "Loading..."}</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID: {profile.agentId}</p>

            {/* STATUS TOGGLE UI */}
            <div className="mt-6 flex flex-col items-center gap-3">
               <div className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border transition-all ${isActive ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
                  <span className="text-[11px] font-black uppercase tracking-widest">{isActive ? 'Online' : 'Offline'}</span>
                  <button onClick={handleToggleStatus} disabled={statusSaving} className="focus:outline-none transition-transform active:scale-90">
                    {isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
               </div>
               
               {!isActive && profile?.inactiveUntil && (
                 <p className="text-[9px] font-bold text-orange-500 bg-orange-50 px-3 py-1 rounded-full">
                    Resume: {new Date(profile.inactiveUntil).toLocaleDateString()} ({profile.inactiveDaysRemaining}d left)
                 </p>
               )}
            </div>
          </div>
        </div>

        {/* INACTIVE INPUT PROMPT */}
        {showInactiveDaysInput && (
          <div className="bg-gray-900 p-6 rounded-[30px] text-white shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">Set Inactive Duration</p>
            <div className="flex gap-3">
               <input 
                 type="number" 
                 value={inactiveDays} 
                 onChange={(e) => setInactiveDays(e.target.value)} 
                 className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                 placeholder="Days"
               />
               <button onClick={confirmSetInactive} className="bg-blue-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest">Set</button>
            </div>
            <button onClick={() => setShowInactiveDaysInput(false)} className="w-full mt-3 text-[9px] font-bold text-gray-500 uppercase">Cancel</button>
          </div>
        )}

        {statusError && <p className="text-center text-[10px] font-bold text-red-500 px-4">{statusError}</p>}

        {/* CONTACT INFO GRID */}
        <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm space-y-5">
           <InfoRow icon={<Phone size={16}/>} label="Phone Number" value={profile.phone} />
           <InfoRow icon={<Mail size={16}/>} label="Email Address" value={profile.email} />
           <InfoRow icon={<MapPin size={16}/>} label="Home Address" value={profile.address} />
        </div>

        {/* ROUTES SECTION */}
        <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
           <div className="flex items-center gap-2 mb-4">
              <RouteIcon size={16} className="text-blue-600" />
              <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-400">Assigned Routes</h4>
           </div>
           <div className="space-y-2">
              {profile.deliveryRoutes.length > 0 ? profile.deliveryRoutes.map((route, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                   <div className="w-6 h-6 bg-blue-600 text-white rounded-lg flex items-center justify-center text-[10px] font-black">{i+1}</div>
                   <p className="text-xs font-bold text-gray-700">{route}</p>
                </div>
              )) : (
                <p className="text-xs font-bold text-gray-300 italic py-2">No active routes assigned</p>
              )}
           </div>
        </div>
      </div>

      {/* FIXED BOTTOM NAV */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-white/90 backdrop-blur-md border border-gray-200 p-2 rounded-full flex justify-around items-center z-50 shadow-2xl">
        <NavTab icon={<Home size={18} />} label="Home" onClick={() => navigate("/agent/dashboard")} />
        <NavTab icon={<List size={18} />} label="Tasks" onClick={() => navigate("/agent/working")} />
        <NavTab icon={<History size={18} />} label="History" onClick={() => navigate("/agent/history")} />
        <NavTab icon={<User size={18} />} label="Profile" active onClick={() => navigate("/agent/profile")} />
      </div>
    </div>
  );
};

// UI Helper Components
const InfoRow = ({ icon, label, value }) => (
  <div className="flex items-center gap-4">
    <div className="p-2.5 bg-gray-50 rounded-xl text-gray-400">{icon}</div>
    <div className="min-w-0">
      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-sm font-bold text-gray-800 truncate">{value || "Not provided"}</p>
    </div>
  </div>
);

const NavTab = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-0.5 p-2 rounded-2xl min-w-[65px] transition-colors ${active ? "text-blue-600" : "text-gray-400"}`}>
    {icon}
    <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
    {active && <div className="w-1 h-1 bg-blue-600 rounded-full mt-0.5" />}
  </button>
);

export default AgentProfile;