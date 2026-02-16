import React, { useState, useEffect } from 'react';
import CustomerLayout from '../../components/customer/layouts/CustomerLayout';
import { useCustomerDashboard } from "../hooks/useCustomerDashboard";
import { Mail, Phone, MapPin, Edit, Camera, Loader2, Home } from 'lucide-react';

const Profile = () => {
  // 1. Get Data from Hook
  const { data: dashboardData, loading } = useCustomerDashboard();

  // 2. Local State for UI
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    farm: '',
    address: '', // Hook doesn't return this yet
    photo: null  // Hook doesn't return this yet
  });

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({});
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // 3. Sync Hook Data to Local State when it loads
  useEffect(() => {
    if (dashboardData?.customer) {
      const customer = dashboardData.customer;
      
      const mappedProfile = {
        name: customer.name || "Customer",
        email: customer.email || "",
        phone: customer.phone || "",
        farm: customer.dairy || "Not Assigned",
        address: "123 Dairy Lane (Update in Edit)", // Placeholder
        photo: null
      };

      setProfile(mappedProfile);
      setFormData(mappedProfile); // Initialize form with same data
    }
  }, [dashboardData]);

  // Handle File Input
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setPreviewPhoto(preview);
    setFormData({ ...formData, photo: file });
  };

  // Handle Save (Mock)
  const saveProfile = () => {
    // 🔗 TODO: Connect to backend update API here
    setProfile({
      ...formData,
      photo: previewPhoto || profile.photo
    });
    setShowModal(false);
  };

  // Loading State
  if (loading) {
    return (
      <CustomerLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="space-y-8 max-w-5xl">

        <h2 className="text-2xl font-bold text-gray-900">
          My Profile
        </h2>

        {/* Main Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">

          <div className="flex items-center gap-6">
            
            {/* Profile Photo */}
            <div className="relative">
              <img
                src={profile.photo || "https://ui-avatars.com/api/?name=" + (profile.name || "User") + "&background=random"}
                alt="profile"
                className="h-28 w-28 rounded-full object-cover border-4 border-gray-50 shadow-sm"
              />
              <label className="absolute bottom-1 right-1 bg-blue-600 text-white p-2 rounded-full shadow cursor-pointer hover:bg-blue-700 transition">
                <Camera size={14} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>
            </div>

            {/* Name & Dairy Info */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {profile.name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1 bg-gray-100 px-3 py-1 rounded-full w-fit">
                <Home size={14} />
                <span>Member of <strong>{profile.farm}</strong></span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setFormData(profile); // Reset form to current profile
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium shadow-sm shadow-blue-200"
          >
            <Edit size={16}/>
            Edit Profile
          </button>
        </div>

        {/* Info Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          <InfoCard
            icon={<Mail size={22}/>}
            label="Email Address"
            value={profile.email || "No Email Linked"}
            color="blue"
          />

          <InfoCard
            icon={<Phone size={22}/>}
            label="Phone Number"
            value={profile.phone}
            color="green"
          />

          <InfoCard
            icon={<MapPin size={22}/>}
            label="Delivery Address"
            value={profile.address}
            color="purple"
            full
          />
        </div>
      </div>

      {/* ========== EDIT MODAL ========== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            
            <div className="flex justify-between items-center border-b pb-3">
               <h3 className="text-xl font-bold text-gray-900">Edit Profile</h3>
               <button onClick={()=>setShowModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>

            {/* Photo Preview in Modal */}
            <div className="flex justify-center py-2">
              <div className="relative">
                <img
                  src={previewPhoto || profile.photo || "https://ui-avatars.com/api/?name=" + profile.name}
                  className="h-24 w-24 rounded-full object-cover border ring-2 ring-gray-100"
                  alt="preview"
                />
                <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:scale-110 transition">
                  <Camera size={14}/>
                  <input type="file" accept="image/*" hidden onChange={handlePhotoChange} />
                </label>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <Input 
                label="Full Name" 
                value={formData.name}
                onChange={(e)=>setFormData({...formData, name: e.target.value})} 
              />
              <Input 
                label="Email" 
                value={formData.email}
                onChange={(e)=>setFormData({...formData, email: e.target.value})} 
                disabled 
              />
              <Input 
                label="Phone Number" 
                value={formData.phone}
                onChange={(e)=>setFormData({...formData, phone: e.target.value})} 
              />
              <Input 
                label="Delivery Address" 
                value={formData.address}
                onChange={(e)=>setFormData({...formData, address: e.target.value})} 
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={()=>setShowModal(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                className="px-6 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium shadow-lg shadow-blue-100 transition"
              >
                Save Changes
              </button>
            </div>

          </div>
        </div>
      )}
    </CustomerLayout>
  );
};

export default Profile;

/* ===== Helper Components ===== */

const InfoCard = ({ icon, label, value, color, full }) => (
  <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-5 transition hover:shadow-md ${full ? 'md:col-span-2' : ''}`}>
    <div className={`bg-${color}-50 p-4 rounded-2xl text-${color}-600`}>
      {icon}
    </div>
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  </div>
);

const Input = ({ label, disabled, ...props }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 ml-1">{label}</label>
    <input
      {...props}
      disabled={disabled}
      className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
    />
  </div>
);