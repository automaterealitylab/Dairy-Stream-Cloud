import React, { Suspense, lazy, useEffect, useState } from "react";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import { useCustomerDashboard } from "../../hooks/useCustomerDashboard";
import { Mail, Phone, MapPin, Edit, Camera, Loader2, X, LocateFixed, LogOut } from "lucide-react";
import {
  fetchCustomerProfile,
  getCachedCustomerDashboard,
  getCachedCustomerProfile,
  updateCustomerProfile,
} from "../../api/customer/customer.api.js";
import { buildCustomerAddress } from "../../utils/customerAddress.js";
import toast from "react-hot-toast";
import { useGeolocationAutoRetry } from "../../hooks/useGeolocationAutoRetry.js";

const LazyCustomerProfileMap = lazy(() => import("../../components/customer/LazyCustomerProfileMap.jsx"));

const headingFont = { fontFamily: "'Lora', serif" };
const DEFAULT_MAP_CENTER = [18.5204, 73.8567];

const formatMemberSince = (value) => {
  if (!value) return "Member since recently";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Member since recently";
  return `Member since ${parsed.getFullYear()}`;
};

const formatPhoneNumber = (phone = "") => {
  if (!phone) return "Not set";
  const raw = String(phone).trim();
  if (!raw) return "Not set";

  if (/^\+91\s+\d{5}\s+\d{5}$/.test(raw)) return raw;

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (raw.startsWith("+91")) {
    const after = raw.slice(3).trim();
    if (after.length === 10) {
      return `+91 ${after.slice(0, 5)} ${after.slice(5)}`;
    }
  }
  return raw.startsWith("+") ? raw : `+91 ${raw}`;
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
          <InfoCard icon={<Phone />} label="Phone" value={formatPhoneNumber(profile.phone)} />
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

        <div className="mt-4 flex justify-end md:hidden">
          <button
            onClick={() => {
              localStorage.clear();
              sessionStorage.removeItem("customerDashboardVisited");
              window.location.href = "/";
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-[#EDE8DF] bg-white px-4 py-2.5 text-xs font-semibold text-[#7A6855] transition hover:border-[#F5C6C4] hover:bg-[#FDECEA] hover:text-[#C0392B]"
          >
            <LogOut size={16} />
            Logout of Account
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <style>{`
            .leaflet-control-attribution {
              font-size: 9px !important;
              color: #78716c !important;
              opacity: 0.6 !important;
              background: rgba(255, 255, 255, 0.75) !important;
              border-radius: 4px;
              padding: 0 4px !important;
            }
            .leaflet-control-zoom {
              border: 1px solid #E8E2D9 !important;
              border-radius: 10px !important;
              overflow: hidden !important;
              box-shadow: 0 2px 6px rgba(0,0,0,0.06) !important;
            }
            .leaflet-control-zoom a {
              background-color: #ffffff !important;
              color: #5C3D1E !important;
            }
            .leaflet-control-zoom a:hover {
              background-color: #FBF7F0 !important;
            }
          `}</style>
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#E8E2D9] bg-[#FAF7F2] shadow-2xl animate-in zoom-in-95">
            {/* Header (Fixed Top) */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#E8E2D9] p-5 pb-3 sm:px-7 sm:pt-6 sm:pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#9C8275]">
                  {isAddressOnlyEditor ? "ADDRESS EDITOR" : "PROFILE EDITOR"}
                </span>
                <h2 className="font-serif text-2xl font-bold text-[#2D231E]">
                  {isAddressOnlyEditor ? "Edit Delivery Address" : "Edit Details"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-full p-2 text-stone-600 transition-colors hover:bg-stone-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 sm:p-7">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch">
                {/* Left Column: Profile & Address Info */}
                <div className="space-y-3.5">
                  {isAddressOnlyEditor ? (
                    <div className="rounded-xl border border-[#E8E2D9] bg-[#FFF9F2] p-3 text-xs text-[#6E5232]">
                      Update your delivery address details below. Your personal profile info will remain unchanged.
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col items-center gap-1.5 pb-1">
                        <div className="relative group">
                          <img
                            src={
                              previewPhoto ||
                              profile.photo ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || profile.name)}`
                            }
                            className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-md ring-2 ring-[#E8E2D9]"
                            alt="Avatar Preview"
                          />
                          <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-[#C86D3B] p-1.5 text-white shadow-lg transition hover:scale-110">
                            <Camera size={13} />
                            <input type="file" accept="image/*" hidden onChange={handlePhotoChange} />
                          </label>
                        </div>
                        <p className="text-[11px] font-semibold text-[#8B7355]">Change Photo</p>
                      </div>

                      <Input
                        label="Full Name"
                        name="name"
                        value={formData.name}
                        onChange={handleFormChange}
                        placeholder="Enter full name"
                        autoFocus
                      />

                      <Input
                        label="Phone Number"
                        name="phone"
                        value={formData.phone}
                        onChange={handleFormChange}
                        placeholder="Enter phone number"
                      />

                      <Input
                        label="Email Address"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleFormChange}
                        placeholder="Enter email address"
                      />
                    </>
                  )}

                  <Input
                    label="Flat / Unit / House No."
                    name="addressLine1"
                    value={formData.addressLine1}
                    onChange={handleFormChange}
                    placeholder="e.g. Flat 402, Wing B"
                    autoFocus={isAddressOnlyEditor}
                  />

                  <Input
                    label="Building / Society Name"
                    name="buildingName"
                    value={formData.buildingName}
                    onChange={handleFormChange}
                    placeholder="e.g. Green Meadows Apartments"
                  />

                  <Input
                    label="Landmark / Area / Street"
                    name="addressLine2"
                    value={formData.addressLine2}
                    onChange={handleFormChange}
                    placeholder="e.g. Near City Park, MG Road"
                  />
                </div>

                {/* Right Column: Location Pin & Map */}
                <div className="flex flex-col h-full space-y-3">
                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
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
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#E8E2D9] bg-white px-3.5 py-2 text-xs font-bold text-[#C86D3B] transition hover:bg-[#FFF8F0] active:scale-[0.98] disabled:opacity-60"
                    >
                      {locating ? <Loader2 className="animate-spin" size={15} /> : <LocateFixed size={15} />}
                      {locating ? "Locating..." : "Use Current Location"}
                    </button>

                    <div className="flex min-w-0 flex-1 items-center justify-center sm:justify-end">
                      <span className="truncate rounded-full border border-[#E8E2D9] bg-white px-3 py-1 text-[11px] font-semibold text-[#6E5232] shadow-xs">
                        {gpsLocation
                          ? `📍 GPS: ${gpsLocation.lat.toFixed(6)}, ${gpsLocation.lng.toFixed(6)}`
                          : getCoordinatePair(formData.latitude, formData.longitude)
                          ? `📍 Pin: ${Number(formData.latitude).toFixed(6)}, ${Number(formData.longitude).toFixed(6)}`
                          : "No GPS coordinates set"}
                      </span>
                    </div>
                  </div>

                  <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-[#E8E2D9] bg-[#E5E3DF] shadow-inner md:h-full md:flex-1 md:min-h-[360px]">
                    <Suspense
                      fallback={
                        <div className="flex h-full w-full items-center justify-center bg-[#E5E3DF] text-xs font-semibold text-[#8B7355]">
                          <Loader2 className="mr-2 animate-spin text-[#C86D3B]" size={18} /> Loading Map...
                        </div>
                      }
                    >
                      <LazyCustomerProfileMap
                        mapCenter={mapCenter}
                        setPinnedLocation={setPinnedLocation}
                        gpsLocation={gpsLocation}
                        formDataLatitude={formData.latitude}
                        formDataLongitude={formData.longitude}
                        getCoordinatePair={getCoordinatePair}
                      />
                    </Suspense>
                    <div className="pointer-events-none absolute bottom-2 right-2 z-[1000] select-none rounded border border-[#E8E2D9] bg-white/80 px-2 py-0.5 text-[9px] font-bold text-[#6E5232] backdrop-blur-xs">
                      DairyVision Maps
                    </div>
                  </div>

                  <p className="text-center text-xs font-medium text-[#8B7355] md:text-left">
                    Tap or drag pin to update your precise delivery doorstep.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Action (Fixed Bottom, Never Overlaps Content) */}
            <div className="shrink-0 border-t border-[#E8E2D9] bg-[#FAF7F2] p-4 pt-2 sm:px-7 sm:pb-5">
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="w-full rounded-2xl bg-[#C86D3B] py-3.5 font-semibold text-white shadow-sm transition-all hover:bg-[#B35F30] active:scale-[0.99] disabled:opacity-60"
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
  <div className="w-full space-y-1">
    <label className="ml-1 text-xs font-bold uppercase tracking-[0.14em] text-[#A88763]">{label}</label>
    <input
      {...props}
      className={`w-full rounded-xl border border-[#E8E2D9] bg-white px-3.5 py-2.5 text-sm text-[#2C1A0E] placeholder:text-[#B09E8C] outline-none focus:border-[#C86D3B] focus:ring-1 focus:ring-[#C86D3B] transition-colors ${className}`}
    />
  </div>
);

export default CustomerProfile;
