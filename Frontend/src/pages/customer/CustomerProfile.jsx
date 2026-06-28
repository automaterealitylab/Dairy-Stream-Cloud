import React, { useEffect, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import { useCustomerDashboard } from "../../hooks/useCustomerDashboard";
import { Mail, Phone, MapPin, Edit, Camera, Loader2, X, LocateFixed } from "lucide-react";
import {
  fetchCustomerProfile,
  getCachedCustomerDashboard,
  getCachedCustomerProfile,
  updateCustomerProfile,
} from "../../api/customer/customer.api.js";
import { buildCustomerAddress } from "../../utils/customerAddress.js";
import toast from "react-hot-toast";
import { useGeolocationAutoRetry } from "../../hooks/useGeolocationAutoRetry.js";

const headingFont = { fontFamily: "'Lora', serif" };
const DEFAULT_MAP_CENTER = [18.5204, 73.8567];
const customerPinIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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

const getCoordinateValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(6)) : null;
};

const getCoordinatePair = (latitude, longitude) => {
  const lat = getCoordinateValue(latitude);
  const lng = getCoordinateValue(longitude);
  return lat !== null && lng !== null ? [lat, lng] : null;
};

const getLocationPinLabel = (latitude, longitude) =>
  getCoordinatePair(latitude, longitude) ? "Exact map pin saved" : "Exact map pin not added yet";

const MapViewUpdater = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    if (Array.isArray(center) && center.length === 2) {
      map.flyTo(center, map.getZoom(), {
        animate: true,
        duration: 1,
      });
    }
  }, [center, map]);

  return null;
};

const MapPinSelector = ({ onSelect }) => {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
};

const EMPTY_PROFILE = {
  name: "",
  email: "",
  phone: "",
  farm: "",
  addressLine1: "",
  addressLine2: "",
  buildingName: "",
  wing: "",
  roomNo: "",
  address: "",
  latitude: null,
  longitude: null,
  pinLabel: "Exact map pin not added yet",
  photo: null,
  memberSince: "Member since recently",
};

const mapApiProfileToUi = (apiProfile = {}, dairyFallback = "") => {
  const coordinates = getCoordinatePair(apiProfile.latitude, apiProfile.longitude);

  return {
    name: apiProfile.customer_name || apiProfile.name || "Customer",
    email: apiProfile.email || "",
    phone: apiProfile.phone_number || apiProfile.phone || "",
    farm: apiProfile.member_of_dairy || dairyFallback || "Not Assigned",
    addressLine1: apiProfile.address_line_1 || apiProfile.addressLine1 || "",
    addressLine2: apiProfile.address_line_2 || apiProfile.addressLine2 || "",
    buildingName: apiProfile.building_name || apiProfile.buildingName || "",
    wing: apiProfile.wing || "",
    roomNo: apiProfile.room_no || apiProfile.roomNo || "",
    address: buildCustomerAddress(apiProfile) || "Address not set",
    latitude: coordinates?.[0] ?? null,
    longitude: coordinates?.[1] ?? null,
    pinLabel: getLocationPinLabel(apiProfile.latitude, apiProfile.longitude),
    photo: apiProfile.profile_photo_url || null,
    memberSince: formatMemberSince(apiProfile.date_joined || apiProfile.created_at),
  };
};

