import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "./hooks/useAuth.jsx"; // Keeping this from main branch

import {
  Loader2,
  ShieldCheck,
  MapPin,
  Eye,
  EyeOff,
  Lock,
  User,
  ChevronRight,
  AlertCircle,
  Briefcase,
  Mail,
  Smartphone,
  Edit2,
  ArrowRight
} from "lucide-react";
import dairyImage from "../assets/dairyproduct.png";

/* ================= 1. ADVANCED DETECT API (Fixed & Merged) ================= */
const mockDetectAPI = async (identifier) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const id = identifier.toUpperCase(); // Fixed: Added definition of id

      // SCENARIO 1: STAFF
      if (id.startsWith("STF")) {
        resolve({
          userType: "STAFF",
          name: "Staff Member",
          dairy: { id: "D01", name: "Nandanvan Dairy", isVerified: true },
          nextStep: "CONFIRMATION",
        });
      }
      // SCENARIO 2: ADMIN
      else if (id.includes("@")) {
        resolve({
          userType: "ADMIN",
          name: "Dairy Owner",
          dairy: { id: "D02", name: "Shree Dairy", isVerified: true },
          nextStep: "PASSWORD",
        });
      }
      // SCENARIO 3: CUSTOMER (Multi-Dairy)
      else if (id === "8888888888") {
        resolve({
          userType: "CUSTOMER",
          membership: "MULTIPLE",
          dairies: [
            { id: "D01", name: "Nandanvan Farms", location: "Pune" },
            { id: "D02", name: "Pune Fresh Dairy", location: "Mumbai" },
          ],
          nextStep: "SELECT_DAIRY",
        });
      }
      // SCENARIO 4: NEW USER
      else if (id === "9999999999") {
        resolve({
          userType: "CUSTOMER",
          membership: "NONE",
          nextStep: "EXPLORE",
        });
      }
      // SCENARIO 5: CUSTOMER (Single Dairy)
      else if (id.length === 10) {
        resolve({
          userType: "CUSTOMER",
          membership: "SINGLE",
          dairy: { id: "D01", name: "Nandanvan Dairy", isVerified: true },
          nextStep: "OTP",
        });
      } else {
        resolve(null);
      }
    }, 1200);
  });
};

