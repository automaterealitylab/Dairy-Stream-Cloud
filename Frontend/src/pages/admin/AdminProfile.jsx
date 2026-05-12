import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Hash,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  Package,
  PencilLine,
  Phone,
  ShieldCheck,
  Truck,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  fetchAdminDashboard,
  fetchAdminProfile,
  getCachedAdminDashboard,
  lookupAdminBankIfsc,
  updateAdminProfile,
  verifyAdminBankAccount,
} from "../../api/admin.api";
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import { adminHeadingFont, adminShellFont } from "../../components/admin/adminTheme";

const readStoredAdmin = () => {
  try {
    const directAdmin = localStorage.getItem("adminUser");
    if (directAdmin) return JSON.parse(directAdmin);
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

const emptyDairyProfile = {
  dairy_name: "",
  dairy_email: "",
  dairy_phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  owner_name: "",
  bank_account_holder_name: "",
  bank_account_number: "",
  masked_account_number: "",
  bank_account_number_revealed: false,
  bank_ifsc_code: "",
  bank_name: "",
  bank_branch: "",
  upi_id: "",
  payment_instructions: "",
  upi_qr_enabled: true,
  bank_transfer_enabled: true,
  payment_verification_mode: "MANUAL",
  payments_enabled: false,
  bank_verified: false,
  verification_provider: "",
  verification_reference_id: "",
  bank_verification_status: "NOT_SUBMITTED",
  bank_verification_timestamp: "",
  account_name_match_score: null,
  bank_metadata: {},
  verified_account_holder_name: "",
  verified_upi_id: "",
  account_verification_response: {},
  verification_attempts: 0,
  verification_last_error: "",
  verification_method: "",
  vpa_detected: false,
  vpa_verified: false,
  bank_verification_reset_at: "",
  verification_required: false,
  account_last_updated_at: "",
};

const buildFormFromProfile = (dairy = {}, admin = {}) => ({
  dairy_name: dairy?.dairy_name || "",
  dairy_email: dairy?.dairy_email || "",
  dairy_phone: dairy?.dairy_phone || "",
  address: dairy?.address || "",
  city: dairy?.city || "",
  state: dairy?.state || "",
  pincode: dairy?.pincode || "",
  owner_name: dairy?.owner_name || admin?.name || "",
  admin_email: admin?.email || "",
  admin_phone: admin?.phone || "",
  bank_account_holder_name: dairy?.bank_account_holder_name || "",
  bank_account_number: dairy?.bank_account_number || "",
  masked_account_number: dairy?.masked_account_number || dairy?.bank_account_number || "",
  bank_account_number_revealed: dairy?.bank_account_number_revealed ?? false,
  bank_ifsc_code: dairy?.bank_ifsc_code || "",
  bank_name: dairy?.bank_name || "",
  bank_branch: dairy?.bank_branch || "",
  upi_id: dairy?.upi_id || "",
  bank_verified: dairy?.bank_verified ?? false,
  verification_provider: dairy?.verification_provider || "",
  verification_reference_id: dairy?.verification_reference_id || "",
  bank_verification_status: dairy?.bank_verification_status || "NOT_SUBMITTED",
  bank_verification_timestamp: dairy?.bank_verification_timestamp || "",
  account_name_match_score: dairy?.account_name_match_score ?? null,
  bank_metadata: dairy?.bank_metadata || {},
  verified_account_holder_name: dairy?.verified_account_holder_name || "",
  verified_upi_id: dairy?.verified_upi_id || "",
  account_verification_response: dairy?.account_verification_response || {},
  verification_attempts: dairy?.verification_attempts || 0,
  verification_last_error: dairy?.verification_last_error || "",
  verification_method: dairy?.verification_method || "",
  vpa_detected: dairy?.vpa_detected ?? false,
  vpa_verified: dairy?.vpa_verified ?? false,
  bank_verification_reset_at: dairy?.bank_verification_reset_at || "",
  verification_required: dairy?.verification_required ?? false,
  account_last_updated_at: dairy?.account_last_updated_at || "",
  payment_instructions: dairy?.payment_instructions || "",
  upi_qr_enabled: dairy?.upi_qr_enabled ?? true,
  bank_transfer_enabled: dairy?.bank_transfer_enabled ?? true,
});

const getInitials = (name) =>
  String(name || "Admin")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "A";

const InfoCard = ({ icon, label, value }) => {
  const IconComponent = icon;
  return (
    <div className="rounded-[24px] border border-[#EDE8DF] bg-[#FFFDF8] p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-[#FFF3E2] p-3 text-[#B8641A]">
          <IconComponent size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970]">{label}</p>
          <p className="mt-1 break-words text-base font-black text-[#2C1A0E]">{value || "-"}</p>
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ icon, label, value, tone = "warm" }) => {
  const IconComponent = icon;
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
          <IconComponent size={18} />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970]">{label}</p>
          <p className="mt-1 text-2xl font-black text-[#2C1A0E]">{value}</p>
        </div>
      </div>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  type = "text",
  className = "",
  children,
  disabled = false,
  hint = "",
}) => (
  <label className={`rounded-[18px] border border-[#E5D9C7] bg-[#FFFDF8] px-3.5 py-2.5 ${className}`}>
    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B89970]">{label}</span>
    {children || (
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full bg-transparent text-sm font-black text-[#2C1A0E] outline-none disabled:text-[#8B7355]"
      />
    )}
    {hint ? <span className="mt-1 block text-[10px] font-semibold text-[#9B8469]">{hint}</span> : null}
  </label>
);

