import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Building2, Mail, Phone, ShieldCheck, User, Users, Wallet, Truck, Package, PencilLine, X } from "lucide-react";
import { fetchAdminDashboard, getCachedAdminDashboard } from "../../api/admin.api";
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import { adminHeadingFont, adminShellFont } from "../../components/admin/adminTheme";

const readStoredAdmin = () => {
  try {
    const directAdmin = localStorage.getItem("adminUser");
    if (directAdmin) {
      const parsed = JSON.parse(directAdmin);
      if (parsed) return parsed;
    }
  } catch {
    // Ignore malformed local storage.
  }

  try {
    const user = localStorage.getItem("user");
    if (user) {
      const parsed = JSON.parse(user);
      if (String(parsed?.role || "").toUpperCase() === "ADMIN") return parsed;
    }
  } catch {
    // Ignore malformed local storage.
  }

  return null;
};

const DAIRY_PROFILE_STORAGE_KEY = "adminDairyProfileDraft";

const readStoredDairyProfile = () => {
  try {
    const raw = localStorage.getItem(DAIRY_PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getInitials = (name) =>
  String(name || "Admin")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "A";

const InfoCard = ({ icon: Icon, label, value }) => (
  <div className="rounded-[24px] border border-[#EDE8DF] bg-[#FFFDF8] p-5">
    <div className="flex items-center gap-3">
      <div className="rounded-2xl bg-[#FFF3E2] p-3 text-[#B8641A]">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970]">{label}</p>
        <p className="mt-1 truncate text-base font-black text-[#2C1A0E]">{value || "-"}</p>
      </div>
    </div>
  </div>
);

const SummaryCard = ({ icon: Icon, label, value, tone = "warm" }) => {
  const toneClasses = {
    warm: "bg-[#FFF3E2] text-[#B8641A]",
    mint: "bg-[#EEF7EB] text-[#6F8C45]",
    sky: "bg-[#EAF6FB] text-[#2E7D9A]",
    cream: "bg-[#FDF6EC] text-[#8B7355]",
  };

  return (
    <div className="rounded-[24px] border border-[#EDE8DF] bg-white p-5 shadow-[0_10px_30px_rgba(92,61,30,0.06)]">
      <div className="flex items-center gap-3">
        <div className={`rounded-2xl p-3 ${toneClasses[tone] || toneClasses.warm}`}>
          <Icon size={18} />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970]">{label}</p>
          <p className="mt-1 text-2xl font-black text-[#2C1A0E]">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default function AdminProfile() {
  const cachedDashboard = useMemo(() => getCachedAdminDashboard(), []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboard, setDashboard] = useState(() => cachedDashboard || {});
  const [loading, setLoading] = useState(() => !cachedDashboard);
  const [error, setError] = useState("");
  const [admin, setAdmin] = useState(() => readStoredAdmin());
  const [dairyProfile, setDairyProfile] = useState(() => readStoredDairyProfile());
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState(() => ({
    dairyName: dairyProfile?.dairyName || "",
    dairyEmail: dairyProfile?.dairyEmail || "",
    dairyPhone: dairyProfile?.dairyPhone || "",
    address: dairyProfile?.address || "",
    ownerName: admin?.name || "",
    ownerEmail: admin?.email || admin?.identifier || "",
    ownerPhone: admin?.phone || admin?.mobile || admin?.contact || "",
  }));

  const adminName = admin?.name || "Admin";
  const adminEmail = admin?.email || admin?.identifier || "-";
  const adminPhone = admin?.phone || admin?.mobile || admin?.contact || "-";
  const adminRole = String(admin?.role || "ADMIN").toUpperCase();
  const dairyName = dairyProfile?.dairyName || dashboard?.dairyName || admin?.dairyName || adminName;
  const dairyEmail = dairyProfile?.dairyEmail || "-";
  const dairyPhone = dairyProfile?.dairyPhone || "-";
  const dairyAddress = dairyProfile?.address || "-";
  const stats = dashboard?.stats || {};
  useEffect(() => {
    let active = true;

    const load = async () => {
      setError("");
      setLoading(true);
      try {
        const res = await fetchAdminDashboard({ forceRefresh: true });
        if (active) setDashboard(res || {});
      } catch (err) {
        if (active) setError(err?.message || "Failed to load admin profile");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const openEditModal = () => {
    setFormData({
      dairyName: dairyProfile?.dairyName || dashboard?.dairyName || admin?.dairyName || "",
      dairyEmail: dairyProfile?.dairyEmail || "",
      dairyPhone: dairyProfile?.dairyPhone || "",
      address: dairyProfile?.address || "",
      ownerName: admin?.name || "",
      ownerEmail: admin?.email || admin?.identifier || "",
      ownerPhone: admin?.phone || admin?.mobile || admin?.contact || "",
    });
    setShowEditModal(true);
  };

  const handleSaveProfile = () => {
    const nextDairyProfile = {
      dairyName: String(formData.dairyName || "").trim() || dairyName || "My Dairy",
      dairyEmail: String(formData.dairyEmail || "").trim(),
      dairyPhone: String(formData.dairyPhone || "").trim(),
      address: String(formData.address || "").trim(),
    };
    const nextAdmin = {
      ...(admin || {}),
      name: String(formData.ownerName || "").trim() || "Admin",
      email: String(formData.ownerEmail || "").trim(),
      phone: String(formData.ownerPhone || "").trim(),
      mobile: String(formData.ownerPhone || "").trim(),
      contact: String(formData.ownerPhone || "").trim(),
      role: adminRole,
      dairyName: nextDairyProfile.dairyName,
    };

    try {
      localStorage.setItem(DAIRY_PROFILE_STORAGE_KEY, JSON.stringify(nextDairyProfile));
      localStorage.setItem("adminUser", JSON.stringify(nextAdmin));

      const rawUser = localStorage.getItem("user");
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser);
        if (String(parsedUser?.role || "").toUpperCase() === "ADMIN") {
          localStorage.setItem("user", JSON.stringify({ ...parsedUser, ...nextAdmin }));
        }
      }

      setDairyProfile(nextDairyProfile);
      setAdmin(nextAdmin);
      setShowEditModal(false);
      toast.success("Dairy profile updated");
    } catch {
      toast.error("Failed to save profile changes");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#2C1A0E]" style={adminShellFont}>
      <AdminMobileTopbar adminName={dairyName || adminName} onMenu={() => setSidebarOpen(true)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="px-4 py-8 pb-24 sm:px-6 lg:ml-64 lg:px-10">
        <section className="rounded-[32px] border border-[#EDE8DF] bg-white/95 p-8 shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,#FDE9C9_0%,#FFF7EA_100%)] text-3xl font-black text-[#B8641A] shadow-[0_16px_30px_rgba(184,100,26,0.14)]">
                {getInitials(adminName)}
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#B89970]">
                  Dairy Profile
                </span>
                <h1 className="mt-2 text-4xl text-[#2C1A0E]" style={adminHeadingFont}>
                  {dairyName}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7B6247]">
                  Central place for your dairy identity, owner contact details, and operational shortcuts.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#FFF3E2] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#B8641A]">
                    {adminRole}
                  </span>
                  <span className="rounded-full border border-[#E5D9C7] bg-white px-3 py-1 text-xs font-semibold text-[#7B6247]">
                    Owner: {adminName}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#F2E4D1] bg-[#FFF8EF] px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970]">
                Account Status
              </p>
              <div className="mt-2 flex items-center gap-2 text-[#2C1A0E]">
                <ShieldCheck size={18} className="text-[#6F8C45]" />
                <span className="text-base font-black">Active Admin Access</span>
              </div>
              <button
                type="button"
                onClick={openEditModal}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#B8641A] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#9E5415]"
              >
                <PencilLine size={14} />
                Edit Dairy Profile
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Users} label="Suppliers" value={dashboard?.suppliers?.length || 0} tone="warm" />
          <SummaryCard icon={Truck} label="Pending Deliveries" value={stats.pending || 0} tone="sky" />
          <SummaryCard icon={Wallet} label="Pending Payments" value={stats.pendingPayments || 0} tone="mint" />
          <SummaryCard icon={Package} label="Procured Milk" value={stats.procured_milk || 0} tone="cream" />
        </section>

        <section className="mt-8">
          <div className="rounded-[32px] border border-[#EDE8DF] bg-white/95 p-6 shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
            <div>
              <h2 className="text-2xl text-[#2C1A0E]" style={adminHeadingFont}>Dairy Information</h2>
              <p className="mt-1 text-sm text-[#8B7355]">
                This section covers the dairy profile first, with owner contact details below it.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InfoCard icon={Building2} label="Dairy Name" value={dairyName || "-"} />
              <InfoCard icon={Mail} label="Dairy Email" value={dairyEmail} />
              <InfoCard icon={Phone} label="Dairy Phone" value={dairyPhone} />
              <InfoCard icon={Building2} label="Dairy Address" value={dairyAddress} />
              <InfoCard icon={User} label="Owner / Admin Name" value={adminName} />
              <InfoCard icon={Mail} label="Owner Email / Login ID" value={adminEmail} />
              <InfoCard icon={Phone} label="Owner Phone" value={adminPhone} />
              <InfoCard icon={ShieldCheck} label="Role" value={adminRole} />
              <InfoCard icon={Users} label="Supplier Count" value={String(dashboard?.suppliers?.length || 0)} />
            </div>

            <div className="mt-6 rounded-[24px] border border-dashed border-[#E5D9C7] bg-[#FFFDF8] p-4 text-sm text-[#8B7355]">
              Profile edits currently update the dairy profile and owner details stored in this browser session because the project does not yet expose a dedicated dairy profile update API.
            </div>
          </div>
        </section>
      </main>

      {showEditModal ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-[32px] border border-[#EDE8DF] bg-white p-6 shadow-[0_24px_60px_rgba(44,26,14,0.18)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl text-[#2C1A0E]" style={adminHeadingFont}>Edit Dairy Profile</h2>
                <p className="mt-1 text-sm text-[#8B7355]">
                  Update the dairy details and owner contact shown inside this panel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="rounded-full border border-[#E5D9C7] p-2 text-[#8B7355] transition hover:bg-[#FFF3E2] hover:text-[#B8641A]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4">
              <label className="rounded-[24px] border border-[#E5D9C7] bg-[#FFFDF8] px-5 py-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B89970]">Dairy Name</span>
                <input
                  type="text"
                  value={formData.dairyName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dairyName: e.target.value }))}
                  className="mt-3 w-full bg-transparent text-base font-black text-[#2C1A0E] outline-none"
                />
              </label>

              <label className="rounded-[24px] border border-[#E5D9C7] bg-[#FFFDF8] px-5 py-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B89970]">Dairy Email</span>
                <input
                  type="email"
                  value={formData.dairyEmail}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dairyEmail: e.target.value }))}
                  className="mt-3 w-full bg-transparent text-base font-black text-[#2C1A0E] outline-none"
                />
              </label>

              <label className="rounded-[24px] border border-[#E5D9C7] bg-[#FFFDF8] px-5 py-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B89970]">Dairy Phone</span>
                <input
                  type="text"
                  value={formData.dairyPhone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dairyPhone: e.target.value }))}
                  className="mt-3 w-full bg-transparent text-base font-black text-[#2C1A0E] outline-none"
                />
              </label>

              <label className="rounded-[24px] border border-[#E5D9C7] bg-[#FFFDF8] px-5 py-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B89970]">Dairy Address</span>
                <textarea
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  className="mt-3 w-full resize-none bg-transparent text-base font-black text-[#2C1A0E] outline-none"
                />
              </label>

              <label className="rounded-[24px] border border-[#E5D9C7] bg-[#FFFDF8] px-5 py-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B89970]">Owner / Admin Name</span>
                <input
                  type="text"
                  value={formData.ownerName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, ownerName: e.target.value }))}
                  className="mt-3 w-full bg-transparent text-base font-black text-[#2C1A0E] outline-none"
                />
              </label>

              <label className="rounded-[24px] border border-[#E5D9C7] bg-[#FFFDF8] px-5 py-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B89970]">Owner Email</span>
                <input
                  type="email"
                  value={formData.ownerEmail}
                  onChange={(e) => setFormData((prev) => ({ ...prev, ownerEmail: e.target.value }))}
                  className="mt-3 w-full bg-transparent text-base font-black text-[#2C1A0E] outline-none"
                />
              </label>

              <label className="rounded-[24px] border border-[#E5D9C7] bg-[#FFFDF8] px-5 py-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B89970]">Owner Phone</span>
                <input
                  type="text"
                  value={formData.ownerPhone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, ownerPhone: e.target.value }))}
                  className="mt-3 w-full bg-transparent text-base font-black text-[#2C1A0E] outline-none"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="rounded-2xl border border-[#E5D9C7] px-5 py-3 text-sm font-black text-[#8B7355] transition hover:bg-[#F8F3EC]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="rounded-2xl bg-[#B8641A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#9E5415]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