const LoginPage = () => {
  const { login } = useAuth(); // Integrated auth hook
  const navigate = useNavigate();
  const inputRef = useRef(null);

  // States
  const [step, setStep] = useState("IDENTIFIER");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Advanced States
  const [detectedUser, setDetectedUser] = useState(null);
  const [selectedDairy, setSelectedDairy] = useState(null);
  const [otpTimer, setOtpTimer] = useState(30);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Focus input on step change
  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  // OTP Timer Logic
  useEffect(() => {
    if (step === "OTP" && otpTimer > 0) {
      const interval = setInterval(() => setOtpTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [step, otpTimer]);

  const handleReset = () => {
    setStep("IDENTIFIER");
    setDetectedUser(null);
    setPassword("");
    setOtp("");
    setSelectedDairy(null);
    setError("");
  };

  // --- 1. HANDLE IDENTIFIER SUBMIT ---
  const handleIdentifierSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Strict Validation
    const isEmail = identifier.includes("@");
    const isStaffId = identifier.toUpperCase().startsWith("STF");
    const isMobile = /^\d{10}$/.test(identifier);

    if (!isEmail && !isStaffId && !isMobile) {
      toast.error("Please enter a valid Email, Mobile, or Staff ID");
      return;
    }

    setLoading(true);

    try {
      const response = await mockDetectAPI(identifier);

      if (response) {
        setDetectedUser(response);

        // New User -> Redirect
        if (response.nextStep === "EXPLORE") {
          toast("Please complete registration first");
          navigate("/register", { state: { mobile: identifier } });
          return;
        }

        // Single Dairy -> Auto Select
        if (response.dairy) {
          setSelectedDairy(response.dairy);
        }

        // If OTP step, start timer
        if (response.nextStep === "OTP") {
          setOtpTimer(30);
        }

        setStep(response.nextStep);
      } else {
        setError("Account not found. Please register first.");
        toast.error("Account not found");
      }
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- 2. HANDLE DAIRY SELECT ---
  const handleDairySelect = (dairy) => {
    setSelectedDairy(dairy);
    setOtpTimer(30);
    setStep("OTP");
  };

  // --- 3. FINAL LOGIN ---
  const handleFinalLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      
      const role = detectedUser?.userType;
      
      // Update Global Auth Context (from main branch)
      if (login) {
        login({ role, identifier, dairyId: selectedDairy?.id });
      }

      // Persist for route guards
      localStorage.setItem("userRole", role);
      localStorage.setItem("dairyId", selectedDairy?.id);

      toast.success(`Welcome back, ${detectedUser?.name || 'User'}!`);

      // Redirect
      if (role === "CUSTOMER") navigate("/customer-dashboard", { replace: true });
      else if (role === "STAFF") navigate("/staff/home", { replace: true });
      else if (role === "ADMIN") navigate("/admin/dashboard", { replace: true });
    }, 1000);
  };

  // --- Helper: Identity Badge ---
  const IdentityDisplay = () => {
    if (!detectedUser) return null;
    let Icon = User;
    let label = "User";
    
    if (detectedUser.userType === 'ADMIN') { Icon = Mail; label = "Admin Email"; }
    else if (detectedUser.userType === 'STAFF') { Icon = Briefcase; label = "Staff ID"; }
    else if (detectedUser.userType === 'CUSTOMER') { Icon = Smartphone; label = "Mobile"; }

    return (
      <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-3 rounded-lg mb-6">
        <div className="flex items-center gap-3 overflow-hidden">
           <div className="bg-blue-200 p-2 rounded-full text-blue-700">
              <Icon size={16} />
           </div>
           <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">{label}</span>
              <span className="text-sm font-semibold text-gray-900 truncate">{identifier}</span>
           </div>
        </div>
        <button type="button" onClick={handleReset} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
           <Edit2 size={16} />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 grid lg:grid-cols-2">
      
      {/* ================= LEFT BRAND ================= */}
      <div className="hidden lg:flex flex-col justify-center px-20 bg-blue-600 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-4xl font-bold tracking-tight">DairyStream</h1>
          <div className="w-12 h-1 bg-blue-300 rounded-full mt-4 mb-6" />
          <p className="text-lg text-blue-100 max-w-md">
            Manage milk deliveries, subscriptions, billing, and customer access from one calm, reliable platform.
          </p>
          <div className="mt-8 flex gap-4">
            <Link to="/register-dairy" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg border border-white/10 transition text-white no-underline">
               <ShieldCheck size={18} /> Register Dairy
            </Link>
            <Link to="/explore" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg border border-white/10 transition no-underline text-white" >
               <MapPin size={18} className="text-white" /> Explore Nearby
            </Link>
          </div>
        </div>
        {/* Background Blob */}
        <div className="absolute -bottom-40 -right-20 w-96 h-96 bg-blue-500/50 rounded-full blur-3xl"></div>
      </div>

      {/* ================= LOGIN FORM ================= */}
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <img src={dairyImage} alt="Dairy" className="h-16 w-auto mx-auto mb-4 object-contain" />
            <h2 className="text-2xl font-bold text-gray-900">
              {step === "IDENTIFIER" ? "Welcome Back" : "Sign In"}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {step === "IDENTIFIER" && "Enter your Email, Mobile, or Staff ID"}
              {step === "CONFIRMATION" && "Verify your account details"}
              {step === "SELECT_DAIRY" && "Select a dairy to continue"}
              {step === "OTP" && `Verifying ${identifier}`}
              {step === "PASSWORD" && `Enter password for ${identifier}`}
            </p>

            {/* Role Badge */}
            {detectedUser && (
               <div className="flex justify-center mt-3 animate-in fade-in zoom-in duration-300">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border tracking-wide uppercase ${
                     detectedUser.userType === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                     detectedUser.userType === 'STAFF' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                     'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                     {detectedUser.userType === 'ADMIN' ? 'Dairy Admin' : 
                      detectedUser.userType === 'STAFF' ? 'Staff Member' : 'Customer'}
                  </span>
               </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* --- STEP 1: IDENTIFIER --- */}
          {step === "IDENTIFIER" && (
            <form onSubmit={handleIdentifierSubmit} className="space-y-5">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  ref={inputRef}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Mobile, email, or staff ID"
                  className="w-full pl-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>
              <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition">
                {loading ? <Loader2 className="animate-spin" /> : "Continue"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          )}

          {/* --- STEP 1.5: CONFIRMATION --- */}
          {step === "CONFIRMATION" && selectedDairy && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl text-center">
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-2">Signing in to</p>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedDairy.name}</h3>
                {selectedDairy.isVerified && (
                  <div className="inline-flex items-center gap-1 text-green-600 text-sm font-medium bg-green-100 px-3 py-1 rounded-full mt-2">
                    <ShieldCheck size={14} /> Verified Business
                  </div>
                )}
              </div>
              <button onClick={() => setStep(detectedUser.userType === "CUSTOMER" ? "OTP" : "PASSWORD")} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl">
                Continue to Login
              </button>
              <button onClick={handleReset} className="w-full text-gray-500 text-sm hover:text-gray-700">Change Account</button>
            </div>
          )}

          {/* --- STEP 2: SELECT DAIRY --- */}
          {step === "SELECT_DAIRY" && (
            <div className="space-y-3">
               <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                  {detectedUser.dairies.map((dairy) => (
                    <button key={dairy.id} onClick={() => handleDairySelect(dairy)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 text-left flex items-center justify-between group transition">
                       <div>
                          <h4 className="font-semibold text-gray-900">{dairy.name}</h4>
                          <p className="text-sm text-gray-500">{dairy.location}</p>
                       </div>
                       <ChevronRight className="text-gray-300 group-hover:text-blue-500" size={20} />
                    </button>
                  ))}
               </div>
               <button onClick={handleReset} className="w-full text-gray-500 text-sm hover:text-gray-700 mt-4">Cancel</button>
            </div>
          )}

          {/* --- STEP 3: PASSWORD --- */}
          {step === "PASSWORD" && (
            <form onSubmit={handleFinalLogin} className="space-y-5">
              <IdentityDisplay />
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  ref={inputRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold">
                {loading ? <Loader2 className="animate-spin mx-auto" /> : "Login"}
              </button>
              <button type="button" onClick={handleReset} className="w-full text-gray-500 text-sm hover:text-gray-700">Back</button>
            </form>
          )}

          {/* --- STEP 4: OTP --- */}
          {step === "OTP" && (
            <form onSubmit={handleFinalLogin} className="space-y-5">
              <IdentityDisplay />
              
              <div className="text-center">
                 <input
                  ref={inputRef}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  placeholder="000000"
                  className="w-full text-center text-3xl font-bold tracking-[0.5em] py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                 />
                 <div className="mt-3">
                   {otpTimer > 0 ? (
                      <p className="text-xs text-gray-400">Resend OTP in <span className="font-medium text-gray-600">00:{otpTimer.toString().padStart(2, "0")}</span></p>
                   ) : (
                      <button type="button" onClick={() => { setOtp(""); setOtpTimer(30); toast.success("OTP Resent"); }} className="text-sm text-blue-600 font-medium hover:underline">
                         Resend OTP
                      </button>
                   )}
                 </div>
              </div>

              <button disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold">
                {loading ? <Loader2 className="animate-spin mx-auto" /> : "Verify & Login"}
              </button>
              <button type="button" onClick={handleReset} className="w-full text-gray-500 text-sm hover:text-gray-700">Change Number</button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default LoginPage;