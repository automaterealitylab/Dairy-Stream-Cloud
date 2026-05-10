import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Eye, EyeOff, ExternalLink, Loader2, PlayCircle, ShieldCheck, X } from "lucide-react";
import {
  brandSchema,
  locationSchema,
  ownerSchema,
  productSchema,
} from "../validators/dairyRegister.schema";
import { registerDairyApi, updateDairyRazorpaySetupApi } from "../api/admin.api";

import BrandStep from "../components/steps/BrandStep";
import LocationStep from "../components/steps/LocationStep";
import OwnerBankStep from "../components/steps/OwnerBankStep";
import ProductsAndStockStep from "../components/steps/ProductsAndStockStep";
import PlanStep from "../components/steps/PlanStep";
import ReviewStep from "../components/steps/ReviewStep";
import StepperHeader from "../components/steps/StepperHeader";

const headingFont = { fontFamily: "'Lora', serif" };

const RegisterDairyPage = () => {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showRazorpaySetup, setShowRazorpaySetup] = useState(false);
  const [savingRazorpay, setSavingRazorpay] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [razorpaySetup, setRazorpaySetup] = useState({
    razorpay_key_id: "",
    razorpay_key_secret: "",
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const [formData, setFormData] = useState({
    dairy_name: "",
    dairy_phone: "",
    dairy_email: "",
    gstin: "",
    category: "Milk & Dairy",

    address: "",
    city: "",
    state: "",
    pincode: "",

    latitude: null,
    longitude: null,

    service_type: "RADIUS",
    service_radius: "10",
    service_pincodes: "",

    owner_name: "",
    admin_email: "",
    password: "",
    confirmPassword: "",

    selected_plan: "GROWTH",

    products: {},
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files && e.target.files[0];

    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const detectLocation = () => {

if (!navigator.geolocation) {
  return toast.error("Geolocation not supported by your browser");
}

const toastId = toast.loading("Capturing GPS...");

navigator.geolocation.getCurrentPosition(

async (pos) => {

  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  setFormData(prev => ({
    ...prev,
    latitude: lat,
    longitude: lng
  }));

  try {

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
    );

    const data = await res.json();

    const address = data.address || {};

    setFormData(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      city: address.city || address.town || address.village || "",
      state: address.state || "",
      pincode: address.postcode || ""
    }));

  } catch {
    // Address autofill is best-effort; the user can still enter it manually.
  }

  toast.success("GPS Locked!", { id: toastId });

  // 👇 ADD THIS LINE
  toast("Please check the detected pincode once.");

},

() => {
  toast.error("Location permission denied", { id: toastId });
},

{
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0
}

);

};

  const validateStep = (step) => {
    let result;

    if (step === 1) {
      result = brandSchema.safeParse(formData);
    }

    if (step === 2) {
      result = locationSchema.safeParse(formData);
    }

    if (step === 3) {
      result = ownerSchema.safeParse(formData);
    }

    if (step === 4) {
      result = productSchema.safeParse(formData);
    }

    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => prev + 1);
    } else {
      toast.error("Please fill required fields");
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const submitData = new FormData();

      Object.keys(formData).forEach((key) => {
        if (key === "products") {
          submitData.append(key, JSON.stringify(formData[key]));
        } else if (formData[key] !== null) {
          submitData.append(key, formData[key]);
        }
      });

      if (formData.service_type === "PINCODE") {
        submitData.delete("service_radius");
      }

      if (formData.service_type === "RADIUS") {
        submitData.delete("service_pincodes");
      }

      if (logoFile) {
        submitData.append("image", logoFile);
      }

      const result = await registerDairyApi(submitData);

      toast.success("Dairy Created");

      if (result?.data?.token) {
        localStorage.setItem("adminToken", result.data.token);
        localStorage.setItem("userRole", "ADMIN");
        localStorage.setItem(
          "user",
          JSON.stringify({
            token: result.data.token,
            role: "ADMIN",
            ...(result.data.admin || {}),
          })
        );
        if (result.data.admin) {
          localStorage.setItem("adminUser", JSON.stringify(result.data.admin));
        }
      }

      setShowRazorpaySetup(true);
    } catch (err) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRazorpaySetupChange = (e) => {
    const { name, value } = e.target;
    setRazorpaySetup((prev) => ({ ...prev, [name]: value }));
  };

  const goToDashboard = () => {
    setShowRazorpaySetup(false);
    navigate("/admin/AdminDashboard", { replace: true });
  };

  const handleSaveRazorpaySetup = async () => {
    const keyId = razorpaySetup.razorpay_key_id.trim();
    const keySecret = razorpaySetup.razorpay_key_secret.trim();

    if (!keyId || !keySecret) {
      toast.error("Enter both Razorpay Key ID and Key Secret");
      return;
    }

    setSavingRazorpay(true);
    try {
      await updateDairyRazorpaySetupApi({
        razorpayKeyId: keyId,
        razorpayKeySecret: keySecret,
      });
      toast.success("Razorpay setup saved");
      goToDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || err.message || "Failed to save Razorpay setup");
    } finally {
      setSavingRazorpay(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#F5F0E8_0%,#FFFDF8_100%)] px-3 py-4 flex flex-col items-center sm:px-4 sm:py-6 lg:py-10"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="sticky top-0 z-30 w-full flex justify-center bg-[#F5F0E8]/95 backdrop-blur pb-3 sm:pb-4">
        <div className="w-full max-w-5xl">
          <div className="mb-3 flex justify-start sm:mb-4">
            <button
              type="button"
              onClick={() => navigate("/", { replace: true })}
              className="inline-flex items-center gap-2 rounded-[14px] border border-[#EDE8DF] bg-white px-4 py-2.5 text-sm font-semibold text-[#8B7355] shadow-sm transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E]"
            >
              <ArrowLeft size={16} />
              Back to Login
            </button>
          </div>

          <StepperHeader currentStep={currentStep} />
        </div>
      </div>

      <div className="w-full max-w-5xl overflow-hidden rounded-[24px] border border-[#E7DAC6] bg-[#FFFDF7] shadow-[0_20px_60px_rgba(84,52,16,0.08)] sm:rounded-[32px]">
        {currentStep === 1 && (
          <BrandStep
            formData={formData}
            handleChange={handleChange}
            handleLogoChange={handleLogoChange}
            logoPreview={logoPreview}
          />
        )}

        {currentStep === 2 && (
          <LocationStep
            formData={formData}
            handleChange={handleChange}
            detectLocation={detectLocation}
          />
        )}

        {currentStep === 3 && (
          <OwnerBankStep formData={formData} handleChange={handleChange} />
        )}

        {currentStep === 4 && (
          <ProductsAndStockStep formData={formData} setFormData={setFormData} />
        )}

        {currentStep === 5 && (
          <PlanStep
            selected_plan={formData.selected_plan}
            setPlan={(plan) =>
              setFormData((prev) => ({ ...prev, selected_plan: plan }))
            }
          />
        )}

        {currentStep === 6 && (
          <ReviewStep formData={formData} logoPreview={logoPreview} />
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-[#E7DAC6] bg-[#FBF7F0] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <button
            onClick={() => {
              if (currentStep === 1) {
                navigate("/", { replace: true });
                return;
              }
              setCurrentStep((s) => s - 1);
            }}
            className="w-full rounded-[14px] border border-[#EDE8DF] bg-white px-4 py-3 text-center font-bold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E] sm:w-auto sm:border-0 sm:bg-transparent sm:px-0 sm:py-0"
          >
            {currentStep === 1 ? "Back to Login" : "Back"}
          </button>

          <button
            onClick={currentStep === 6 ? handleSubmit : handleNext}
            disabled={loading}
            className={`flex w-full items-center justify-center gap-2 rounded-[16px] px-6 py-4 font-black text-white transition disabled:cursor-not-allowed disabled:bg-[#D8C8B2] sm:w-auto sm:px-10 ${
              currentStep === 6 ? "bg-[#4A7C2F] hover:bg-[#3E6928]" : "bg-[#B8641A] hover:bg-[#9F5313]"
            }`}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : currentStep === 6 ? (
              "Confirm & Launch"
            ) : (
              "Next Step"
            )}
          </button>
        </div>
      </div>

      {showRazorpaySetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1A0E]/55 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[24px] border border-[#E7DAC6] bg-[#FFFDF7] shadow-[0_24px_80px_rgba(44,26,14,0.28)] sm:rounded-[30px]">
            <div className="flex items-start justify-between border-b border-[#E7DAC6] p-5 sm:p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B8641A]">
                  Payment Setup
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
                  Create Your Razorpay Account
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-[#8B7355]">
                  Watch the guide, create a Razorpay merchant account for this dairy, then paste the Key ID and Key Secret here.
                </p>
              </div>
              <button
                type="button"
                onClick={goToDashboard}
                className="rounded-full p-2 text-[#8B7355] transition hover:bg-[#F4E8D8] hover:text-[#5C3D1E]"
                title="Skip for now"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr] sm:p-6">
              <div className="space-y-4">
                <div className="overflow-hidden rounded-[18px] border border-[#E7DAC6] bg-[#2C2416]">
                  <video
                    controls
                    className="aspect-video w-full bg-[#2C2416]"
                    poster="/icons/icon-512.png"
                  >
                    <source src="/videos/razorpay-setup-guide.mp4" type="video/mp4" />
                    Your browser cannot play this guide video.
                  </video>
                </div>

                <div className="rounded-[18px] border border-[#F0DFC7] bg-[#FFF8EE] p-4">
                  <div className="flex items-start gap-3">
                    <PlayCircle className="mt-0.5 text-[#B8641A]" size={20} />
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#5C3D1E]">
                        Guide Checklist
                      </h3>
                      <p className="mt-2 text-sm text-[#8B7355]">
                        Sign up on Razorpay, complete KYC, open Dashboard settings, create API keys, then copy the Key ID and Key Secret.
                      </p>
                      <a
                        href="https://dashboard.razorpay.com/app/website-app-settings/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#B8641A] hover:underline"
                      >
                        Open Razorpay API Keys <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-[#E7DAC6] bg-white p-4 sm:p-5">
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FBF2E8] text-[#B8641A]">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[#5C3D1E]">
                      Razorpay Credentials
                    </h3>
                    <p className="mt-1 text-sm text-[#8B7355]">
                      The secret is saved on the backend only and is never shown to customers.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-[#A88763]">
                      Key ID
                    </label>
                    <input
                      type="text"
                      name="razorpay_key_id"
                      value={razorpaySetup.razorpay_key_id}
                      onChange={handleRazorpaySetupChange}
                      placeholder="rzp_live_xxxxxxxxxxxxx"
                      className="w-full rounded-[16px] border border-[#E7DAC6] bg-white px-5 py-4 text-sm font-semibold text-[#2C1A0E] outline-none transition placeholder:text-[#B7A188] focus:border-[#B8641A] focus:ring-4 focus:ring-[#F4E1CB]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-[#A88763]">
                      Key Secret
                    </label>
                    <div className="relative">
                      <input
                        type={showSecret ? "text" : "password"}
                        name="razorpay_key_secret"
                        value={razorpaySetup.razorpay_key_secret}
                        onChange={handleRazorpaySetupChange}
                        placeholder="Paste Razorpay key secret"
                        className="w-full rounded-[16px] border border-[#E7DAC6] bg-white py-4 pl-5 pr-12 text-sm font-semibold text-[#2C1A0E] outline-none transition placeholder:text-[#B7A188] focus:border-[#B8641A] focus:ring-4 focus:ring-[#F4E1CB]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret((value) => !value)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A88763] hover:text-[#5C3D1E]"
                        title={showSecret ? "Hide secret" : "Show secret"}
                      >
                        {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveRazorpaySetup}
                    disabled={savingRazorpay}
                    className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#4A7C2F] px-6 py-4 font-black text-white transition hover:bg-[#3E6928] disabled:cursor-not-allowed disabled:bg-[#BFD4AF]"
                  >
                    {savingRazorpay ? <Loader2 className="animate-spin" size={20} /> : "Save & Continue"}
                  </button>

                  <button
                    type="button"
                    onClick={goToDashboard}
                    className="w-full rounded-[16px] border border-[#E7DAC6] bg-[#FBF7F0] px-6 py-3 text-sm font-bold text-[#8B7355] transition hover:bg-[#F5E8D8] hover:text-[#5C3D1E]"
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterDairyPage;
