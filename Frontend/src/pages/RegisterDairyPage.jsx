import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
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

  } catch (err) {}

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

      await registerDairyApi(submitData);

      toast.success("Dairy Created");

      navigate("/admin/AdminDashboard");
    } catch (err) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 flex flex-col items-center">
      <StepperHeader currentStep={currentStep} />

      <div className="bg-white w-full max-w-5xl rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
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

        <div className="p-8 bg-gray-50 flex justify-between border-t border-gray-100">
          <button
            onClick={() => setCurrentStep((s) => s - 1)}
            className={`${currentStep === 1 ? "invisible" : ""} font-bold text-gray-400`}
          >
            Back
          </button>

          <button
            onClick={currentStep === 6 ? handleSubmit : handleNext}
            disabled={loading}
            className={`px-10 py-4 rounded-2xl font-black text-white flex items-center gap-2 ${
              currentStep === 6 ? "bg-green-600" : "bg-blue-600"
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
