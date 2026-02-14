import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "./hooks/useAuth.jsx"; // ✅ Import useAuth

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
  adminLoginApi
} from "./services/auth.api";

const LoginPage = () => {
  const { login } = useAuth(); // ✅ Get the login function
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
        navigate("/customer/register", {
          state: { identifier }
        });
        return;
      }

      setDetectedUser(response);

      if (response.nextStep === "EXPLORE") {
        toast("No dairy assigned. Please explore dairies.");
        navigate("/explore", { state: { identifier } });
        return;
      }

      if (response.dairy) {
        setSelectedDairy(response.dairy);
      }

      if (response.nextStep === "OTP") {
        setOtpTimer(30);
        setStep("OTP");
        await requestOtpApi({
          identifier,
          dairyId: response.dairy?.id,
        });
        return;
      }

      setStep(response.nextStep);
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

  // ================= DAIRY SELECT =================
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
      const role = detectedUser?.userType;

      // 🛑 ADMIN LOGIN FIX
      if (role === "ADMIN") {
        console.log("📨 Attempting admin login...");
        
        const result = await adminLoginApi({
          email: identifier,
          password,
        });

        console.log("✅ Admin login successful:", result);

        // ✅ FIX 1: Set Standard Keys for ProtectedRoute
        localStorage.setItem("token", result.token); 
        localStorage.setItem("userRole", "ADMIN"); // Explicitly set role
        
        // ✅ FIX 2: Call the Auth Context! 
        // This updates the App state so ProtectedRoute knows we are logged in immediately.
        // We ensure the object structure matches what useAuth expects.
        const authData = {
            token: result.token,
            user: { ...result.user, role: "ADMIN" }, // Ensure role is present
            role: "ADMIN"
        };
        login(authData);

        toast.success(`Welcome back, ${result.user?.name || "Admin"}!`);
        navigate(result.redirect || "/admin/AdminDashboard", { replace: true });
        return;
      }

      // CUSTOMER / STAFF OTP LOGIN
      const result = await verifyOtpApi({
        identifier,
        otp,
        dairyId: selectedDairy?.id,
      });

      // ✅ Login is correctly called here for Customers
      login(result);
      
      // ✅ Also ensure localStorage fallback is set for Customers
      localStorage.setItem("userRole", result.user?.role || role); 

      toast.success(`Welcome back, ${result.user?.name || "User"}!`);

      if (role === "CUSTOMER") {
        navigate(result.redirect || "/customer-dashboard", { replace: true });
      } else if (role === "STAFF") {
        navigate("/staff/home", { replace: true });
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ================= IDENTITY BADGE =================
  const IdentityDisplay = () => {
    if (!detectedUser) return null;

    let Icon = User;
    let label = "User";

    if (detectedUser.userType === "ADMIN") {
      Icon = Mail;
      label = "Admin Email";
    } else if (detectedUser.userType === "STAFF") {
      Icon = Briefcase;
      label = "Staff ID";
    } else if (detectedUser.userType === "CUSTOMER") {
      Icon = Smartphone;
      label = "Mobile";
    }

    return (
      <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-3 rounded-lg mb-6">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-blue-200 p-2 rounded-full text-blue-700">
            <Icon size={16} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
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
        >
          <Edit2 size={16} />
        </button>
      </div>
    );
  };

  // ================= FULL JSX =================
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
        <div className="absolute -bottom-40 -right-20 w-96 h-96 bg-blue-500/50 rounded-full blur-3xl"></div>
      </div>

      {/* ================= RIGHT LOGIN FORM ================= */}
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
              {step === "SELECT_DAIRY" && "Select a dairy to continue"}
              {step === "OTP" && `Verifying ${identifier}`}
              {step === "PASSWORD" && `Enter password for ${identifier}`}
            </p>

            {detectedUser && (
              <div className="flex justify-center mt-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase ${
                  detectedUser.userType === "ADMIN"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : detectedUser.userType === "STAFF"
                    ? "bg-orange-50 text-orange-700 border-orange-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}>
                  {detectedUser.userType === "ADMIN"
                    ? "Dairy Admin"
                    : detectedUser.userType === "STAFF"
                    ? "Staff Member"
                    : "Customer"}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* IDENTIFIER */}
          {step === "IDENTIFIER" && (
            <form onSubmit={handleIdentifierSubmit} className="space-y-5">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  ref={inputRef}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Mobile, email, or staff ID"
                  className="w-full pl-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Continue"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
            
          )}

          {/* CONFIRMATION */}
          {step === "CONFIRMATION" && selectedDairy && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl text-center">
                <p className="text-xs text-blue-600 font-bold uppercase mb-2">
                  Signing in to
                </p>
                <h3 className="text-xl font-bold text-gray-900">
                  {selectedDairy.name}
                </h3>
              </div>
              <button
                onClick={() =>
                  setStep(
                    detectedUser.userType === "CUSTOMER"
                      ? "OTP"
                      : "PASSWORD"
                  )
                }
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
              >
                Continue to Login
              </button>
              <button
                onClick={handleReset}
                className="w-full text-gray-500 text-sm"
              >
                Change Account
              </button>
            </div>
          )}

          {/* SELECT DAIRY */}
          {step === "SELECT_DAIRY" && (
            <div className="space-y-3">
              {detectedUser.dairies.map((dairy) => (
                <button
                  key={dairy.id}
                  onClick={() => handleDairySelect(dairy)}
                  className="w-full p-4 bg-gray-50 border rounded-xl flex justify-between"
                >
                  <div>
                    <h4 className="font-semibold">{dairy.name}</h4>
                    <p className="text-sm text-gray-500">{dairy.location}</p>
                  </div>
                  <ChevronRight />
                </button>
              ))}
            </div>
          )}

          {/* PASSWORD */}
          {step === "PASSWORD" && (
            <form onSubmit={handleFinalLogin} className="space-y-5">
              <IdentityDisplay />
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              <button className="w-full bg-blue-600 text-white py-3 rounded-xl">
                Login
              </button>
            </form>
          )}

          {/* OTP */}
          {step === "OTP" && (
            <form onSubmit={handleFinalLogin} className="space-y-5">
              <IdentityDisplay />
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className="w-full text-center text-3xl py-4 border rounded-xl"
              />
              <button className="w-full bg-green-600 text-white py-3 rounded-xl">
                Verify & Login
              </button>
            </form>
          )}

          <div className="text-center mt-4">
            <p className="text-sm text-gray-500">
              New user?{" "}
              <Link
                to="/customer/register"
                className="text-blue-600 font-medium hover:underline"
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