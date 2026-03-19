import React, { useEffect, useState } from "react";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import { useCustomerDashboard } from "../../hooks/useCustomerDashboard";
import { Mail, Phone, MapPin, Edit, Camera, Loader2, Home, X } from "lucide-react";
import {
  fetchCustomerProfile,
  getCachedCustomerDashboard,
  getCachedCustomerProfile,
  updateCustomerProfile,
} from "../../api/customer/customer.api.js";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const headingFont = { fontFamily: "'Lora', serif" };
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
      <div className="space-y-10 animate-in fade-in duration-500 lg:space-y-12" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">Profile Center</p>
            <h2 className="mt-2 text-[32px] font-semibold text-[#2C1A0E]" style={headingFont}>My <span className="text-[#B8641A]">Profile</span></h2>
          </div>
          <button 
            onClick={() => navigate("/customer/dashboard")} 
            className="text-sm font-bold text-[#B8641A] hover:underline"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Profile Header Card */}
        <div className="flex flex-col items-center justify-between gap-8 rounded-[32px] border border-[#EDE8DF] bg-[#F5F0E8] p-9 shadow-sm md:flex-row">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <img
                src={profile.photo || `https://ui-avatars.com/api/?name=${profile.name}&background=random`}
                alt="profile"
                className="h-28 w-28 rounded-full object-cover ring-4 ring-[#FFF8EC] shadow-md"
              />
            </div>
            <div>
              <h3 className="text-[30px] font-semibold text-[#2C1A0E]" style={headingFont}>{profile.name}</h3>
              <p className="mt-1 flex items-center gap-2 text-[#8B7355]">
                <Home size={14} className="text-[#B8641A]" /> Member of <span className="font-bold text-[#5C3D1E]">{profile.farm}</span>
              </p>
            </div>
          </div>
          <button onClick={() => { setFormData(profile); setShowModal(true); }} className="flex items-center gap-2 rounded-[16px] bg-[#2C2416] px-8 py-3 font-bold text-white shadow-lg transition hover:bg-[#4A3820]">
            <Edit size={18} /> Edit Profile
          </button>
        </div>

        <div className="grid gap-7 md:grid-cols-2">
          <InfoCard icon={<Mail />} label="Email" value={profile.email} />
          <InfoCard icon={<Phone />} label="Phone" value={profile.phone} />
          <InfoCard icon={<MapPin />} label="Address" value={profile.address} full />
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[36px] border border-[#EDE8DF] bg-[#FFFDF7] shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#F2EDE4] bg-[#FBF7F0] p-8">
              <h3 className="text-xl font-semibold text-[#2C1A0E]" style={headingFont}>Edit Details</h3>
              <button onClick={() => setShowModal(false)} className="rounded-full border border-[#EDE8DF] p-2 transition-colors hover:bg-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* Profile Photo Section */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <img
                    src={previewPhoto || profile.photo || `https://ui-avatars.com/api/?name=${profile.name}`}
                    className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-md ring-2 ring-[#FDE9C9]"
                    alt="preview"
                  />
                  <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-[#B8641A] p-2 text-white shadow-lg transition hover:scale-110">
                    <Camera size={14} />
                    <input type="file" accept="image/*" hidden onChange={handlePhotoChange} />
                  </label>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">Change Profile Photo</p>
              </div>

              <div className="space-y-4">
                 <Input label="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                 <Input label="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                 <div className="grid grid-cols-2 gap-4">
                    <Input label="Building" value={formData.buildingName} onChange={e => setFormData({...formData, buildingName: e.target.value})} />
                    <Input label="Room No" value={formData.roomNo} onChange={e => setFormData({...formData, roomNo: e.target.value})} />
                 </div>
              </div>

              <button 
                onClick={saveProfile} 
                disabled={saving} 
                className="mt-4 w-full rounded-[18px] bg-[#B8641A] py-4 font-bold text-white shadow-xl shadow-[#F2D9B8] transition-all active:scale-[0.98] disabled:bg-[#CDB8A0]"
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
  <div className={`flex items-center gap-4 rounded-[24px] border border-[#EDE8DF] bg-[#FFFDF7] p-6 shadow-sm ${full ? "md:col-span-2" : ""}`}>
    <div className="rounded-[16px] bg-[#FFF4E2] p-3 text-[#B8641A]">{icon}</div>
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">{label}</p>
      <p className="text-lg font-bold text-[#2C1A0E]">{value}</p>
    </div>
  </div>
);

const Input = ({ label, ...props }) => (
  <div className="space-y-1">
    <label className="ml-1 text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">{label}</label>
    <input {...props} className="w-full rounded-[18px] border border-[#EDE8DF] bg-[#FBF7F0] p-4 outline-none focus:ring-2 focus:ring-[#D4B896]" />
  </div>
);

export default CustomerProfile;
