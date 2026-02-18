import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth.jsx"; // Adjust path if needed

import {
  Loader2, ShieldCheck, MapPin, Eye, EyeOff, Lock, User,
  ChevronRight, AlertCircle, Briefcase, Mail, Smartphone,
  Edit2, ArrowRight
} from "lucide-react";

import dairyImage from "../assets/dairyproduct.png";

// 🔗 BACKEND API
import {
  detectUserApi,
  requestOtpApi,
  verifyOtpApi,
  adminLoginApi,
  agentLoginApi // ✅ ADDED: Import agent login API
} from "../services/auth.api.js"; // Adjust path if needed

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  // ================= STATES =================
  const [step, setStep] = useState("IDENTIFIER");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [detectedUser, setDetectedUser] = useState(null);
  const [selectedDairy, setSelectedDairy] = useState(null);
  const [otpTimer, setOtpTimer] = useState(30);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ================= EFFECTS =================
  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step === "OTP" && otpTimer > 0) {
      const interval = setInterval(() => {
        setOtpTimer((t) => t - 1);
      }, 1000);
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

  // ================= IDENTIFIER SUBMIT =================
  const handleIdentifierSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const isEmail = identifier.includes("@");
    const isStaffId = identifier.toUpperCase().startsWith("STF");
    const isMobile = /^\d{10}$/.test(identifier);

    if (!isEmail && !isStaffId && !isMobile) {
      toast.error("Please enter a valid Email, Mobile, or Staff ID");
      return;
    }

    setLoading(true);

    try {
      const response = await detectUserApi(identifier);

      if (!response.exists) {
        toast("User not found. Please register first");
        // If it looks like a mobile number, offer registration
        if(isMobile) {
            navigate("/customer/register", { state: { identifier } });
        } else {
            setError("User ID not found.");
        }
        return;
      }

      setDetectedUser(response);

      // Routing based on backend "nextStep" instruction
      if (response.nextStep === "EXPLORE") {
        toast("No dairy assigned. Please explore dairies.");
        navigate("/explore", { state: { identifier } });
        return;
      }

      if (response.dairy) {
        setSelectedDairy(response.dairy);
      }

      // If backend says OTP, go straight there (Customer)
      if (response.nextStep === "OTP") {
        setOtpTimer(30);
        setStep("OTP");
        await requestOtpApi({
          identifier,
          dairyId: response.dairy?.id,
        });
        return;
      }

      // Otherwise, follow the step (usually PASSWORD for Admin/Agent)
      setStep(response.nextStep); // e.g., "PASSWORD"
      
    } catch (err) {
      const backendMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Connection error. Please try again.";

      setError(backendMessage);
      toast.error(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  // ================= DAIRY SELECT (If multiple) =================
  const handleDairySelect = (dairy) => {
    setSelectedDairy(dairy);
    setOtpTimer(30);
    setStep("OTP");
  };

  // ================= FINAL LOGIN =================
 const handleFinalLogin = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    const role = detectedUser?.userType; // This comes from the first 'Detect' step

    // --- CASE 1: ADMIN ---
    if (role === "ADMIN") {
      const result = await adminLoginApi({ email: identifier, password });
      localStorage.setItem("adminToken", result.token);
      localStorage.setItem("userRole", "ADMIN");
      
      login({ token: result.token, user: { ...result.user, role: "ADMIN" }, role: "ADMIN" });
      toast.success("Admin Login Successful");
      navigate("/admin/AdminDashboard", { replace: true });
    } 

    // --- CASE 2: AGENT (The Fix) ---
    else if (role === "AGENT") {
      const result = await agentLoginApi({ agentId: identifier, password });
      
      // Store the specific agent token
      localStorage.setItem("agentToken", result.token);
      localStorage.setItem("userRole", "AGENT");

      // Update the AuthContext so the ProtectedRoute allows entry
      login({ 
        token: result.token, 
        user: { ...result.user, role: "AGENT" }, 
        role: "AGENT" 
      });

      toast.success("Agent Login Successful");
      
      // ✅ REDIRECT TO AGENT DASHBOARD
      navigate("/agent/dashboard", { replace: true });
    }

    // --- CASE 3: CUSTOMER ---
    else if (role === "CUSTOMER") {
      const result = await verifyOtpApi({ identifier, otp, dairyId: selectedDairy?.id });
      localStorage.setItem("token", result.token);
      localStorage.setItem("userRole", "CUSTOMER");
      login(result);
      navigate(result.redirect || "/customer/dashboard", { replace: true });
    }

  } catch (err) {
    toast.error(err.response?.data?.error || "Login failed");
  } finally {
    setLoading(false);
  }
};

  // ================= IDENTITY BADGE COMPONENT =================
  const IdentityDisplay = () => {
    if (!detectedUser) return null;

    let Icon = User;
    let label = "User";
    let badgeColor = "bg-blue-200 text-blue-700";

    if (detectedUser.userType === "ADMIN") {
      Icon = Mail;
      label = "Admin Email";
      badgeColor = "bg-purple-200 text-purple-700";
    } else if (detectedUser.userType === "AGENT" || detectedUser.userType === "STAFF") {
      Icon = Briefcase;
      label = "Staff ID";
      badgeColor = "bg-orange-200 text-orange-700";
    } else if (detectedUser.userType === "CUSTOMER") {
      Icon = Smartphone;
      label = "Mobile";
      badgeColor = "bg-green-200 text-green-700";
    }

    return (
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 p-3 rounded-lg mb-6">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={`p-2 rounded-full ${badgeColor}`}>
            <Icon size={16} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
              {label}
            </span>
            <span className="text-sm font-semibold text-gray-900 truncate">
              {identifier}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
          title="Change User"
        >
          <Edit2 size={16} />
        </button>
      </div>
    );
  };

  // ================= FULL JSX =================
  return (
    <div className="min-h-screen bg-slate-50 grid lg:grid-cols-2">

      {/* ================= LEFT BRAND SECTION ================= */}
      <div className="hidden lg:flex flex-col justify-center px-20 bg-blue-600 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-4xl font-bold tracking-tight">DairyStream</h1>
          <div className="w-12 h-1 bg-blue-300 rounded-full mt-4 mb-6" />
          <p className="text-lg text-blue-100 max-w-md">
            Manage milk deliveries, subscriptions, billing, and customer access from one calm, reliable platform.
          </p>
          <div className="mt-8 flex gap-4">
            <Link
              to="/register-dairy"
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg border border-white/10 transition text-white no-underline"
            >
              <ShieldCheck size={18} /> Register Dairy
            </Link>
            <Link
              to="/explore"
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg border border-white/10 transition no-underline text-white"
            >
              <MapPin size={18} /> Explore Nearby
            </Link>
          </div>
        </div>
        {/* Decorative Blur */}
        <div className="absolute -bottom-40 -right-20 w-96 h-96 bg-blue-500/50 rounded-full blur-3xl"></div>
      </div>

      {/* ================= RIGHT LOGIN FORM SECTION ================= */}
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-8">

          {/* HEADER */}
          <div className="text-center mb-8">
            <img
              src={dairyImage}
              alt="Dairy"
              className="h-16 w-auto mx-auto mb-4 object-contain"
            />
            <h2 className="text-2xl font-bold text-gray-900">
              {step === "IDENTIFIER" ? "Welcome Back" : "Sign In"}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {step === "IDENTIFIER" && "Enter your Email, Mobile, or Staff ID"}
              {step === "CONFIRMATION" && "Verify your account details"}
              {step === "OTP" && `Verifying ${identifier}`}
              {step === "PASSWORD" && `Enter password for ${identifier}`}
            </p>

            {/* Role Tag */}
            {detectedUser && (
              <div className="flex justify-center mt-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase ${
                  detectedUser.userType === "ADMIN"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : (detectedUser.userType === "AGENT" || detectedUser.userType === "STAFF")
                    ? "bg-orange-50 text-orange-700 border-orange-200"
                    : "bg-green-50 text-green-700 border-green-200"
                }`}>
                  {detectedUser.userType === "ADMIN" ? "Dairy Admin" : 
                   (detectedUser.userType === "AGENT" || detectedUser.userType === "STAFF") ? "Delivery Agent" : "Customer"}
                </span>
              </div>
            )}
          </div>

          {/* ERROR ALERT */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2 animate-pulse">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* STEP 1: IDENTIFIER INPUT */}
          {step === "IDENTIFIER" && (
            <form onSubmit={handleIdentifierSubmit} className="space-y-5">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  ref={inputRef}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Mobile, email, or staff ID (STF...)"
                  className="w-full pl-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  autoFocus
                />
              </div>
              <button
                disabled={loading || !identifier}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Continue"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          )}

          {/* STEP 2: PASSWORD INPUT (Admin & Agent) */}
          {step === "PASSWORD" && (
            <form onSubmit={handleFinalLogin} className="space-y-5">
              <IdentityDisplay />
              
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button 
                disabled={loading || !password}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Login"}
              </button>
            </form>
          )}

          {/* STEP 3: OTP INPUT (Customer) */}
          {step === "OTP" && (
            <form onSubmit={handleFinalLogin} className="space-y-5">
              <IdentityDisplay />
              
              <div className="text-center">
                 <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  placeholder="• • • • • •"
                  className="w-full text-center text-3xl tracking-widest py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-mono"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-2">Enter the 6-digit code sent to your mobile</p>
              </div>

              <button 
                disabled={loading || otp.length < 4}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Verify & Login"}
              </button>

              <div className="text-center">
                 {otpTimer > 0 ? (
                    <span className="text-xs text-gray-400">Resend in {otpTimer}s</span>
                 ) : (
                    <button 
                        type="button"
                        onClick={() => {/* logic to resend */}}
                        className="text-xs text-blue-600 font-semibold hover:underline"
                    >
                        Resend Code
                    </button>
                 )}
              </div>
            </form>
          )}

          {/* FOOTER LINK */}
          <div className="text-center mt-6 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              New user?{" "}
              <Link
                to="/customer/register"
                className="text-blue-600 font-bold hover:underline"
              >
                Create account
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;