import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import client from "../api/client";
import {
  User,
  Phone,
  Building2,
  ArrowRight,
  CheckCircle,
  Loader2,
  AlertCircle,
  ShieldCheck,
  LocateFixed,
} from "lucide-react";
import dairyImage from "../assets/dairyproduct.jpg";
import { useGeolocationAutoRetry } from "../hooks/useGeolocationAutoRetry.js";

const headingFont = { fontFamily: "'Lora', serif" };
const DEFAULT_MAP_CENTER = [18.5204, 73.8567];
const customerPinIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const inputClassName =
  "w-full rounded-[16px] border border-[#EDE8DF] bg-white px-4 py-3 text-sm font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A]";

const labelClassName =
  "mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]";

const MapViewUpdater = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    if (Array.isArray(center) && center.length === 2) {
      map.flyTo(center, map.getZoom(), {
        animate: true,
        duration: 1.2,
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

const CustomerRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    customerName: "",
    email: "",
    phoneNumber: "",
    addressLine1: "",
    addressLine2: "",
    buildingName: "",
    wing: "",
    roomNo: "",
    latitude: null,
    longitude: null,
  });

  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [gpsLocation, setGpsLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_MAP_CENTER);

  useEffect(() => {
    if (location.state?.mobile) {
      setFormData((prev) => ({ ...prev, phoneNumber: location.state.mobile }));
    }
  }, [location.state]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateStep1 = () => {
    if (!formData.customerName.trim()) return "Please enter your Full Name";
    if (!formData.email.trim()) return "Email is required";
    if (!formData.phoneNumber || formData.phoneNumber.length !== 10) {
      return "Valid 10-digit Mobile Number is required";
    }
    return null;
  };

  const validateStep2 = () => {
    if (!formData.addressLine1.trim()) return "Please enter Address Line 1";
    if (!formData.roomNo.trim()) return "Room No is required";
    return null;
  };

  const validateStep3 = () => {
    if (!Number.isFinite(Number(formData.latitude)) || !Number.isFinite(Number(formData.longitude))) {
      return "Please allow GPS or tap the map to pin your exact location";
    }
    return null;
  };

  const setPinnedLocation = (latitude, longitude) => {
    const lat = Number(Number(latitude).toFixed(6));
    const lng = Number(Number(longitude).toFixed(6));

    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
    setMapCenter([lat, lng]);
    setError("");
  };

  const detectCurrentLocation = ({ showToast = true, pinIfMissing = true } = {}) => {
    if (!navigator.geolocation) {
      const message = "GPS location is not supported in this browser";
      setError(message);
      if (showToast) toast.error(message);
      return;
    }

    const hasPinnedLocation =
      Number.isFinite(Number(formData.latitude)) &&
      Number.isFinite(Number(formData.longitude));
    const toastId = showToast ? toast.loading("Getting your current location...") : null;

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));

        setGpsLocation({ lat, lng });
        setMapCenter([lat, lng]);

        if (pinIfMissing || !hasPinnedLocation) {
          setPinnedLocation(lat, lng);
        } else {
          setError("");
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
        setError(message);

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

  const handleNext = (e) => {
    e.preventDefault();
    const err =
      currentStep === 1
        ? validateStep1()
        : currentStep === 2
        ? validateStep2()
        : validateStep3();

    if (err) {
      setError(err);
      return;
    }
    setError("");
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  useEffect(() => {
    if (currentStep === 3 && !gpsLocation && !locating) {
      detectCurrentLocation({ showToast: false, pinIfMissing: true });
    }
  }, [currentStep]);

  useGeolocationAutoRetry({
    enabled: currentStep === 3 && !gpsLocation && !locating,
    onRetry: () => {
      detectCurrentLocation({ showToast: false, pinIfMissing: true });
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const locationError = validateStep3();
    if (locationError) {
      setError(locationError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data } = await client.post("/customer/addCustomer", formData);

      toast.success("Account created successfully. Please login.");
      navigate("/", {
        state: {
          message: "Account created successfully. Please login.",
        },
      });
    } catch (err) {
      console.error("Register error:", err);
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Something went wrong. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#F5F0E8_0%,#FFFDF8_100%)] lg:grid lg:grid-cols-2"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#2C2416_0%,#4A3820_60%,#6B4F2A_100%)] p-12 text-white md:flex md:items-center md:justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(210,138,64,0.18),transparent_40%)]" />
        <div className="relative z-10 max-w-lg">
          <h1 className="mb-6 text-5xl font-semibold tracking-tight" style={headingFont}>
            Join DairyVision
          </h1>
          <p className="mb-8 text-xl leading-relaxed text-[#F5E6D2]">
            Create your account to start managing your daily milk delivery, billing, and vacations effortlessly.
          </p>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 rounded-[14px] border border-[#EFD7B3]/40 bg-white/10 px-4 py-2.5 backdrop-blur-md">
              <ShieldCheck size={20} />
              <span>Secure Data</span>
            </div>
            <div className="flex items-center gap-2 rounded-[14px] border border-[#EFD7B3]/40 bg-white/10 px-4 py-2.5 backdrop-blur-md">
              <CheckCircle size={20} />
              <span>Easy Billing</span>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-[#D28A40]/20 blur-3xl" />
      </div>

      <div className="relative flex w-full items-center justify-center px-4 py-8 sm:px-6 md:w-full">
        <div className="w-full max-w-md rounded-[28px] border border-[#E7DAC6] bg-[#FFFDF7] p-6 shadow-[0_24px_60px_rgba(44,26,14,0.12)] sm:p-8">
          <div className="mb-6 text-center">
            <img
              src={dairyImage}
              alt="Logo"
              width="1600"
              height="1080"
              loading="lazy"
              decoding="async"
              className="mx-auto mb-2 h-16 w-auto object-contain"
            />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">Customer Register</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
              Create Account
            </h2>
            <p className="text-sm text-[#8B7355]">
              Step {currentStep} of 3: {currentStep === 1 ? "Personal Details" : currentStep === 2 ? "Address Details" : "Exact Location"}
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-[16px] border border-[#F2D0C8] bg-[#FDECEA] p-3 text-sm text-[#C0392B]">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={currentStep < 3 ? handleNext : handleSubmit}>
            {currentStep === 1 && (
              <div className="animate-in fade-in slide-in-from-right-4 space-y-5">
                <div>
                  <label className={labelClassName}>Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 text-[#A88763]" size={18} />
                    <input
                      type="text"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleChange}
                      placeholder="e.g. Rahul Sharma"
                      className={`pl-10 ${inputClassName}`}
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClassName}>Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 text-[#A88763]" size={18} />
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      placeholder="9876543210"
                      maxLength={10}
                      className={`pl-10 ${
                        location.state?.mobile
                          ? "w-full rounded-[16px] border border-[#EFD7B3] bg-[#FFF4E2] px-4 py-3 text-sm font-semibold text-[#6B5B3E] outline-none"
                          : inputClassName
                      }`}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[#A88763]">This will be your login ID.</p>
                </div>

                <div>
                  <label className={labelClassName}>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="rahul@gmail.com"
                    className={inputClassName}
                  />
                </div>

                <button
                  type="submit"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#B8641A] py-3.5 font-semibold text-white transition-all hover:bg-[#9F5313]"
                >
                  Next Step <ArrowRight size={18} />
                </button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
                <div>
                  <label className={labelClassName}>Address Line 1</label>
                  <input
                    type="text"
                    name="addressLine1"
                    value={formData.addressLine1}
                    onChange={handleChange}
                    placeholder="Flat / house / street"
                    className={inputClassName}
                    autoFocus
                  />
                </div>

                <div>
                  <label className={labelClassName}>Address Line 2 (Opt)</label>
                  <input
                    type="text"
                    name="addressLine2"
                    value={formData.addressLine2}
                    onChange={handleChange}
                    placeholder="Area / landmark"
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Building Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3.5 text-[#A88763]" size={18} />
                    <input
                      type="text"
                      name="buildingName"
                      value={formData.buildingName}
                      onChange={handleChange}
                      placeholder="Galaxy Apartments"
                      className={`pl-10 ${inputClassName}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClassName}>Wing (Opt)</label>
                    <input
                      type="text"
                      name="wing"
                      value={formData.wing}
                      onChange={handleChange}
                      placeholder="A"
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>Room No</label>
                    <input
                      type="text"
                      name="roomNo"
                      value={formData.roomNo}
                      onChange={handleChange}
                      placeholder="101"
                      className={inputClassName}
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="w-1/3 rounded-[16px] border border-[#EDE8DF] bg-white py-3 font-semibold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E]"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-2/3 items-center justify-center gap-2 rounded-[16px] bg-[#4A7C2F] py-3 font-semibold text-white transition-all hover:bg-[#3E6928] disabled:bg-[#BFD4AF]"
                  >
                    Continue to Map <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
                <div className="rounded-[18px] border border-[#E7DAC6] bg-[#FFF8F0] p-4 text-sm text-[#6E5232]">
                  Allow GPS to show your current location, then tap the map to place your exact delivery pin.
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-[16px] border border-[#E7DAC6] bg-white px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => detectCurrentLocation({ showToast: true, pinIfMissing: true })}
                    disabled={locating}
                    className="inline-flex items-center justify-center gap-2 rounded-[12px] border border-[#EFD7B3] bg-[#FFF4E2] px-3 py-2 text-xs font-semibold text-[#B8641A] transition hover:bg-[#FCE8CB] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {locating ? <Loader2 className="animate-spin" size={16} /> : <LocateFixed size={16} />}
                    {locating ? "Locating..." : "Use Current Location"}
                  </button>

                  <div className="min-w-0 flex-1 text-xs font-medium text-[#5C3D1E]">
                    {gpsLocation
                      ? `GPS: ${gpsLocation.lat.toFixed(6)}, ${gpsLocation.lng.toFixed(6)}`
                      : "GPS location not captured yet. Tap the button or place the pin manually."}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[20px] border border-[#E7DAC6]">
                  <MapContainer
                    center={mapCenter}
                    zoom={17}
                    scrollWheelZoom
                    className="h-[320px] w-full"
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

                    {Number.isFinite(Number(formData.latitude)) &&
                      Number.isFinite(Number(formData.longitude)) && (
                        <Marker
                          position={[Number(formData.latitude), Number(formData.longitude)]}
                          icon={customerPinIcon}
                        />
                      )}
                  </MapContainer>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="w-1/3 rounded-[16px] border border-[#EDE8DF] bg-white py-3 font-semibold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E]"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || locating}
                    className="flex w-2/3 items-center justify-center gap-2 rounded-[16px] bg-[#4A7C2F] py-3 font-semibold text-white transition-all hover:bg-[#3E6928] disabled:bg-[#BFD4AF]"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : "Finish Registration"}
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="mt-6 border-t border-[#F2EDE4] pt-6 text-center text-xs text-[#A88763]">
            By joining, you agree to our{" "}
            <a href="#" className="underline">
              Terms
            </a>{" "}
            &{" "}
            <a href="#" className="underline">
              Privacy Policy
            </a>
            .
            <div className="mt-2">
              Already have an account?{" "}
              <span onClick={() => navigate("/")} className="cursor-pointer font-bold text-[#B8641A] hover:underline">
                Log in
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerRegister;