const isValidIfscFormat = (value) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(value || "").trim().toUpperCase());
const normalizeAccountNumber = (value) => String(value || "").replace(/\D/g, "");
const maskAccountNumber = (value) => {
  const normalized = normalizeAccountNumber(value);
  if (!normalized) return "";
  return `${"X".repeat(Math.max(normalized.length - 4, 0))}${normalized.slice(-4)}`;
};

const ValidationBadge = ({ tone = "neutral", children }) => {
  const classes = {
    neutral: "border-[#E5D9C7] bg-white text-[#8B7355]",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    error: "border-red-200 bg-red-50 text-red-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${classes[tone] || classes.neutral}`}>
      {children}
    </span>
  );
};

export default function AdminProfile() {
  const cachedDashboard = useMemo(() => getCachedAdminDashboard(), []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboard, setDashboard] = useState(() => cachedDashboard || {});
  const [loading, setLoading] = useState(() => !cachedDashboard);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [admin, setAdmin] = useState(() => readStoredAdmin());
  const [dairyProfile, setDairyProfile] = useState(emptyDairyProfile);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState(() => buildFormFromProfile(emptyDairyProfile, readStoredAdmin()));
  const [ifscLookup, setIfscLookup] = useState({
    status: "idle",
    message: "",
    data: null,
  });
  const [bankVerification, setBankVerification] = useState({
    status: "idle",
    message: "",
    data: null,
  });
  const [lastVerificationKey, setLastVerificationKey] = useState("");
  const [bankEditMode, setBankEditMode] = useState(false);
  const [bankEditSnapshot, setBankEditSnapshot] = useState(null);

  const adminName = admin?.name || dairyProfile.owner_name || "Admin";
  const adminEmail = admin?.email || "-";
  const adminPhone = admin?.phone || "-";
  const adminRole = String(admin?.role || "ADMIN").toUpperCase();
  const dairyName = dairyProfile.dairy_name || dashboard?.dairyName || admin?.dairyName || "My Dairy";
  const dairyAddress = [dairyProfile.address, dairyProfile.city, dairyProfile.state, dairyProfile.pincode]
    .filter(Boolean)
    .join(", ");
  const paymentStatus = dairyProfile.payments_enabled ? "Enabled" : "Pending Setup";
  const bankFieldsLocked = Boolean(formData.bank_verified) && !bankEditMode && bankVerification.status !== "loading";
  const bankStatusLabel = dairyProfile.bank_verified
    ? "VERIFIED"
    : dairyProfile.verification_required || dairyProfile.bank_verification_status === "PENDING_REVERIFY"
    ? "PENDING REVERIFY"
    : "NOT VERIFIED";
  const stats = dashboard?.stats || {};

  useEffect(() => {
    let active = true;

    const load = async () => {
      setError("");
      setLoading(true);
      try {
        const [dashboardRes, profileRes] = await Promise.all([
          fetchAdminDashboard({ forceRefresh: true }),
          fetchAdminProfile(),
        ]);

        if (!active) return;

        const nextDairy = { ...emptyDairyProfile, ...(profileRes?.dairy || {}) };
        const nextAdmin = {
          ...(readStoredAdmin() || {}),
          ...(profileRes?.admin || {}),
          role: String(profileRes?.admin?.role || "ADMIN").toUpperCase(),
        };

        setDashboard(dashboardRes || {});
        setDairyProfile(nextDairy);
        setAdmin(nextAdmin);
        setFormData(buildFormFromProfile(nextDairy, nextAdmin));
        localStorage.setItem("adminUser", JSON.stringify(nextAdmin));
      } catch (err) {
        if (active) setError(err.response?.data?.error || err?.message || "Failed to load admin profile");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openEditModal = () => {
    const fallbackForm = buildFormFromProfile(dairyProfile, admin);
    setFormData(fallbackForm);
    setBankEditSnapshot(fallbackForm);
    setBankEditMode(false);
    setIfscLookup({ status: "idle", message: "", data: null });
    setBankVerification({
      status: dairyProfile.bank_verified ? "verified" : "idle",
      message: dairyProfile.bank_verification_status || "",
      data: null,
    });
    setLastVerificationKey("");
    setShowEditModal(true);
  };

  const handleEnterBankEditMode = async () => {
    setBankEditMode(true);
    try {
      const revealedProfile = await fetchAdminProfile({ revealBankDetails: true });
      const revealedDairy = { ...emptyDairyProfile, ...(revealedProfile?.dairy || {}) };
      const revealedForm = buildFormFromProfile(revealedDairy, revealedProfile?.admin || admin);
      setFormData(revealedForm);
      setBankEditSnapshot(revealedForm);
    } catch (err) {
      setBankEditSnapshot(formData);
      toast.error(err.response?.data?.error || "Could not securely load bank details for editing");
    }
  };

  const resetBankVerificationForEdit = (overrides = {}) => {
    setFormData((prev) => ({
      ...prev,
      ...overrides,
      bank_verified: false,
      payments_enabled: false,
      verification_provider: "",
      verification_reference_id: "",
      bank_verification_status: "PENDING_REVERIFY",
      bank_verification_timestamp: "",
      account_name_match_score: null,
      verified_account_holder_name: "",
      verified_upi_id: "",
      verification_last_error: "",
      verification_method: "",
      vpa_detected: false,
      vpa_verified: false,
      verification_required: true,
      bank_verification_reset_at: new Date().toISOString(),
    }));
    setBankVerification({ status: "idle", message: "", data: null });
    setLastVerificationKey("");
  };

  const cancelBankEdit = () => {
    if (bankEditSnapshot) setFormData(bankEditSnapshot);
    setBankEditMode(false);
    setBankVerification({
      status: bankEditSnapshot?.bank_verified ? "verified" : "idle",
      message: bankEditSnapshot?.bank_verification_status || "",
      data: null,
    });
    setLastVerificationKey("");
  };

  useEffect(() => {
    if (!showEditModal) return undefined;

    const ifsc = String(formData.bank_ifsc_code || "").trim().toUpperCase();
    if (!ifsc) {
      setIfscLookup({ status: "idle", message: "", data: null });
      return undefined;
    }

    if (!isValidIfscFormat(ifsc)) {
      setIfscLookup({ status: "invalid", message: "Invalid IFSC format", data: null });
      return undefined;
    }

    setIfscLookup((prev) => ({
      ...prev,
      status: "loading",
      message: "Checking IFSC...",
    }));

    const timer = window.setTimeout(async () => {
      try {
        const result = await lookupAdminBankIfsc(ifsc);
        setIfscLookup({ status: "valid", message: "Branch Found", data: result });
        setFormData((prev) => ({
          ...prev,
          bank_ifsc_code: result.ifsc || ifsc,
          bank_name: result.bankName || prev.bank_name,
          bank_branch: result.branch || prev.bank_branch,
          bank_metadata: {
            ...(prev.bank_metadata || {}),
            ifsc: result,
          },
        }));
      } catch (err) {
        setIfscLookup({
          status: "error",
          message: err.response?.data?.error || "Bank Not Found",
          data: null,
        });
      }
    }, 550);

    return () => window.clearTimeout(timer);
  }, [formData.bank_ifsc_code, showEditModal]);

  const handleRetryIfscLookup = async () => {
    const ifsc = String(formData.bank_ifsc_code || "").trim().toUpperCase();
    if (!isValidIfscFormat(ifsc)) {
      setIfscLookup({ status: "invalid", message: "Invalid IFSC format", data: null });
      return;
    }

    setIfscLookup({ status: "loading", message: "Checking IFSC...", data: null });
    try {
      const result = await lookupAdminBankIfsc(ifsc);
      setIfscLookup({ status: "valid", message: "Branch Found", data: result });
      setFormData((prev) => ({
        ...prev,
        bank_name: result.bankName || prev.bank_name,
        bank_branch: result.branch || prev.bank_branch,
        bank_metadata: { ...(prev.bank_metadata || {}), ifsc: result },
      }));
    } catch (err) {
      setIfscLookup({ status: "error", message: err.response?.data?.error || "Bank Not Found", data: null });
    }
  };

  const handleVerifyBankAccount = async () => {
    const accountNumber = normalizeAccountNumber(formData.bank_account_number);
    if (accountNumber.length < 8 || accountNumber.length > 20) {
      setBankVerification({ status: "error", message: "Account number must be 8-20 digits", data: null });
      return;
    }
    if (!isValidIfscFormat(formData.bank_ifsc_code)) {
      setBankVerification({ status: "error", message: "Enter a valid IFSC before verification", data: null });
      return;
    }

    setBankVerification({ status: "loading", message: "Verifying account...", data: null });
    try {
      const verification = await verifyAdminBankAccount({
        accountHolderName: formData.bank_account_holder_name,
        accountNumber,
        ifsc: formData.bank_ifsc_code,
        ownerName: formData.owner_name,
      });
      setBankVerification({
        status: verification.verified ? "verified" : "warning",
        message: verification.reason || verification.status || "Verification completed",
        data: verification,
      });
      setFormData((prev) => ({
        ...prev,
        bank_account_holder_name: verification.accountHolderName || prev.bank_account_holder_name,
        verified_account_holder_name: verification.verifiedAccountHolderName || verification.detectedAccountHolderName || "",
        upi_id: verification.verifiedUpiId || prev.upi_id,
        verified_upi_id: verification.verifiedUpiId || "",
        bank_name: verification.ifsc?.bankName || prev.bank_name,
        bank_branch: verification.ifsc?.branch || prev.bank_branch,
        bank_verified: verification.verified,
        payments_enabled: verification.verified,
        verification_provider: verification.provider,
        verification_reference_id: verification.referenceId,
        bank_verification_status: verification.status,
        bank_verification_timestamp: verification.timestamp,
        account_name_match_score: verification.accountNameMatchScore,
        verification_last_error: verification.reason || "",
        verification_method: verification.provider === "local" ? "LOCAL_VALIDATION" : "PENNY_DROP",
        vpa_detected: verification.vpaDetected,
        vpa_verified: verification.vpaVerified,
        bank_metadata: {
          ...(prev.bank_metadata || {}),
          ifsc: verification.ifsc,
          verification,
        },
      }));
      setLastVerificationKey(`${accountNumber}:${String(formData.bank_ifsc_code || "").trim().toUpperCase()}`);
      if (verification.verified) setBankEditMode(false);
      toast.success(verification.verified ? "Bank account verified" : "Bank verification completed with warnings");
    } catch (err) {
      setBankVerification({
        status: "error",
        message: err.response?.data?.error || "Bank verification failed",
        data: null,
      });
    }
  };

  useEffect(() => {
    if (!showEditModal) return undefined;
    if (formData.bank_verified) return undefined;
    if (bankVerification.status === "loading") return undefined;
    if (ifscLookup.status !== "valid") return undefined;

    const accountNumber = normalizeAccountNumber(formData.bank_account_number);
    const ifsc = String(formData.bank_ifsc_code || "").trim().toUpperCase();
    const verificationKey = `${accountNumber}:${ifsc}`;

    if (accountNumber.length < 8 || accountNumber.length > 20 || !isValidIfscFormat(ifsc)) return undefined;
    if (lastVerificationKey === verificationKey) return undefined;

    const timer = window.setTimeout(async () => {
      setBankVerification({ status: "loading", message: "Verifying account...", data: null });
      try {
        const verification = await verifyAdminBankAccount({
          accountHolderName: formData.bank_account_holder_name,
          accountNumber,
          ifsc,
          ownerName: formData.owner_name,
        });

        setBankVerification({
          status: verification.verified ? "verified" : "warning",
          message: verification.reason || verification.status || "Verification completed",
          data: verification,
        });
        setFormData((prev) => ({
          ...prev,
          bank_account_holder_name: verification.accountHolderName || prev.bank_account_holder_name,
          verified_account_holder_name: verification.verifiedAccountHolderName || verification.detectedAccountHolderName || "",
          upi_id: verification.verifiedUpiId || prev.upi_id,
          verified_upi_id: verification.verifiedUpiId || "",
          bank_name: verification.ifsc?.bankName || prev.bank_name,
          bank_branch: verification.ifsc?.branch || prev.bank_branch,
          bank_verified: verification.verified,
          payments_enabled: verification.verified,
          verification_provider: verification.provider,
          verification_reference_id: verification.referenceId,
          bank_verification_status: verification.status,
          bank_verification_timestamp: verification.timestamp,
          account_name_match_score: verification.accountNameMatchScore,
          verification_last_error: verification.reason || "",
          verification_method: verification.provider === "local" ? "LOCAL_VALIDATION" : "PENNY_DROP",
          vpa_detected: verification.vpaDetected,
          vpa_verified: verification.vpaVerified,
          bank_metadata: {
            ...(prev.bank_metadata || {}),
            ifsc: verification.ifsc,
            verification,
          },
        }));
        setLastVerificationKey(verificationKey);
        if (verification.verified) setBankEditMode(false);
      } catch (err) {
        setBankVerification({
          status: "error",
          message: err.response?.data?.error || "Bank verification failed",
          data: null,
        });
        setLastVerificationKey(verificationKey);
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    bankVerification.status,
    formData.bank_account_holder_name,
    formData.bank_account_number,
    formData.bank_ifsc_code,
    formData.bank_verified,
    formData.owner_name,
    ifscLookup.status,
    lastVerificationKey,
    showEditModal,
  ]);

  const handleSaveProfile = async () => {
    if (!String(formData.dairy_name || "").trim()) {
      toast.error("Dairy name is required");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateAdminProfile(formData);
      const nextDairy = { ...emptyDairyProfile, ...(updated?.dairy || {}) };
      const nextAdmin = {
        ...(admin || {}),
        ...(updated?.admin || {}),
        role: adminRole,
        dairyName: nextDairy.dairy_name,
      };

      setDairyProfile(nextDairy);
      setAdmin(nextAdmin);
      setFormData(buildFormFromProfile(nextDairy, nextAdmin));
      setBankEditMode(false);
      setBankEditSnapshot(null);
      localStorage.setItem("adminUser", JSON.stringify(nextAdmin));

      const rawUser = localStorage.getItem("user");
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser);
        if (String(parsedUser?.role || "").toUpperCase() === "ADMIN") {
          localStorage.setItem("user", JSON.stringify({ ...parsedUser, ...nextAdmin }));
        }
      }

      setShowEditModal(false);
      toast.success("Dairy profile updated");
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || err.message || "Failed to save profile");
    } finally {
      setSaving(false);
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
                {getInitials(dairyName)}
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#B89970]">
                  Dairy Profile
                </span>
                <h1 className="mt-2 text-4xl text-[#2C1A0E]" style={adminHeadingFont}>
                  {dairyName}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7B6247]">
                  Manage dairy identity, owner contact, UPI collection, and bank details.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#FFF3E2] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#B8641A]">
                    {adminRole}
                  </span>
                  <span className="rounded-full border border-[#E5D9C7] bg-white px-3 py-1 text-xs font-semibold text-[#7B6247]">
                    Owner: {adminName}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#E5D9C7] bg-white px-3 py-1 text-xs font-semibold text-[#7B6247]">
                    <CheckCircle2 size={13} className={dairyProfile.payments_enabled ? "text-[#4A7C2F]" : "text-[#B89970]"} />
                    Payments: {paymentStatus}
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
                These details are saved to the backend and used for direct customer UPI payments.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InfoCard icon={Building2} label="Dairy Name" value={dairyName} />
              <InfoCard icon={Mail} label="Dairy Email" value={dairyProfile.dairy_email} />
              <InfoCard icon={Phone} label="Dairy Phone" value={dairyProfile.dairy_phone} />
              <InfoCard icon={MapPin} label="Dairy Address" value={dairyAddress} />
              <InfoCard icon={User} label="Owner / Admin Name" value={adminName} />
              <InfoCard icon={Mail} label="Owner Email / Login ID" value={adminEmail} />
              <InfoCard icon={Phone} label="Owner Phone" value={adminPhone} />
              <InfoCard icon={Landmark} label="Bank Account Holder" value={dairyProfile.bank_account_holder_name} />
              <InfoCard icon={CreditCard} label="Bank Account" value={dairyProfile.masked_account_number || maskAccountNumber(dairyProfile.bank_account_number)} />
              <InfoCard icon={Hash} label="IFSC Code" value={dairyProfile.bank_ifsc_code} />
              <InfoCard icon={CreditCard} label="UPI ID" value={dairyProfile.upi_id} />
              <InfoCard icon={ShieldCheck} label="Bank Verification" value={bankStatusLabel} />
              <InfoCard icon={CheckCircle2} label="Payments Enabled" value={paymentStatus} />
              <InfoCard icon={Users} label="Supplier Count" value={String(dashboard?.suppliers?.length || 0)} />
            </div>
          </div>
        </section>
      </main>

      {showEditModal ? (
        <div className="fixed inset-0 z-[85] bg-black/40 px-4 py-4 sm:px-6 sm:py-8">
          <div className="flex min-h-full items-center justify-center">
            <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-[28px] border border-[#EDE8DF] bg-white shadow-[0_24px_60px_rgba(44,26,14,0.18)]">
              <div className="flex items-start justify-between gap-3 border-b border-[#F2E8DB] px-4 py-3 sm:px-6">
                <div>
                  <h2 className="text-xl text-[#2C1A0E] sm:text-2xl" style={adminHeadingFont}>Edit Dairy Profile</h2>
                  <p className="text-xs text-[#8B7355] sm:text-sm">
                    Add or update dairy, UPI, and bank details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-full border border-[#E5D9C7] p-2 text-[#8B7355] transition hover:bg-[#FFF3E2] hover:text-[#B8641A]"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto px-4 py-4 sm:px-6">
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#8B7355]">Dairy Details</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <Field label="Dairy Name" value={formData.dairy_name} onChange={(value) => setField("dairy_name", value)} className="xl:col-span-3" />
                      <Field label="Dairy Email" type="email" value={formData.dairy_email} onChange={(value) => setField("dairy_email", value)} />
                      <Field label="Dairy Phone" value={formData.dairy_phone} onChange={(value) => setField("dairy_phone", value)} />
                      <Field label="Pincode" value={formData.pincode} onChange={(value) => setField("pincode", value)} />
                      <Field label="Address" value={formData.address} onChange={(value) => setField("address", value)} className="xl:col-span-3" />
                      <Field label="City" value={formData.city} onChange={(value) => setField("city", value)} />
                      <Field label="State" value={formData.state} onChange={(value) => setField("state", value)} />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#8B7355]">Owner Details</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Field label="Owner / Admin Name" value={formData.owner_name} onChange={(value) => setField("owner_name", value)} />
                      <Field label="Owner Email" type="email" value={formData.admin_email} onChange={(value) => setField("admin_email", value)} />
                      <Field label="Owner Phone" value={formData.admin_phone} onChange={(value) => setField("admin_phone", value)} />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8B7355]">Bank And UPI</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <ValidationBadge tone={formData.bank_verified ? "success" : formData.verification_required ? "warning" : "neutral"}>
                          {formData.bank_verified ? "VERIFIED" : formData.verification_required ? "PENDING REVERIFY" : "NOT VERIFIED"}
                        </ValidationBadge>
                        {bankEditMode ? (
                          <button
                            type="button"
                            onClick={cancelBankEdit}
                            className="rounded-xl border border-[#E5D9C7] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#8B7355] transition hover:bg-[#FFF3E2]"
                          >
                            Cancel Edit
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleEnterBankEditMode}
                            className="rounded-xl border border-[#E5D9C7] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#8B7355] transition hover:bg-[#FFF3E2]"
                          >
                            Edit Bank Details
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <Field
                        label="Account Holder Name"
                        value={formData.bank_account_holder_name}
                        onChange={(value) => setField("bank_account_holder_name", value)}
                        disabled={bankFieldsLocked}
                        hint={bankFieldsLocked ? "Verified by bank provider" : "Auto-filled after verification when available"}
                      />
                      <Field
                        label="Account Number"
                        value={formData.bank_account_number}
                        onChange={(value) => {
                          resetBankVerificationForEdit({
                            bank_account_number: normalizeAccountNumber(value),
                            masked_account_number: maskAccountNumber(value),
                          });
                        }}
                        disabled={bankFieldsLocked}
                        hint={formData.bank_account_number_revealed ? "Full value is visible only while editing" : "Masked after save"}
                      />
                      <Field label="IFSC Code" value={formData.bank_ifsc_code} onChange={(value) => setField("bank_ifsc_code", value.toUpperCase())}>
                        <div className="mt-1.5 flex items-center gap-2">
                          <input
                            value={formData.bank_ifsc_code}
                            disabled={bankFieldsLocked}
                            onChange={(event) => {
                              resetBankVerificationForEdit({
                                bank_ifsc_code: event.target.value.toUpperCase(),
                              });
                            }}
                            className="w-full bg-transparent text-sm font-black text-[#2C1A0E] outline-none disabled:text-[#8B7355]"
                            placeholder="MAHB0002233"
                          />
                          {ifscLookup.status === "loading" ? <Loader2 size={15} className="animate-spin text-[#B8641A]" /> : null}
                        </div>
                      </Field>
                      <Field
                        label="Bank Name"
                        value={formData.bank_name}
                        onChange={(value) => setField("bank_name", value)}
                        disabled={ifscLookup.status === "valid"}
                        hint={ifscLookup.status === "valid" ? "Auto-detected from IFSC" : ""}
                      />
                      <Field
                        label="Bank Branch"
                        value={formData.bank_branch}
                        onChange={(value) => setField("bank_branch", value)}
                        disabled={ifscLookup.status === "valid"}
                        hint={ifscLookup.status === "valid" ? "Auto-detected from IFSC" : ""}
                      />
                      <Field
                        label="UPI ID"
                        value={formData.upi_id}
                        onChange={(value) => setField("upi_id", value)}
                        disabled={Boolean(formData.vpa_verified) && !bankEditMode}
                        hint={formData.vpa_verified ? "Detected and verified by provider" : "Manual entry is allowed if no linked UPI is returned"}
                      />
                    </div>
                    <div className="mt-3 rounded-[18px] border border-[#E5D9C7] bg-[#FFFDF8] p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          {ifscLookup.status === "loading" ? (
                            <ValidationBadge tone="info"><Loader2 size={11} className="animate-spin" /> Checking IFSC</ValidationBadge>
                          ) : ifscLookup.status === "valid" ? (
                            <>
                              <ValidationBadge tone="success"><CheckCircle2 size={11} /> Valid IFSC</ValidationBadge>
                              <ValidationBadge tone="success"><Landmark size={11} /> Branch Found</ValidationBadge>
                            </>
                          ) : ifscLookup.status === "invalid" ? (
                            <ValidationBadge tone="error">Invalid IFSC</ValidationBadge>
                          ) : ifscLookup.status === "error" ? (
                            <ValidationBadge tone="error">{ifscLookup.message || "Bank Not Found"}</ValidationBadge>
                          ) : (
                            <ValidationBadge>Enter IFSC</ValidationBadge>
                          )}

                          {bankVerification.status === "loading" ? (
                            <ValidationBadge tone="info"><Loader2 size={11} className="animate-spin" /> Verifying Account</ValidationBadge>
                          ) : bankVerification.status === "verified" || formData.bank_verified ? (
                            <ValidationBadge tone="success"><ShieldCheck size={11} /> Bank Verified</ValidationBadge>
                          ) : bankVerification.status === "warning" ? (
                            <ValidationBadge tone="warning">
                              {bankVerification.data?.nameMatchStatus === "PARTIAL_MATCH" ? "Partial Match" : "Verification Failed"}
                            </ValidationBadge>
                          ) : bankVerification.status === "error" ? (
                            <ValidationBadge tone="error">{bankVerification.message || "Verification Failed"}</ValidationBadge>
                          ) : (
                            <ValidationBadge>Account Not Verified</ValidationBadge>
                          )}

                          {formData.vpa_verified ? (
                            <ValidationBadge tone="success">UPI Detected</ValidationBadge>
                          ) : formData.vpa_detected ? (
                            <ValidationBadge tone="warning">UPI Detection Pending</ValidationBadge>
                          ) : (
                            <ValidationBadge tone="neutral">UPI Manual Fallback</ValidationBadge>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {bankFieldsLocked ? (
                            <button
                              type="button"
                              onClick={handleEnterBankEditMode}
                              className="rounded-xl border border-[#E5D9C7] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#8B7355] transition hover:bg-[#FFF3E2]"
                            >
                              Change Details
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={handleRetryIfscLookup}
                            disabled={bankFieldsLocked || !isValidIfscFormat(formData.bank_ifsc_code) || ifscLookup.status === "loading"}
                            className="rounded-xl border border-[#E5D9C7] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#8B7355] transition hover:bg-[#FFF3E2] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Retry IFSC
                          </button>
                          <button
                            type="button"
                            onClick={handleVerifyBankAccount}
                            disabled={bankFieldsLocked || bankVerification.status === "loading"}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#2C1A0E] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#B8641A] disabled:cursor-not-allowed disabled:bg-[#D8C8B2]"
                          >
                            {bankVerification.status === "loading" ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                            {formData.verification_required ? "Reverify Account" : "Verify Bank"}
                          </button>
                        </div>
                      </div>

                      {ifscLookup.data ? (
                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs font-semibold text-[#6B5135] md:grid-cols-2">
                          <p>Address: {ifscLookup.data.address || "-"}</p>
                          <p>City/State: {[ifscLookup.data.city, ifscLookup.data.state].filter(Boolean).join(", ") || "-"}</p>
                          <p>MICR: {ifscLookup.data.micr || "-"}</p>
                          <p>Source: {ifscLookup.data.cached ? "Cache" : "Razorpay IFSC"}</p>
                        </div>
                      ) : null}

                      {bankVerification.data ? (
                        <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-[#F8F3EC] px-3 py-2 text-xs font-semibold text-[#5C3D1E] md:grid-cols-2">
                          <p>Provider: {bankVerification.data.provider || "local"}</p>
                          <p>Status: {bankVerification.data.status}</p>
                          <p>Name match: {Number(bankVerification.data.accountNameMatchScore || 0)}%</p>
                          <p>Account: {bankVerification.data.accountActive ? "Active" : "Not verified"}</p>
                          <p>Holder: {bankVerification.data.verifiedAccountHolderName || bankVerification.data.accountHolderName || "-"}</p>
                          <p>Detected UPI: {bankVerification.data.verifiedUpiId || "Not available"}</p>
                        </div>
                      ) : null}

                      {formData.verification_last_error && bankVerification.status !== "verified" ? (
                        <p className="mt-2 text-xs font-semibold text-amber-700">
                          {formData.verification_last_error}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#8B7355]">Payment Settings</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Field label="Payment Instructions" value={formData.payment_instructions} onChange={(value) => setField("payment_instructions", value)} className="md:col-span-2" />
                      <label className="flex items-center gap-3 rounded-[18px] border border-[#E5D9C7] bg-[#FFFDF8] px-3.5 py-2.5 text-sm font-bold text-[#5C3D1E]">
                        <input type="checkbox" checked={Boolean(formData.upi_qr_enabled)} onChange={(event) => setField("upi_qr_enabled", event.target.checked)} />
                        Enable UPI QR
                      </label>
                      <label className="flex items-center gap-3 rounded-[18px] border border-[#E5D9C7] bg-[#FFFDF8] px-3.5 py-2.5 text-sm font-bold text-[#5C3D1E]">
                        <input type="checkbox" checked={Boolean(formData.bank_transfer_enabled)} onChange={(event) => setField("bank_transfer_enabled", event.target.checked)} />
                        Enable bank transfer details
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-[#F2E8DB] px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl border border-[#E5D9C7] px-4 py-2.5 text-sm font-black text-[#8B7355] transition hover:bg-[#F8F3EC]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#B8641A] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#9E5415] disabled:cursor-not-allowed disabled:bg-[#D8C8B2]"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : null}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="fixed bottom-4 right-4 rounded-full border border-[#EDE8DF] bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#8B7355] shadow-lg">
          Loading profile
        </div>
      ) : null}
    </div>
  );
}
