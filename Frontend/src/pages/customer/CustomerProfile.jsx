import React, { useState } from 'react';
import CustomerLayout from '../../components/customer/layouts/CustomerLayout';
import { Mail, Phone, MapPin, Edit, Camera } from 'lucide-react';

const MOCK_PROFILE = {
  name: 'Rahul Sharma',
  email: 'rahul@gmail.com',
  phone: '9876543210',
  address: 'Flat 203, Nandanvan Society, Narhe, Pune',
  farm: 'Nandanvan Farms',
  photo: null // later from backend
};

const Profile = () => {

  const [profile, setProfile] = useState(MOCK_PROFILE);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(MOCK_PROFILE);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setPreviewPhoto(preview);

    setFormData({
      ...formData,
      photo: file
    });
  };

  const saveProfile = () => {
    // Later connect backend API here
    setProfile({
      ...formData,
      photo: previewPhoto || profile.photo
    });
    setShowModal(false);
  };

  return (
    <CustomerLayout>
      <div className="space-y-8 max-w-5xl">

        <h2 className="text-2xl font-bold text-gray-900">
          Profile
        </h2>

        {/* Main Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">

          <div className="flex items-center gap-6">

            {/* Profile Photo */}
            <div className="relative">

              <img
                src={
                  profile.photo ||
                  "https://via.placeholder.com/150"
                }
                alt="profile"
                className="h-28 w-28 rounded-full object-cover border"
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

            {/* Name */}
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">
                {profile.name}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Member of {profile.farm}
              </p>
            </div>

          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium"
          >
            <Edit size={16}/>
            Update Profile
          </button>

        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-6">

          <InfoCard
            icon={<Mail size={22}/>}
            label="Email Address"
            value={profile.email}
            color="blue"
          />

          <InfoCard
            icon={<Phone size={22}/>}
            label="Phone Number"
            value={`+91 ${profile.phone}`}
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">

          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5">

            <h3 className="text-xl font-semibold text-gray-900">
              Update Profile
            </h3>

            {/* Photo Preview */}
            <div className="flex justify-center">

              <div className="relative">

                <img
                  src={previewPhoto || profile.photo || "https://via.placeholder.com/150"}
                  className="h-24 w-24 rounded-full object-cover border"
                  alt="preview"
                />

                <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer">
                  <Camera size={14}/>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handlePhotoChange}
                  />
                </label>

              </div>

            </div>

            {/* Form */}
            <div className="space-y-4">

              <Input label="Name" value={formData.name}
                onChange={(e)=>setFormData({...formData,name:e.target.value})} />

              <Input label="Email" value={formData.email}
                onChange={(e)=>setFormData({...formData,email:e.target.value})} />

              <Input label="Phone" value={formData.phone}
                onChange={(e)=>setFormData({...formData,phone:e.target.value})} />

              <Input label="Address" value={formData.address}
                onChange={(e)=>setFormData({...formData,address:e.target.value})} />

            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">

              <button
                onClick={()=>setShowModal(false)}
                className="px-4 py-2 rounded-xl border text-gray-600 hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>

              <button
                onClick={saveProfile}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
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


/* ===== Components ===== */

const InfoCard = ({ icon, label, value, color, full }) => (
  <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4 ${full ? 'md:col-span-2' : ''}`}>
    <div className={`bg-${color}-50 p-3 rounded-xl text-${color}-600`}>
      {icon}
    </div>
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  </div>
);

const Input = ({ label, ...props }) => (
  <div>
    <label className="block text-sm text-gray-600 mb-1">{label}</label>
    <input
      {...props}
      className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);
