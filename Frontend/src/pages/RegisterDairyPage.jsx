import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  brandSchema,
  locationSchema,
  ownerSchema,
  productSchema,
} from "../validators/dairyRegister.schema";
import { registerDairyApi } from "../api/admin.api";

import BrandStep from "../components/steps/BrandStep";
import LocationStep from "../components/steps/LocationStep";
import OwnerBankStep from "../components/steps/OwnerBankStep";
import ProductsAndStockStep from "../components/steps/ProductsAndStockStep";
import PlanStep from "../components/steps/PlanStep";
import ReviewStep from "../components/steps/ReviewStep";
import StepperHeader from "../components/steps/StepperHeader";

const RegisterDairyPage = () => {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

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

    bank_account_holder_name: "",
    bank_account_number: "",
    bank_ifsc_code: "",
    bank_name: "",
    bank_branch: "",
    upi_id: "",
    razorpay_linked_account_id: "",
    one_time_payment_method: "DIRECT_UPI",
    subscription_payment_method: "DIRECT_UPI",

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
    toast("GPS captured, but address lookup failed. Please enter the address manually.");
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
    let result = { success: true };

    if (step === 1) result = brandSchema.safeParse(formData);
    if (step === 2) result = locationSchema.safeParse(formData);
    if (step === 3) result = ownerSchema.safeParse(formData);
    if (step === 4) result = productSchema.safeParse(formData);

    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return false;
    }

    return true;
  };

  const handleNext = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const validateAllSteps = () => {
    for (let s = 1; s <= 4; s++) {
      if (!validateStep(s)) {
        setCurrentStep(s);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateAllSteps()) return;

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

      navigate("/admin/AdminDashboard", { replace: true });
    } catch (err) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
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

          <StepperHeader currentStep={currentStep} onStepClick={setCurrentStep} />
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
    </div>
  );
};

export default RegisterDairyPage;
