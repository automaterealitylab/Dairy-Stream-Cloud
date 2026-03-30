import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  User,
  Phone,
  Building2,
  Droplets,
  Calendar,
  ArrowRight,
  CheckCircle,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import dairyImage from "../assets/dairyproduct.png";

const headingFont = { fontFamily: "'Lora', serif" };

const inputClassName =
  "w-full rounded-[16px] border border-[#EDE8DF] bg-white px-4 py-3 text-sm font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A]";

const labelClassName =
  "mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]";

const CustomerRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    customerName: "",
    email: "",
    phoneNumber: "",
    buildingName: "",
    wing: "",
    roomNo: "",
    defaultMilkQuantityLiters: 1.0,
    billingCycle: "Monthly",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const handleNext = (e) => {
    e.preventDefault();
    const err = validateStep1();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setCurrentStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/api/customer/addCustomer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : { message: await res.text() };

      if (!res.ok) {
        const errorMessage = data?.message || data?.error || "Registration failed";
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      toast.success("Account created successfully. Please login.");
      navigate("/", {
        state: {
          message: "Account created successfully. Please login.",
        },
      });
    } catch (err) {
      console.error("Register error:", err);
      const errorMessage = "Something went wrong. Please try again.";
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
            Join DairyStream
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
            <img src={dairyImage} alt="Logo" className="mx-auto mb-2 h-16 w-auto object-contain" />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">Customer Register</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
              Create Account
            </h2>
            <p className="text-sm text-[#8B7355]">
              Step {currentStep} of 2: {currentStep === 1 ? "Personal Details" : "Address & Plan"}
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-[16px] border border-[#F2D0C8] bg-[#FDECEA] p-3 text-sm text-[#C0392B]">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={currentStep === 1 ? handleNext : handleSubmit}>
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
                      autoFocus
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

                <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                  <div>
                    <label className={labelClassName}>Daily Milk (L)</label>
                    <div className="relative">
                      <Droplets className="absolute left-3 top-3.5 text-[#B8641A]" size={18} />
                      <input
                        type="number"
                        step="0.5"
                        name="defaultMilkQuantityLiters"
                        value={formData.defaultMilkQuantityLiters}
                        onChange={handleChange}
                        className="w-full rounded-[16px] border border-[#EFD7B3] bg-[#FFF4E2] py-3 pl-10 pr-4 font-bold text-[#2C1A0E] outline-none transition focus:border-[#B8641A]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClassName}>Billing</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3.5 text-[#A88763]" size={18} />
                      <select
                        name="billingCycle"
                        value={formData.billingCycle}
                        onChange={handleChange}
                        className={`appearance-none pl-10 ${inputClassName}`}
                      >
                        <option>Daily</option>
                        <option>Weekly</option>
                        <option>Monthly</option>
                      </select>
                    </div>
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
