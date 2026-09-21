import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Route as RouteIcon,
  Home,
  List,
  History,
  Map as MapIcon,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Calendar,
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
  isActive: true,
  inactiveFrom: null,
  inactiveUntil: null,
  inactiveDaysRemaining: 0,
  joinedDate: null,
  deliveryRoutes: [],
};

const InfoRow = ({ icon, label, value }) => (
  <div className="flex items-center gap-3.5">
    <div className="rounded-[16px] border border-[#F0D9B9] bg-[#FFF4E2] p-2.5 text-[#B8641A]">{icon}</div>
    <div className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#A88763]">{label}</p>
      <p className="truncate text-sm font-bold text-[#2C1A0E]">{value || "Not provided"}</p>
    </div>
  </div>
);

const NavTab = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex min-w-[64px] flex-col items-center gap-1 rounded-[18px] px-2 py-2 transition ${
      active ? "text-[#B8641A]" : "text-[#8B7355]"
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

  const handleMarkAvailable = async () => {
    if (statusSaving) return;
    setStatusError("");

    try {
      setStatusSaving(true);
      const payload = await updateAgentAvailability({ isActive: true });
      setProfile((prev) => ({
        ...prev,
        ...payload,
        isActive: true,
        status: "ACTIVE",
        inactiveUntil: null,
        inactiveDaysRemaining: 0,
      }));
      setShowInactiveDaysInput(false);
    } catch (err) {
      setStatusError(err?.message || "Failed to update availability status.");
    } finally {
      setStatusSaving(false);
    }
  };

  const confirmSetUnavailable = async () => {
    const parsedDays = Number(inactiveDays);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      setStatusError("Please enter a valid number of days (1 or more).");
      return;
    }

    try {
      setStatusSaving(true);
      const payload = await updateAgentAvailability({ isActive: false, inactiveDays: parsedDays });
      setProfile((prev) => ({
        ...prev,
        ...payload,
        isActive: false,
        status: "INACTIVE",
      }));
      setShowInactiveDaysInput(false);
    } catch (err) {
      setStatusError(err?.message || "Failed to update availability.");
    } finally {
      setStatusSaving(false);
    }
  };

  const formatResumeDate = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="agent-safe-top min-h-screen bg-[#FFFDF7] px-4 pb-32 text-[#2C1A0E]">
      <div className="mx-auto max-w-md space-y-5">
        {/* Header */}
        <section className="rounded-[28px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFF3E8_100%)] px-4 py-3 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">Profile</p>
              <h1 className="mt-1 text-[26px] font-black leading-none text-[#2C1A0E]" style={headingFont}>
                Agent Profile
              </h1>
              <p className="mt-1 text-sm font-semibold text-[#6B5B3E]">Identity & delivery availability</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E7DAC6] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#B8641A] shadow-sm transition hover:bg-[#FFF8EF]"
            >
              <LogOut size={12} />
              Logout
            </button>
          </div>
        </section>

        {/* Identity Card */}
        <div className="relative overflow-hidden rounded-[30px] border border-[#E7DAC6] bg-white p-5 text-center shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <div className="absolute left-0 top-0 h-20 w-full bg-[linear-gradient(135deg,#FFF4E2_0%,#FFF8EF_100%)]" />
          <div className="relative z-10">
            <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-full border-4 border-white bg-[#FFF4E2] shadow-md">
              <User size={30} className="text-[#B8641A]" />
            </div>

            <h2 className="mt-3 text-lg font-black text-[#2C1A0E]">{profile.name || "Delivery Agent"}</h2>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A88763]">
              Agent ID: {profile.agentId || "—"}
            </p>
          </div>
        </div>

        {/* Delivery Availability Section */}
        <div className="rounded-[30px] border border-[#EDE8DF] bg-white p-5 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A88763]">
                Delivery Availability
              </p>
              <h3 className="mt-0.5 text-base font-black text-[#2C1A0E]">Duty Status</h3>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                isActive
                  ? "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]"
                  : "border-[#F2D0C8] bg-[#FDECEA] text-[#C0392B]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${isActive ? "bg-[#4A7C2F]" : "bg-[#C0392B]"}`}
              />
              {isActive ? "Available" : "Unavailable"}
            </span>
          </div>

          <div className="mt-3 rounded-[20px] border border-[#EDE8DF] bg-[#FFFDF7] p-3.5">
            {isActive ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#4A7C2F]" />
                  <div>
                    <p className="text-sm font-bold text-[#2C1A0E]">Available for deliveries</p>
                    <p className="mt-0.5 text-xs text-[#6B5B3E]">
                      You are currently active and available for assigned morning deliveries.
                    </p>
                  </div>
                </div>

                {!showInactiveDaysInput && (
                  <button
                    type="button"
                    onClick={() => setShowInactiveDaysInput(true)}
                    disabled={statusSaving}
                    className="w-full rounded-[14px] border border-[#E7DAC6] bg-white py-2 text-xs font-bold text-[#8B5E34] transition hover:bg-[#FFF8EF] active:scale-[0.99]"
                  >
                    Take Time Off / Set Unavailable
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#C0392B]" />
                  <div>
                    <p className="text-sm font-bold text-[#2C1A0E]">Unavailable for deliveries</p>
                    <p className="mt-0.5 text-xs text-[#6B5B3E]">
                      You are currently taking time off and will not receive new delivery assignments.
                    </p>
                    {profile?.inactiveUntil && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#F0D9B9] bg-[#FFF4E2] px-3 py-1 text-[11px] font-bold text-[#B8641A]">
                        <Calendar size={12} />
                        Resumes: {formatResumeDate(profile.inactiveUntil)}
                        {profile.inactiveDaysRemaining > 0 && ` (${profile.inactiveDaysRemaining}d remaining)`}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleMarkAvailable}
                  disabled={statusSaving}
                  className="w-full rounded-[14px] bg-[#4A7C2F] py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white shadow-md shadow-[#4A7C2F]/20 transition hover:bg-[#3D6826] active:scale-[0.99] disabled:opacity-60"
                >
                  {statusSaving ? "Updating..." : "Mark Available for Deliveries"}
                </button>
              </div>
            )}
          </div>

          {/* Inactive Duration Form */}
          {showInactiveDaysInput && (
            <div className="mt-3 rounded-[22px] border border-[#E7DAC6] bg-[#FFF8EF] p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8B5E34]">
                Set Unavailable Duration
              </p>
              <p className="mt-0.5 text-xs text-[#6B5B3E]">
                Select how many days you will be away:
              </p>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {["1", "2", "3", "7"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setInactiveDays(d)}
                    className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                      inactiveDays === d
                        ? "border-[#B8641A] bg-[#B8641A] text-white"
                        : "border-[#E7DAC6] bg-white text-[#6B5B3E]"
                    }`}
                  >
                    {d} {d === "1" ? "Day" : "Days"}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={inactiveDays}
                  onChange={(e) => setInactiveDays(e.target.value)}
                  className="w-24 rounded-xl border border-[#E7DAC6] bg-white px-3 py-2 text-center text-sm font-bold text-[#2C1A0E] outline-none focus:border-[#B8641A]"
                  placeholder="Days"
                />
                <button
                  type="button"
                  onClick={confirmSetUnavailable}
                  disabled={statusSaving}
                  className="flex-1 rounded-xl bg-[#B8641A] py-2 text-xs font-black uppercase tracking-[0.14em] text-white shadow-sm transition hover:bg-[#9B5113] active:scale-[0.99] disabled:opacity-60"
                >
                  {statusSaving ? "Saving..." : "Confirm Unavailable"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInactiveDaysInput(false)}
                  className="rounded-xl border border-[#E7DAC6] bg-white px-3 py-2 text-xs font-bold text-[#8B7355] hover:bg-[#FAF7F2]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {statusError && (
            <p className="mt-2 text-center text-xs font-bold text-[#C0392B]">{statusError}</p>
          )}
        </div>

        {/* Contact Information */}
        <div className="space-y-4 rounded-[30px] border border-[#EDE8DF] bg-white p-5 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A88763]">Contact Details</p>
          <InfoRow icon={<Phone size={16} />} label="Phone Number" value={profile.phone} />
          <InfoRow icon={<Mail size={16} />} label="Email Address" value={profile.email} />
          <InfoRow icon={<MapPin size={16} />} label="Home Address" value={profile.address} />
        </div>

        {/* Assigned Routes */}
        <div className="rounded-[30px] border border-[#EDE8DF] bg-white p-5 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <div className="mb-3 flex items-center gap-2">
            <RouteIcon size={16} className="text-[#B8641A]" />
            <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#A88763]">Assigned Buildings / Routes</h4>
          </div>
          <div className="space-y-2">
            {profile.deliveryRoutes && profile.deliveryRoutes.length > 0 ? (
              profile.deliveryRoutes.map((route, i) => (
                <div key={i} className="flex items-center gap-3 rounded-[18px] border border-[#F3E7D6] bg-[#FFF8EF] p-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#B8641A] text-[10px] font-black text-white">
                    {i + 1}
                  </div>
                  <p className="text-xs font-bold text-[#6B5B3E]">{route}</p>
                </div>
              ))
            ) : (
              <p className="py-2 text-xs font-bold italic text-[#B89970]">No fixed routes assigned</p>
            )}
          </div>
        </div>

        {/* Account Sign Out Action */}
        <div className="rounded-[28px] border border-[#EDE8DF] bg-white p-4 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-[#F2D0C8] bg-[#FFF5F2] py-3 text-xs font-black uppercase tracking-[0.16em] text-[#C0392B] transition hover:bg-[#FDECEA] active:scale-[0.99]"
          >
            <LogOut size={16} />
            Log Out from Agent Portal
          </button>
        </div>
      </div>

      {/* Bottom Floating Navigation */}
      <div className="fixed bottom-6 left-1/2 z-50 flex w-[94%] max-w-md -translate-x-1/2 items-center justify-around rounded-full border border-[#E7DAC6] bg-[#FFFDF7]/95 p-2 shadow-[0_18px_40px_rgba(92,61,30,0.14)] backdrop-blur-md">
        <NavTab icon={<Home size={18} />} label="Home" onClick={() => navigate("/agent/dashboard")} />
        <NavTab
          icon={<MapIcon size={18} />}
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

