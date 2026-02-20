import React, { useEffect, useState } from "react";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import { useCustomerDashboard } from "../../hooks/useCustomerDashboard";
import { Mail, Phone, MapPin, Edit, Camera, Loader2, Home, X } from "lucide-react";
import { fetchCustomerProfile, updateCustomerProfile } from "../../api/customer.api";
import toast from "react-hot-toast";

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
  const { data: dashboardData, loading: dashboardLoading } = useCustomerDashboard();

  const [profile, setProfile] = useState({
    name: "", email: "", phone: "", farm: "",
    buildingName: "", wing: "", roomNo: "", address: "", photo: null,
  });

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({});
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 1. Load Profile Data
  useEffect(() => {
    if (dashboardLoading) return;

    const loadProfile = async () => {
      try {
        setProfileLoading(true);
        // ✅ Interceptor handles the token automatically
        const apiProfile = await fetchCustomerProfile(); 
        const mapped = mapApiProfileToUi(apiProfile, dashboardData?.customer?.dairy);
        setProfile(mapped);
        setFormData(mapped);
      } catch (error) {
        console.error("Profile load error:", error);
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [dashboardLoading, dashboardData]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreviewPhoto(URL.createObjectURL(file));
    setFormData({ ...formData, photo: file });
  };

  // 2. Save Profile Logic
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

      // ✅ FIX: Removed manual token argument
      await updateCustomerProfile(payload); 
      
      const latest = await fetchCustomerProfile();
      const mapped = mapApiProfileToUi(latest, dashboardData?.customer?.dairy || profile.farm);

      setProfile(mapped);
      setShowModal(false);
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(error?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (dashboardLoading || profileLoading) {
    return <CustomerLayout><div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div></CustomerLayout>;
  }

  return (
    <CustomerLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
        <h2 className="text-2xl font-bold text-slate-900">My Profile</h2>

        <div className="bg-white rounded-[32px] shadow-sm border p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <img
                src={profile.photo || `https://ui-avatars.com/api/?name=${profile.name}&background=random`}
                alt="profile"
                className="h-28 w-28 rounded-full object-cover ring-4 ring-slate-50 shadow-md"
              />
              <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:scale-110 transition shadow-lg">
                <Camera size={16} />
                <input type="file" hidden onChange={handlePhotoChange} />
              </label>
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900">{profile.name}</h3>
              <p className="text-slate-500 flex items-center gap-2 mt-1">
                <Home size={14} className="text-blue-500" /> Member of <span className="font-bold text-slate-700">{profile.farm}</span>
              </p>
            </div>
          </div>
          <button onClick={() => { setFormData(profile); setShowModal(true); }} className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition shadow-lg">
            <Edit size={18} /> Edit Profile
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <InfoCard icon={<Mail />} label="Email" value={profile.email} />
          <InfoCard icon={<Phone />} label="Phone" value={profile.phone} />
          <InfoCard icon={<MapPin />} label="Address" value={profile.address} full />
        </div>
      </div>

  {showModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
    <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
      <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
        <h3 className="text-xl font-bold">Edit Profile</h3>
        <button onClick={() => setShowModal(false)} className="p-2 border rounded-full hover:bg-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="p-8 space-y-6">
        {/* ✅ PHOTO UPDATE FIELD RE-ADDED HERE */}
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative group">
            <img
              src={previewPhoto || profile.photo || `https://ui-avatars.com/api/?name=${profile.name}`}
              className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-md ring-2 ring-blue-100"
              alt="preview"
            />
            <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:scale-110 transition shadow-lg">
              <Camera size={14} />
              <input type="file" accept="image/*" hidden onChange={handlePhotoChange} />
            </label>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tap icon to change photo</p>
        </div>

        <div className="space-y-4">
          <Input label="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          <Input label="Phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
          
          <div className="grid grid-cols-2 gap-4">
            <Input label="Building" value={formData.buildingName} onChange={e => setFormData({ ...formData, buildingName: e.target.value })} />
            <Input label="Room No" value={formData.roomNo} onChange={e => setFormData({ ...formData, roomNo: e.target.value })} />
          </div>
        </div>

        <button 
          onClick={saveProfile} 
          disabled={saving} 
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-100 mt-4 disabled:bg-slate-300 transition-all active:scale-[0.98]"
        >
          {saving ? "Uploading Data..." : "Save Changes"}
        </button>
      </div>
    </div>
  </div>
)}
    </CustomerLayout>
  );
};

// Sub-components
const InfoCard = ({ icon, label, value, full }) => (
  <div className={`bg-white p-6 rounded-3xl border shadow-sm flex items-center gap-4 ${full ? "md:col-span-2" : ""}`}>
    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">{icon}</div>
    <div>
      <p className="text-[10px] uppercase font-bold text-slate-400">{label}</p>
      <p className="text-lg font-bold text-slate-800">{value}</p>
    </div>
  </div>
);

const Input = ({ label, ...props }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-slate-500 uppercase ml-1">{label}</label>
    <input {...props} className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" />
  </div>
);

export default CustomerProfile; // ✅ Matches Filename