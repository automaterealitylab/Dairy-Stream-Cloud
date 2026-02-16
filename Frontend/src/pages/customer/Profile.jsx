import React, { useEffect, useState } from 'react';
import CustomerLayout from '../../layouts/CustomerLayout';
import { Mail, Phone, MapPin, Edit, Camera } from 'lucide-react';
import { fetchCustomerProfile, updateCustomerProfile } from '../../api/customer.api.js';

const getAuthToken = () => {
  const storedUser = localStorage.getItem('user');
  const parsed = storedUser ? JSON.parse(storedUser) : null;
  return parsed?.token || localStorage.getItem('token') || null;
};

const toUiProfile = (record) => {
  if (!record) {
    return {
      name: '-',
      email: '-',
      phone: '-',
      buildingName: '',
      wing: '',
      roomNo: '',
      address: '-',
      farm: 'Not assigned',
      photoUrl: '',
    };
  }

  const building = record.building_name || '';
  const wing = record.wing || '';
  const roomNo = record.room_no || '';
  const address = [building, wing && `Wing ${wing}`, roomNo && `Room ${roomNo}`]
    .filter(Boolean)
    .join(', ');

  return {
    name: record.customer_name || record.name || '-',
    email: record.email || '-',
    phone: record.phone_number || record.phone || '-',
    buildingName: building,
    wing,
    roomNo,
    address: address || '-',
    farm: record.member_of_dairy || record.dairy_name || 'Not assigned',
    photoUrl: record.profile_photo_url || '',
  };
};

const toPayload = (formData) => ({
  customer_name: formData.name?.trim() || null,
  email: formData.email?.trim() || null,
  phone_number: formData.phone?.trim() || null,
  building_name: formData.buildingName?.trim() || null,
  wing: formData.wing?.trim() || null,
  room_no: formData.roomNo?.trim() || null,
  photoFile: formData.photoFile || null,
});

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [photoPreview, setPhotoPreview] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const token = getAuthToken();
        if (!token) throw new Error('Customer token missing');

        const data = await fetchCustomerProfile(token);
        const mapped = toUiProfile(data);
        setProfile(mapped);
        setFormData(mapped);
        setPhotoPreview(mapped.photoUrl || '');
      } catch (err) {
        setError(err?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const saveProfile = async () => {
    if (!formData) return;

    setSaving(true);
    setError('');
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Customer token missing');

      const result = await updateCustomerProfile(token, toPayload(formData));
      const mapped = toUiProfile(result?.data || result);
      setProfile(mapped);
      setFormData(mapped);
      setPhotoPreview(mapped.photoUrl || '');
      setShowModal(false);
    } catch (err) {
      setError(err?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <CustomerLayout>
        <div className="py-16 text-center text-gray-500">Loading profile...</div>
      </CustomerLayout>
    );
  }

  if (!profile) {
    return (
      <CustomerLayout>
        <div className="py-16 text-center text-red-500">{error || 'Profile not found'}</div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="space-y-8 max-w-5xl">
        <h2 className="text-2xl font-bold text-gray-900">Profile</h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-6">
            <img
              src={profile.photoUrl || "https://via.placeholder.com/150"}
              alt="profile"
              className="h-28 w-28 rounded-full object-cover border"
            />

            <div>
              <h3 className="text-2xl font-semibold text-gray-900">{profile.name}</h3>
              <p className="text-sm text-gray-500 mt-1">Member of {profile.farm}</p>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium"
          >
            <Edit size={16} />
            Update Profile
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <InfoCard icon={<Mail size={22} />} label="Email Address" value={profile.email} color="blue" />

          <InfoCard icon={<Phone size={22} />} label="Phone Number" value={profile.phone} color="green" />

          <InfoCard icon={<MapPin size={22} />} label="Delivery Address" value={profile.address} color="purple" full />
        </div>
      </div>

      {showModal && formData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5">
            <h3 className="text-xl font-semibold text-gray-900">Update Profile</h3>

            <div className="flex justify-center">
              <div className="relative">
                <img
                  src={photoPreview || formData.photoUrl || "https://via.placeholder.com/150"}
                  className="h-24 w-24 rounded-full object-cover border"
                  alt="preview"
                />
                <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer">
                  <Camera size={14} />
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const preview = URL.createObjectURL(file);
                      setPhotoPreview(preview);
                      setFormData({ ...formData, photoFile: file });
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <Input
                label="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />

              <Input
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />

              <Input
                label="Building Name"
                value={formData.buildingName}
                onChange={(e) => setFormData({ ...formData, buildingName: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Wing"
                  value={formData.wing}
                  onChange={(e) => setFormData({ ...formData, wing: e.target.value })}
                />

                <Input
                  label="Room No"
                  value={formData.roomNo}
                  onChange={(e) => setFormData({ ...formData, roomNo: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl border text-gray-600 hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>

              <button
                onClick={saveProfile}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
};

export default Profile;

const InfoCard = ({ icon, label, value, color, full }) => {
  const tone = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4 ${full ? 'md:col-span-2' : ''}`}>
      <div className={`${tone[color] || tone.blue} p-3 rounded-xl`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-lg font-semibold text-gray-900 mt-1">{value || '-'}</p>
      </div>
    </div>
  );
};

const Input = ({ label, ...props }) => (
  <div>
    <label className="block text-sm text-gray-600 mb-1">{label}</label>
    <input
      {...props}
      className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);
