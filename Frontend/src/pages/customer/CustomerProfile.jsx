import React, { useEffect, useState } from "react";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import { useCustomerDashboard } from "../../hooks/useCustomerDashboard";
import { Mail, Phone, MapPin, Edit, Camera, Loader2, Home, X, ChevronLeft } from "lucide-react";
import {
  fetchCustomerProfile,
  getCachedCustomerDashboard,
  getCachedCustomerProfile,
  updateCustomerProfile,
} from "../../api/customer/customer.api.js";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const headingFont = { fontFamily: "'Lora', serif" };

const formatMemberSince = (value) => {
  if (!value) return "Member since recently";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Member since recently";
  return `Member since ${parsed.getFullYear()}`;
};

const getInitials = (name = "") => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "C";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
};
const EMPTY_PROFILE = {
  name: "",
  email: "",
  phone: "",
  farm: "",
  buildingName: "",
  wing: "",
  roomNo: "",
  address: "",
  photo: null,
};

const mapApiProfileToUi = (apiProfile = {}, dairyFallback = "") => {
  const address = [apiProfile.building_name, apiProfile.wing, apiProfile.room_no]
    .filter(Boolean)
    .join(", ");

  return {
    name: apiProfile.customer_name || apiProfile.name || "Customer",
    email: apiProfile.email || "",
    phone: apiProfile.phone_number || apiProfile.phone || "",
    farm: apiProfile.member_of_dairy || dairyFallback || "Not Assigned",
    buildingName: apiProfile.building_name || "",
    wing: apiProfile.wing || "",
    roomNo: apiProfile.room_no || "",
    address: address || "Address not set",
    photo: apiProfile.profile_photo_url || null,
    memberSince: formatMemberSince(apiProfile.date_joined || apiProfile.created_at),
  };
};