const CustomerProfile = () => {
  const { data: dashboardData, loading: dashboardLoading } = useCustomerDashboard();
  const cachedDashboardData = getCachedCustomerDashboard();
  const cachedProfileData = getCachedCustomerProfile();
  const initialProfile = cachedProfileData
    ? mapApiProfileToUi(cachedProfileData, cachedDashboardData?.customer?.dairy)
    : EMPTY_PROFILE;

  const [profile, setProfile] = useState(initialProfile);
  const [showModal, setShowModal] = useState(false);
  const [editorMode, setEditorMode] = useState("profile");
  const [formData, setFormData] = useState(initialProfile);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [profileLoading, setProfileLoading] = useState(() => !cachedProfileData);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(
    () => getCoordinatePair(initialProfile.latitude, initialProfile.longitude) || DEFAULT_MAP_CENTER
  );
  const activeDairyName = dashboardData?.customer?.dairy || cachedDashboardData?.customer?.dairy || initialProfile.farm;

  useEffect(() => {
    if (dashboardLoading && !dashboardData && !cachedDashboardData && !cachedProfileData) return;

    let cancelled = false;

    const loadProfile = async () => {
      try {
        if (!getCachedCustomerProfile()) {
          setProfileLoading(true);
        }

        const dairyFallback =
          activeDairyName || profile.farm;
        const apiProfile = await fetchCustomerProfile();
        const mapped = mapApiProfileToUi(apiProfile, dairyFallback);

        if (!cancelled) {
          setProfile(mapped);
          if (!showModal) {
            setFormData(mapped);
          }
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
  }, [dashboardLoading, dashboardData, cachedDashboardData, cachedProfileData, activeDairyName, profile.farm, showModal]);

  useEffect(() => {
    if (!previewPhoto || !previewPhoto.startsWith("blob:")) return undefined;
    return () => URL.revokeObjectURL(previewPhoto);
  }, [previewPhoto]);

  useEffect(() => {
    if (!showModal) return;

    const selectedPin = getCoordinatePair(formData.latitude, formData.longitude);
    setGpsLocation(null);
    setMapCenter(selectedPin || DEFAULT_MAP_CENTER);
    detectCurrentLocation({ showToast: false, pinIfMissing: false, centerOnGps: false });
  }, [showModal]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreviewPhoto(URL.createObjectURL(file));
    setFormData((prev) => ({ ...prev, photo: file }));
  };

  const openEditModal = () => {
    setPreviewPhoto(null);
    setGpsLocation(null);
    setFormData(profile);
    setMapCenter(getCoordinatePair(profile.latitude, profile.longitude) || DEFAULT_MAP_CENTER);
    setEditorMode("profile");
    setShowModal(true);
  };

  const openAddressModal = () => {
    setPreviewPhoto(null);
    setGpsLocation(null);
    setFormData(profile);
    setMapCenter(getCoordinatePair(profile.latitude, profile.longitude) || DEFAULT_MAP_CENTER);
    setEditorMode("address");
    setShowModal(true);
  };

  const closeEditModal = () => {
    setShowModal(false);
    setEditorMode("profile");
    setPreviewPhoto(null);
    setGpsLocation(null);
  };

  const setPinnedLocation = (latitude, longitude) => {
    const coordinates = getCoordinatePair(latitude, longitude);
    if (!coordinates) return;

    const [lat, lng] = coordinates;
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
    setMapCenter([lat, lng]);
  };

  const detectCurrentLocation = ({
    showToast = true,
    pinIfMissing = true,
    centerOnGps = true,
  } = {}) => {
    if (!navigator.geolocation) {
      const message = "GPS location is not supported in this browser";
      if (showToast) toast.error(message);
      return;
    }

    const hasPinnedLocation = Boolean(getCoordinatePair(formData.latitude, formData.longitude));
    const toastId = showToast ? toast.loading("Getting your current location...") : null;

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));

        setGpsLocation({ lat, lng });

        if (pinIfMissing || !hasPinnedLocation) {
          setPinnedLocation(lat, lng);
        } else if (centerOnGps) {
          setMapCenter([lat, lng]);
        }

        setLocating(false);

        if (showToast) {
          toast.success("Current location captured", { id: toastId });
        }
      },
      (geoError) => {
        let message = "Unable to fetch your current location";

        if (geoError?.code === 1) {
          message = "Location permission denied. Please allow GPS access and try again.";
        } else if (geoError?.code === 2) {
          message = "Your current location could not be determined.";
        } else if (geoError?.code === 3) {
          message = "Location request timed out. Please try again.";
        }

        setLocating(false);

        if (showToast) {
          toast.error(message, { id: toastId });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  useGeolocationAutoRetry({
    enabled: showModal && !locating,
    onRetry: () => {
      detectCurrentLocation({ showToast: false, pinIfMissing: false, centerOnGps: true });
    },
  });

  const saveProfile = async () => {
    const isAddressOnlyEditor = editorMode === "address";
    setSaving(true);

    try {
      const payload = {
        address_line_1: formData.addressLine1,
        address_line_2: formData.addressLine2,
        building_name: formData.buildingName,
        wing: formData.wing,
        room_no: formData.roomNo,
        latitude: getCoordinateValue(formData.latitude),
        longitude: getCoordinateValue(formData.longitude),
      };

      if (!isAddressOnlyEditor) {
        payload.customer_name = formData.name;
        payload.email = formData.email;
        payload.phone_number = formData.phone;
      }

      if (!isAddressOnlyEditor && formData.photo instanceof File) {
        payload.photoFile = formData.photo;
      }

      await updateCustomerProfile(payload);

      const latest = await fetchCustomerProfile({ force: true });
      const mapped = mapApiProfileToUi(latest, dashboardData?.customer?.dairy || profile.farm);

      setProfile(mapped);
      setFormData(mapped);
      setPreviewPhoto(null);
      setShowModal(false);
      setEditorMode("profile");
      setGpsLocation(null);
      toast.success(isAddressOnlyEditor ? "Address updated successfully" : "Profile updated successfully");
    } catch (error) {
      toast.error(error?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const hasVisibleProfile = Boolean(
    profile.name || profile.email || profile.phone || profile.address || profile.photo || profile.farm
  );
  const isAddressOnlyEditor = editorMode === "address";

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
      <div
        className="mx-auto max-w-5xl space-y-5 animate-in fade-in duration-500 sm:space-y-6 lg:space-y-7"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">Profile Center</p>
            <h2
              className="mt-1.5 text-[24px] font-semibold text-[#2C1A0E] sm:mt-2 sm:text-[36px]"
              style={headingFont}
            >
              My <span className="text-[#B8641A]">Profile</span>
            </h2>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[24px] border border-[#5C3D1E]/10 bg-[linear-gradient(135deg,#2C2416_0%,#4A3820_62%,#6B4F2A_100%)] p-4 shadow-[0_18px_42px_rgba(44,26,14,0.14)] sm:rounded-[28px] sm:p-6">
          <MapPin className="pointer-events-none absolute -bottom-4 right-2 h-24 w-24 text-white/10 sm:right-5 sm:h-32 sm:w-32" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="relative mx-auto sm:mx-0">
                {profile.photo ? (
                  <img
                    src={profile.photo}
                    alt="profile"
                    className="h-20 w-20 rounded-full object-cover ring-4 ring-[#FFF4E2] shadow-[0_14px_30px_rgba(0,0,0,0.22)] sm:h-28 sm:w-28"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-[#F7D36D] bg-[#FFF4E2] text-[30px] font-semibold text-[#A85012] shadow-[0_14px_30px_rgba(0,0,0,0.18)] sm:h-28 sm:w-28 sm:text-[40px]">
                    {getInitials(profile.name)}
                  </div>
                )}
                <span className="absolute bottom-2 right-0 h-4 w-4 rounded-full border-[3px] border-[#FFF4E2] bg-[#11B89A]" />
              </div>

              <div className="min-w-0 text-center sm:text-left">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F3D4A6]">
                  Customer Profile
                </p>
                <h3
                  className="break-words text-[24px] font-semibold leading-tight text-white sm:text-[40px]"
                  style={headingFont}
                >
                  {profile.name}
                </h3>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 sm:px-4 sm:text-sm">
                    Member of {profile.farm}
                  </span>
                  <span className="rounded-full bg-[#FFF4E2] px-3 py-1 text-xs font-bold text-[#B8641A] sm:text-sm">
                    {profile.memberSince}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={openEditModal}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-white/15 bg-[#FFF4E2] px-5 py-2.5 text-sm font-bold text-[#B8641A] shadow-[0_14px_28px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:bg-[#FDE9C9] sm:w-auto sm:rounded-[16px] sm:px-6 sm:text-base"
            >
              <Edit size={18} />
              Edit Profile
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
          <InfoCard icon={<Mail />} label="Email" value={profile.email || "Not set"} />
          <InfoCard icon={<Phone />} label="Phone" value={profile.phone || "Not set"} />
          <InfoCard
            icon={<MapPin />}
            label="Delivery Address"
            value={profile.address || "Address not set"}
            meta={profile.pinLabel}
            actionLabel="Edit Address"
            onAction={openAddressModal}
            full
          />
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className={`flex h-[100svh] w-full flex-col overflow-hidden rounded-none border border-[#EDE8DF] bg-[#FFFDF7] shadow-[0_28px_80px_rgba(44,26,14,0.22)] animate-in zoom-in-95 sm:h-auto sm:max-h-[92vh] sm:rounded-[28px] ${isAddressOnlyEditor ? "max-w-3xl" : "max-w-4xl"}`}>
            <div className="flex items-center justify-between border-b border-[#F2EDE4] bg-[#FBF7F0] px-4 py-3 sm:px-7 sm:py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                  {isAddressOnlyEditor ? "Address Editor" : "Profile Editor"}
                </p>
                <h3 className="mt-1 text-[20px] font-semibold text-[#2C1A0E] sm:text-[22px]" style={headingFont}>
                  {isAddressOnlyEditor ? "Edit Delivery Address" : "Edit Details"}
                </h3>
              </div>
              <button
                onClick={closeEditModal}
                className="rounded-full border border-[#EDE8DF] bg-white p-2 text-[#5C3D1E] transition-colors hover:bg-[#FBF7F0]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-4 sm:px-7 sm:py-5">
              <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-4">
                  {isAddressOnlyEditor ? (
                    <>
                      <div className="rounded-[18px] border border-[#E7DAC6] bg-[#FFF8F0] p-4 text-sm text-[#6E5232]">
                        Update only your delivery address details here. Your name, phone, email, and photo will stay unchanged.
                      </div>

                      <div className="space-y-3">
                        <Input
                          label="Address Line 1"
                          name="addressLine1"
                          value={formData.addressLine1}
                          onChange={handleFormChange}
                          autoFocus
                        />
                        <Input
                          label="Address Line 2 (Opt)"
                          name="addressLine2"
                          value={formData.addressLine2}
                          onChange={handleFormChange}
                        />
                        <Input
                          label="Building Name"
                          name="buildingName"
                          value={formData.buildingName}
                          onChange={handleFormChange}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Input label="Wing (Opt)" name="wing" value={formData.wing} onChange={handleFormChange} />
                          <Input label="Room No" name="roomNo" value={formData.roomNo} onChange={handleFormChange} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col items-center gap-2 py-0">
                        <div className="relative group">
                          <img
                            src={previewPhoto || profile.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || profile.name)}`}
                            className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-md ring-2 ring-[#FDE9C9] sm:h-28 sm:w-28"
                            alt="preview"
                          />
                          <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-[#B8641A] p-2 text-white shadow-lg transition hover:scale-110">
                            <Camera size={14} />
                            <input type="file" accept="image/*" hidden onChange={handlePhotoChange} />
                          </label>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                          Change Profile Photo
                        </p>
                      </div>

                      <div className="space-y-3">
                        <Input
                          label="Name"
                          name="name"
                          value={formData.name}
                          onChange={handleFormChange}
                          autoFocus
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Input label="Phone" name="phone" value={formData.phone} onChange={handleFormChange} />
                          <Input
                            label="Email"
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleFormChange}
                          />
                        </div>
                        <Input
                          label="Address Line 1"
                          name="addressLine1"
                          value={formData.addressLine1}
                          onChange={handleFormChange}
                        />
                        <Input
                          label="Address Line 2 (Opt)"
                          name="addressLine2"
                          value={formData.addressLine2}
                          onChange={handleFormChange}
                        />
                        <Input
                          label="Building Name"
                          name="buildingName"
                          value={formData.buildingName}
                          onChange={handleFormChange}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Input label="Wing (Opt)" name="wing" value={formData.wing} onChange={handleFormChange} />
                          <Input label="Room No" name="roomNo" value={formData.roomNo} onChange={handleFormChange} />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-[18px] border border-[#E7DAC6] bg-[#FFF8F0] p-4 text-sm text-[#6E5232]">
                    Use GPS to show your current location, then tap the map to move your exact delivery pin whenever your address changes.
                  </div>

                  <div className="flex flex-col gap-3 rounded-[16px] border border-[#E7DAC6] bg-white p-3 sm:flex-row sm:items-center sm:gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        detectCurrentLocation({
                          showToast: true,
                          pinIfMissing: true,
                          centerOnGps: true,
                        })
                      }
                      disabled={locating}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-[12px] border border-[#EFD7B3] bg-[#FFF4E2] py-2.5 text-sm font-bold text-[#B8641A] transition hover:bg-[#FCE8CB] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:px-4 sm:py-2 sm:text-xs"
                    >
                      {locating ? <Loader2 className="animate-spin" size={16} /> : <LocateFixed size={16} />}
                      {locating ? "Locating..." : "Use Current Location"}
                    </button>

                    <div className="min-w-0 flex-1 text-center text-xs font-semibold text-[#5C3D1E] sm:text-left">
                      {gpsLocation
                        ? `GPS: ${gpsLocation.lat.toFixed(6)}, ${gpsLocation.lng.toFixed(6)}`
                        : "GPS location not captured yet. Tap the button or place the pin manually."}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[20px] border border-[#E7DAC6]">
                    <div className="relative w-full h-[220px sm:h-[320px]]">
        <MapContainer 
                      center={mapCenter} 
                      zoom={17} 
                      scrollWheelZoom 
                      dragging={!L.Browser?.mobile}
                      tap={!L.Browser?.mobile}
                      className="h-full w-full"
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <MapViewUpdater center={mapCenter} />
                      <MapPinSelector onSelect={setPinnedLocation} />

                      {gpsLocation && (
                        <CircleMarker
                          center={[gpsLocation.lat, gpsLocation.lng]}
                          radius={10}
                          pathOptions={{
                            color: "#2563EB",
                            fillColor: "#60A5FA",
                            fillOpacity: 0.6,
                            weight: 2,
                          }}
                        />
                      )}

                      {getCoordinatePair(formData.latitude, formData.longitude) && (
                        <Marker
                          position={[Number(formData.latitude), Number(formData.longitude)]}
                          icon={customerPinIcon}
                        />
                      )}
                    </MapContainer>
        <div className="absolute bottom-[18px] right-[55px] z-[1000] bg-white/60 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-[#8B7355] pointer-events-none select-none rounded border border-[#EDE8DF]/40">
          DairyVision Maps
        </div>
      </div>
          
                  </div>

                  <p className="text-xs font-medium text-[#8B7355]">
                    {getCoordinatePair(formData.latitude, formData.longitude)
                      ? "Tap anywhere on the map if your delivery point has changed."
                      : "Tap anywhere on the map to set your exact delivery pin."}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-[#F2EDE4] bg-[#FFFDF7] px-4 py-3 sm:px-7 sm:py-4">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="w-full rounded-[16px] bg-[#B8641A] py-3 font-bold text-white shadow-xl shadow-[#F2D9B8] transition-all active:scale-[0.98] disabled:bg-[#CDB8A0]"
              >
                {saving ? "Saving Changes..." : isAddressOnlyEditor ? "Save Address" : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
};

const InfoCard = ({ icon, label, value, meta, actionLabel, onAction, full }) => (
  <div
    className={`group relative overflow-hidden rounded-[20px] border border-[#EDE8DF] bg-[#FFFDF7] p-4 shadow-[0_12px_28px_rgba(100,72,35,0.06)] transition hover:-translate-y-0.5 hover:border-[#D4B896] hover:shadow-[0_18px_34px_rgba(100,72,35,0.1)] sm:rounded-[22px] sm:p-5 ${full ? "md:col-span-2" : ""}`}
  >
    <div className="absolute inset-x-0 top-0 h-1 bg-[#B8641A]/70 opacity-70 transition group-hover:opacity-100" />
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[13px] bg-[#FFF4E2] text-[#B8641A] transition group-hover:bg-[#B8641A] group-hover:text-white sm:h-12 sm:w-12 sm:rounded-[14px]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C4A882]">{label}</p>
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1 rounded-full border border-[#EFD7B3] bg-[#FFF4E2] px-2.5 py-1 text-[11px] font-bold text-[#B8641A] transition hover:border-[#D4B896] hover:bg-[#FDE9C9]"
            >
              <Edit size={12} />
              {actionLabel}
            </button>
          ) : null}
        </div>
        <p className="mt-1 break-words text-[15px] font-bold text-[#2C1A0E] sm:text-[16px]">{value}</p>
        {meta ? <p className="mt-1 text-xs font-medium text-[#8B7355]">{meta}</p> : null}
      </div>
    </div>
  </div>
);

const Input = ({ label, className = "", ...props }) => (
  <div className="space-y-1">
    <label className="ml-1 text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">{label}</label>
    <input
      {...props}
      className={`w-full rounded-[18px] border border-[#EDE8DF] bg-[#FBF7F0] px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#D4B896] ${className}`}
    />
  </div>
);

export default CustomerProfile;
