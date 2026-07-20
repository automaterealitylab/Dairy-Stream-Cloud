import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Route as RouteIcon,
  ToggleLeft,
  ToggleRight,
  Home,
  List,
  History,
  Map,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { fetchAgentProfile, updateAgentAvailability } from "../../api/agent/agent.api";

const headingFont = { fontFamily: "'Lora', serif" };

const EMPTY_AGENT_PROFILE = {
  agentId: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  status: "ACTIVE",
  isActive: false,
  inactiveFrom: null,
  inactiveUntil: null,
  inactiveDaysRemaining: 0,
  joinedDate: null,
  deliveryRoutes: [],
};

const InfoRow = ({ icon, label, value }) => (
  <div className="flex items-center gap-4">
    <div className="rounded-[16px] border border-[#F0D9B9] bg-[#FFF4E2] p-2.5 text-[#B8641A]">{icon}</div>
    <div className="min-w-0">
      <p className="mb-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-[#A88763]">{label}</p>
      <p className="truncate text-sm font-bold text-[#2C1A0E]">{value || "Not provided"}</p>
    </div>
  </div>
);

const NavTab = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex min-w-[64px] flex-col items-center gap-1 rounded-[18px] px-2 py-2 transition ${active ? "text-[#B8641A]" : "text-[#8B7355]"
      }`}
  >
    {icon}
    <span className="text-[8px] font-black uppercase tracking-[0.16em]">{label}</span>
    {active && <div className="h-1 w-1 rounded-full bg-[#B8641A]" />}
  </button>
);

const AgentProfile = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [profile, setProfile] = useState(EMPTY_AGENT_PROFILE);
  const [showInactiveDaysInput, setShowInactiveDaysInput] = useState(false);
  const [inactiveDays, setInactiveDays] = useState("1");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");

  const isActive =
    typeof profile?.isActive === "boolean"
      ? profile.isActive
      : String(profile?.status || "ACTIVE").toUpperCase() !== "INACTIVE";

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setProfile((prev) => ({
          ...prev,
          agentId: user?.agentId || "",
          name: user?.name || "",
          email: user?.email || "",
        }));
      } catch {
        /* ignore */
      }
    }

    const loadProfile = async () => {
      try {
        const payload = await fetchAgentProfile();
        if (payload) setProfile(payload);
      } catch {
        /* ignore */
      }
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
    } finally {
      setStatusSaving(false);
    }
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
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] px-4 pb-32 text-[#2C1A0E]">
      <div className="mx-auto max-w-md space-y-5">
        <section className="rounded-[28px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFF3E8_100%)] px-4 py-3 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">Profile</p>
              <h1 className="mt-1 text-[26px] font-black leading-none text-[#2C1A0E]" style={headingFont}>
                Agent Identity
              </h1>
              <p className="mt-1 text-sm font-semibold text-[#6B5B3E]">Identity & availability</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1 rounded-full border border-[#E7DAC6] bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#B8641A] transition hover:bg-[#FFF8EF]"
            >
              <LogOut size={12} />
              Logout
            </button>
          </div>
        </section>

        <div className="relative overflow-hidden rounded-[30px] border border-[#E7DAC6] bg-white p-6 text-center shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <div className="absolute left-0 top-0 h-24 w-full bg-[linear-gradient(135deg,#FFF4E2_0%,#FFF8EF_100%)]" />
          <div className="relative z-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-[#FFF4E2] shadow-md">
              <User size={32} className="text-[#B8641A]" />
            </div>

            <h3 className="mt-4 text-lg font-black text-[#2C1A0E]">{profile.name || "Loading..."}</h3>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A88763]">ID: {profile.agentId}</p>

            <div className="mt-6 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={statusSaving}
                className={`flex items-center gap-3 rounded-2xl border px-5 py-2.5 transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 ${isActive
                    ? "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]"
                    : "border-[#F2D0C8] bg-[#FDECEA] text-[#C0392B]"
                  }`}
              >
                <span className="text-[11px] font-black uppercase tracking-[0.16em]">
                  {isActive ? "Active" : "Not Active"}
                </span>
                <span className="transition-transform">
                  {isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </span>
              </button>

              {!isActive && profile?.inactiveUntil && (
                <p className="rounded-full bg-[#FFF1E4] px-3 py-1 text-[9px] font-bold text-[#C86A2B]">
                  Resume: {new Date(profile.inactiveUntil).toLocaleDateString()} ({profile.inactiveDaysRemaining}d left)
                </p>
              )}
            </div>
          </div>
        </div>

        {showInactiveDaysInput && (
          <div className="rounded-[28px] bg-[#2C1A0E] p-6 text-white shadow-[0_22px_50px_rgba(92,61,30,0.22)]">
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/55">Set Inactive Duration</p>
            <div className="flex gap-3">
              <input
                type="number"
                value={inactiveDays}
                onChange={(e) => setInactiveDays(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm outline-none"
                placeholder="Days"
              />
              <button
                onClick={confirmSetInactive}
                className="rounded-xl bg-[#B8641A] px-6 py-3 text-[10px] font-black uppercase tracking-[0.16em]"
              >
                Set
              </button>
            </div>
            <button
              onClick={() => setShowInactiveDaysInput(false)}
              className="mt-3 w-full rounded-xl border border-[#F2D0C8] bg-[#FDECEA] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#A33A2B] transition hover:bg-[#F8DDD6]"
            >
              Cancel
            </button>
          </div>
        )}

        {statusError && <p className="px-4 text-center text-[10px] font-bold text-[#C0392B]">{statusError}</p>}

        <div className="space-y-5 rounded-[30px] border border-[#EDE8DF] bg-white p-6 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <InfoRow icon={<Phone size={16} />} label="Phone Number" value={profile.phone} />
          <InfoRow icon={<Mail size={16} />} label="Email Address" value={profile.email} />
          <InfoRow icon={<MapPin size={16} />} label="Home Address" value={profile.address} />
        </div>



        <div className="rounded-[30px] border border-[#EDE8DF] bg-white p-6 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <div className="mb-4 flex items-center gap-2">
            <RouteIcon size={16} className="text-[#B8641A]" />
            <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#A88763]">Assigned Routes</h4>
          </div>
          <div className="space-y-2">
            {profile.deliveryRoutes.length > 0 ? (
              profile.deliveryRoutes.map((route, i) => (
                <div key={i} className="flex items-center gap-3 rounded-[20px] border border-[#F3E7D6] bg-[#FFF8EF] p-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#B8641A] text-[10px] font-black text-white">
                    {i + 1}
                  </div>
                  <p className="text-xs font-bold text-[#6B5B3E]">{route}</p>
                </div>
              ))
            ) : (
              <p className="py-2 text-xs font-bold italic text-[#B89970]">No active routes assigned</p>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 z-50 flex w-[94%] max-w-md -translate-x-1/2 items-center justify-around rounded-full border border-[#E7DAC6] bg-[#FFFDF7]/95 p-2 shadow-[0_18px_40px_rgba(92,61,30,0.14)] backdrop-blur-md">
        <NavTab icon={<Home size={18} />} label="Home" onClick={() => navigate("/agent/dashboard")} />
        <NavTab
          icon={<Map size={18} />}
          label="Map"
          onClick={() => navigate("/agent/dashboard", { state: { section: "MAP" } })}
        />
        <NavTab icon={<List size={18} />} label="Tasks" onClick={() => navigate("/agent/working")} />
        <NavTab icon={<History size={18} />} label="History" onClick={() => navigate("/agent/history")} />
        <NavTab icon={<User size={18} />} label="Profile" active onClick={() => navigate("/agent/profile")} />
      </div>
    </div>
  );
};

export default AgentProfile;