const CustomerProfile = () => {
  const navigate = useNavigate();
  const { data: dashboardData, loading: dashboardLoading } = useCustomerDashboard();
  const cachedDashboardData = getCachedCustomerDashboard();
  const cachedProfileData = getCachedCustomerProfile();
  const initialProfile = cachedProfileData
    ? mapApiProfileToUi(cachedProfileData, cachedDashboardData?.customer?.dairy)
    : EMPTY_PROFILE;

  const [profile, setProfile] = useState(initialProfile);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(initialProfile);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [profileLoading, setProfileLoading] = useState(() => !cachedProfileData);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dashboardLoading && !dashboardData && !cachedDashboardData && !cachedProfileData) return;

    let cancelled = false;

    const loadProfile = async () => {
      try {
        if (!getCachedCustomerProfile()) {
          setProfileLoading(true);
        }

        const dairyFallback =
          dashboardData?.customer?.dairy ||
          cachedDashboardData?.customer?.dairy ||
          profile.farm;
        const apiProfile = await fetchCustomerProfile();
        const mapped = mapApiProfileToUi(apiProfile, dairyFallback);

        if (!cancelled) {
          setProfile(mapped);
          setFormData(mapped);
        }
      } catch (error) {
        console.error("Profile load error:", error);
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [dashboardLoading, dashboardData, cachedDashboardData, cachedProfileData, profile.farm]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreviewPhoto(URL.createObjectURL(file));
    setFormData({ ...formData, photo: file });
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        customer_name: formData.name,
        email: formData.email,
        phone_number: formData.phone,
        building_name: formData.buildingName,
        wing: formData.wing,
        room_no: formData.roomNo,
      };

      if (formData.photo instanceof File) {
        payload.photoFile = formData.photo;
      }

      await updateCustomerProfile(payload); 
      
      const latest = await fetchCustomerProfile();
      const mapped = mapApiProfileToUi(latest, dashboardData?.customer?.dairy || profile.farm);

      setProfile(mapped);
      setPreviewPhoto(null);
      setShowModal(false);
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(error?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const hasVisibleProfile = Boolean(
    profile.name || profile.email || profile.phone || profile.address || profile.photo || profile.farm
  );

  if ((dashboardLoading && !dashboardData && !cachedDashboardData) || (profileLoading && !hasVisibleProfile)) {
    return (
      <CustomerLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="animate-spin text-[#B8641A]" size={40} />
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="mx-auto max-w-5xl space-y-5 animate-in fade-in duration-500 sm:space-y-6 lg:space-y-7" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">Profile Center</p>
            <h2 className="mt-1.5 text-[24px] font-semibold text-[#2C1A0E] sm:mt-2 sm:text-[36px]" style={headingFont}>My <span className="text-[#B8641A]">Profile</span></h2>
          </div>
          <button 
            onClick={() => navigate("/customer/dashboard")} 
            className="inline-flex items-center gap-2 self-start text-sm font-medium text-[#8B7355] transition hover:text-[#5C3D1E]"
          >
            <ChevronLeft size={16} />
            Back to Dashboard
          </button>
        </div>

        <div className="rounded-[24px] border border-[#E8DED1] bg-white p-4 shadow-[0_12px_30px_rgba(84,52,16,0.04)] sm:rounded-[28px] sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="relative mx-auto sm:mx-0">
                {profile.photo ? (
                  <img
                    src={profile.photo}
                    alt="profile"
                    className="h-20 w-20 rounded-full object-cover ring-4 ring-[#FFF3CC] shadow-sm sm:h-28 sm:w-28"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-[#F7D36D] bg-[#FFF3CC] text-[30px] font-semibold text-[#A85012] sm:h-28 sm:w-28 sm:text-[40px]">
                    {getInitials(profile.name)}
                  </div>
                )}
                <span className="absolute bottom-2 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#11B89A]" />
              </div>

              <div className="min-w-0 text-center sm:text-left">
                <h3 className="break-words text-[24px] font-semibold leading-tight text-[#18120F] sm:text-[40px]" style={headingFont}>
                  {profile.name}
                </h3>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="rounded-full border border-[#F2CF73] bg-[#FFF3CC] px-3 py-1 text-xs font-medium text-[#B05D15] sm:px-4 sm:text-sm">
                    Member of {profile.farm}
                  </span>
                  <span className="text-sm text-[#B1A193]">{profile.memberSince}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => { setFormData(profile); setShowModal(true); }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#1D1815] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#342B25] sm:w-auto sm:rounded-[16px] sm:px-6 sm:text-base"
            >
              <Edit size={18} />
              Edit Profile
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
          <InfoCard icon={<Mail />} label="Email" value={profile.email} />
          <InfoCard icon={<Phone />} label="Phone" value={profile.phone} />
          <InfoCard icon={<MapPin />} label="Delivery Address" value={profile.address} full />
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex h-[100svh] w-full max-w-lg flex-col overflow-hidden rounded-none border border-[#EDE8DF] bg-[#FFFDF7] shadow-[0_28px_80px_rgba(44,26,14,0.22)] animate-in zoom-in-95 sm:h-auto sm:rounded-[28px]">
            <div className="flex items-center justify-between border-b border-[#F2EDE4] bg-[#FBF7F0] px-4 py-3 sm:px-7 sm:py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">Profile Editor</p>
                <h3 className="mt-1 text-[20px] font-semibold text-[#2C1A0E] sm:text-[22px]" style={headingFont}>Edit Details</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="rounded-full border border-[#EDE8DF] bg-white p-2 text-[#5C3D1E] transition-colors hover:bg-[#FBF7F0]">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-4 py-4 sm:px-7 sm:py-5">
              {/* Profile Photo Section */}
              <div className="flex flex-col items-center gap-2 py-0">
                <div className="relative group">
                  <img
                    src={previewPhoto || profile.photo || `https://ui-avatars.com/api/?name=${profile.name}`}
                    className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-md ring-2 ring-[#FDE9C9] sm:h-28 sm:w-28"
                    alt="preview"
                  />
                  <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-[#B8641A] p-2 text-white shadow-lg transition hover:scale-110">
                    <Camera size={14} />
                    <input type="file" accept="image/*" hidden onChange={handlePhotoChange} />
                  </label>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">Change Profile Photo</p>
              </div>

              <div className="space-y-3">
                 <Input label="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                 <Input label="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                 <Input label="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                 <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Building" value={formData.buildingName} onChange={e => setFormData({...formData, buildingName: e.target.value})} />
                    <Input label="Room No" value={formData.roomNo} onChange={e => setFormData({...formData, roomNo: e.target.value})} />
                 </div>
              </div>
            </div>

            <div className="border-t border-[#F2EDE4] bg-[#FFFDF7] px-4 py-3 sm:px-7 sm:py-4">
              <button 
                onClick={saveProfile} 
                disabled={saving} 
                className="w-full rounded-[16px] bg-[#B8641A] py-3 font-bold text-white shadow-xl shadow-[#F2D9B8] transition-all active:scale-[0.98] disabled:bg-[#CDB8A0]"
              >
                {saving ? "Saving Changes..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
};

const InfoCard = ({ icon, label, value, full }) => (
  <div className={`flex items-center gap-3 rounded-[20px] border border-[#E8DED1] bg-white p-4 shadow-[0_10px_24px_rgba(84,52,16,0.035)] sm:gap-4 sm:rounded-[22px] sm:p-5 ${full ? "md:col-span-2" : ""}`}>
    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[13px] bg-[#FFF1C4] text-[#C85C16] sm:h-12 sm:w-12 sm:rounded-[14px]">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#B1A193]">{label}</p>
      <p className="mt-0.5 break-words text-[15px] font-semibold text-[#1F1713] sm:text-[16px]">{value}</p>
    </div>
  </div>
);

const Input = ({ label, ...props }) => (
  <div className="space-y-1">
    <label className="ml-1 text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">{label}</label>
    <input {...props} className="w-full rounded-[18px] border border-[#EDE8DF] bg-[#FBF7F0] px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#D4B896]" />
  </div>
);

export default CustomerProfile;
