import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
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
  agentLoginApi, // ✅ ADDED: Import agent login API
  requestAdminPasswordResetOtpApi,
  resetAdminPasswordWithOtpApi,
  requestAgentPasswordResetOtpApi,
  resetAgentPasswordWithOtpApi
} from "../services/auth.api.js"; // Adjust path if needed

const DASHBOARD_VISITED_FLAG = "customerDashboardVisited";
const headingFont = { fontFamily: "'Lora', serif" };

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);

  // ================= STATES =================
  const [step, setStep] = useState("IDENTIFIER");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [detectedUser, setDetectedUser] = useState(null);
  const [selectedDairy, setSelectedDairy] = useState(null);
  const [otpTimer, setOtpTimer] = useState(30);
  const [adminResetMode, setAdminResetMode] = useState(false);
  const [adminResetOtpSent, setAdminResetOtpSent] = useState(false);
  const [adminResetOtp, setAdminResetOtp] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [adminOtpRequestsRemaining, setAdminOtpRequestsRemaining] = useState(null);
  const [agentResetMode, setAgentResetMode] = useState(false);
  const [agentResetOtpSent, setAgentResetOtpSent] = useState(false);
  const [agentResetOtp, setAgentResetOtp] = useState("");
  const [newAgentPassword, setNewAgentPassword] = useState("");
  const [confirmAgentPassword, setConfirmAgentPassword] = useState("");
  const [agentOtpRequestsRemaining, setAgentOtpRequestsRemaining] = useState(null);

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
    setAdminResetMode(false);
    setAdminResetOtpSent(false);
    setAdminResetOtp("");
    setNewAdminPassword("");
    setConfirmAdminPassword("");
    setAdminOtpRequestsRemaining(null);
    setAgentResetMode(false);
    setAgentResetOtpSent(false);
    setAgentResetOtp("");
    setNewAgentPassword("");
    setConfirmAgentPassword("");
    setAgentOtpRequestsRemaining(null);
  };

  const handleCustomerOtpResend = async () => {
    const normalizedIdentifier = String(identifier || "").trim();
    if (!normalizedIdentifier) {
      toast.error("Identifier is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await requestOtpApi({
        identifier: normalizedIdentifier,
        dairyId: selectedDairy?.id,
      });

      setOtp("");
      setOtpTimer(30);
      toast.success(result?.message || "OTP sent successfully");
    } catch (err) {
      const backendMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Failed to send OTP";

      setError(backendMessage);
      toast.error(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  // ================= IDENTIFIER SUBMIT =================
  const handleIdentifierSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const normalizedIdentifier = String(identifier || "").trim();

    const isEmail = normalizedIdentifier.includes("@");
    const isStaffId = normalizedIdentifier.toUpperCase().startsWith("STF");
    const isMobile = /^\d{10}$/.test(normalizedIdentifier);

    if (!isEmail && !isStaffId && !isMobile) {
      toast.error("Please enter a valid Email, Mobile, or Staff ID");
      return;
    }

    setLoading(true);

    try {
      const response = await detectUserApi(normalizedIdentifier, {
        requestCustomerOtp: true,
        dairyId: selectedDairy?.id,
      });

      if (!response.exists) {
        toast("User not found. Please register first");
        // If it looks like a mobile number, offer registration
        if(isMobile) {
            navigate("/customer/register", { state: { identifier: normalizedIdentifier } });
        } else {
            setError("User ID not found.");
        }
        return;
      }

      setDetectedUser(response);

      // Routing based on backend "nextStep" instruction
      if (response.nextStep === "EXPLORE") {
        toast("No dairy assigned. Please explore dairies.");
        navigate("/explore", { state: { identifier: normalizedIdentifier } });
        return;
      }

      if (response.dairy) {
        setSelectedDairy(response.dairy);
      }

      // If backend says OTP, go straight there (Customer)
      if (response.nextStep === "OTP") {
        if (response.hasOtpDelivery === false) {
          const backendMessage = "No email is registered for this customer account, so OTP login is not available yet.";
          setError(backendMessage);
          toast.error(backendMessage);
          return;
        }

        setOtp("");
        setOtpTimer(0);
        setStep("OTP");

        if (!response.otpRequested) {
          const otpResponse = await requestOtpApi({
            identifier: normalizedIdentifier,
            dairyId: response.dairy?.id ?? selectedDairy?.id,
          });
          setOtpTimer(30);
          toast.success(otpResponse?.message || "OTP sent successfully");
          return;
        }

        setOtpTimer(30);
        toast.success("OTP sent successfully");
        return;
      }

      // Otherwise, follow the step (usually PASSWORD for Admin/Agent)
      setStep(response.nextStep); // e.g., "PASSWORD"
      setAdminResetMode(false);
      setAdminResetOtpSent(false);
      setAdminOtpRequestsRemaining(null);
      setAgentResetMode(false);
      setAgentResetOtpSent(false);
      setAgentOtpRequestsRemaining(null);
      
    } catch (err) {
      const backendMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Connection error. Please try again.";

      setError(backendMessage);
      toast.error(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  // ================= DAIRY SELECT (If multiple) =================
  const _handleDairySelect = (dairy) => {
    setSelectedDairy(dairy);
    setOtp("");
    setOtpTimer(0);
    setStep("OTP");
  };

  const handleAdminForgotPasswordRequest = async () => {
    const normalizedIdentifier = String(identifier || "").trim();
    if (!normalizedIdentifier) {
      toast.error("Identifier is required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await requestAdminPasswordResetOtpApi({
        identifier: normalizedIdentifier,
      });
      setAdminResetMode(true);
      setAdminResetOtpSent(true);
      setAgentResetMode(false);
      setAgentResetOtpSent(false);
      setAdminOtpRequestsRemaining(
        typeof result?.remainingRequests === "number" ? result.remainingRequests : null
      );
      setAgentOtpRequestsRemaining(null);
      toast.success(result?.message || "OTP sent to registered admin email");
    } catch (err) {
      const backendMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Failed to send OTP";
      setError(backendMessage);
      if (typeof err.response?.data?.remainingRequests === "number") {
        setAdminOtpRequestsRemaining(err.response.data.remainingRequests);
      }
      toast.error(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminPasswordReset = async (e) => {
    e.preventDefault();

    if (!adminResetOtp.trim()) {
      toast.error("Please enter OTP");
      return;
    }
    if (newAdminPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await resetAdminPasswordWithOtpApi({
        identifier: String(identifier || "").trim(),
        otp: adminResetOtp.trim(),
        newPassword: newAdminPassword,
      });

      toast.success(result?.message || "Password reset successful. Please login.");
      setAdminResetMode(false);
      setAdminResetOtpSent(false);
      setAdminResetOtp("");
      setNewAdminPassword("");
      setConfirmAdminPassword("");
      setPassword("");
    } catch (err) {
      const backendMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Failed to reset password";
      setError(backendMessage);
      toast.error(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentForgotPasswordRequest = async () => {
    const normalizedStaffId = String(identifier || "").trim().toUpperCase();
    if (!normalizedStaffId) {
      toast.error("Staff ID is required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await requestAgentPasswordResetOtpApi({
        agentId: normalizedStaffId,
      });
      setAgentResetMode(true);
      setAgentResetOtpSent(true);
      setAdminResetMode(false);
      setAdminResetOtpSent(false);
      setAgentOtpRequestsRemaining(
        typeof result?.remainingRequests === "number" ? result.remainingRequests : null
      );
      setAdminOtpRequestsRemaining(null);
      toast.success(result?.message || "OTP sent to registered agent email");
    } catch (err) {
      const backendMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Failed to send OTP";
      setError(backendMessage);
      if (typeof err.response?.data?.remainingRequests === "number") {
        setAgentOtpRequestsRemaining(err.response.data.remainingRequests);
      }
      toast.error(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentPasswordReset = async (e) => {
    e.preventDefault();

    if (!agentResetOtp.trim()) {
      toast.error("Please enter OTP");
      return;
    }
    if (newAgentPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newAgentPassword !== confirmAgentPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await resetAgentPasswordWithOtpApi({
        agentId: String(identifier || "").trim().toUpperCase(),
        otp: agentResetOtp.trim(),
        newPassword: newAgentPassword,
      });

      toast.success(result?.message || "Password reset successful. Please login.");
      setAgentResetMode(false);
      setAgentResetOtpSent(false);
      setAgentResetOtp("");
      setNewAgentPassword("");
      setConfirmAgentPassword("");
      setPassword("");
    } catch (err) {
      const backendMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Failed to reset password";
      setError(backendMessage);
      toast.error(backendMessage);
    } finally {
      setLoading(false);
    }
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
      const result = await adminLoginApi({ identifier, password });
      localStorage.setItem("adminToken", result.token);
      localStorage.setItem("userRole", "ADMIN");
      
      login({ token: result.token, user: { ...result.user, role: "ADMIN" }, role: "ADMIN" });
      toast.success("Admin Login Successful");
      navigate("/admin/AdminDashboard", { replace: true });
    } 

    // --- CASE 2: AGENT (The Fix) ---
    else if (role === "AGENT" || role === "STAFF") {
  const result = await agentLoginApi({ agentId: identifier, password });

  // Use the new standardized login call
  login({
    token: result.token,
    role: "AGENT", // Explicitly set it
    user: result.user
  });

  toast.success("Welcome, Agent!");
  navigate("/agent/dashboard", { replace: true });
}
    // --- CASE 3: CUSTOMER ---
    else if (role === "CUSTOMER") {
      const result = await verifyOtpApi({ identifier, otp, dairyId: selectedDairy?.id });
      localStorage.setItem("token", result.token);
      localStorage.setItem("userRole", "CUSTOMER");
      sessionStorage.setItem(DASHBOARD_VISITED_FLAG, "true");
      login(result);
      const redirectOverride = location.state?.postLoginRedirect;
      const redirectState = location.state?.postLoginState;
      navigate(redirectOverride || result.redirect || "/customer/dashboard", {
        replace: true,
        state: redirectState || null,
      });
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
    let badgeColor = "bg-[#FFF4E2] text-[#B8641A]";

    if (detectedUser.userType === "ADMIN") {
      Icon = Mail;
      label = "Admin ID";
      badgeColor = "bg-[#FFF1E4] text-[#C86A2B]";
    } else if (detectedUser.userType === "AGENT" || detectedUser.userType === "STAFF") {
      Icon = Briefcase;
      label = "Staff ID";
      badgeColor = "bg-[#FFF1E4] text-[#C86A2B]";
    } else if (detectedUser.userType === "CUSTOMER") {
      Icon = Smartphone;
      label = "Email/Mobile";
      badgeColor = "bg-[#EEF5E7] text-[#4A7C2F]";
    }

    return (
      <div className="mb-6 flex items-center justify-between rounded-[16px] border border-[#EDE8DF] bg-[#FBF7F0] p-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={`p-2 rounded-full ${badgeColor}`}>
            <Icon size={16} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A88763]">
              {label}
            </span>
            <span className="truncate text-sm font-semibold text-[#2C1A0E]">
              {identifier}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="p-2 text-[#A88763] transition-colors hover:text-[#B8641A]"
          title="Change User"
        >
          <Edit2 size={16} />
        </button>
      </div>
    );
  };

  // ================= FULL JSX =================
  return (
    <div
      className="min-h-screen flex flex-col bg-[linear-gradient(180deg,#F5F0E8_0%,#FFFDF8_100%)] lg:grid lg:grid-cols-2"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="order-2 px-4 pb-6 sm:px-6 lg:hidden">
        <div className="relative overflow-hidden rounded-[28px] border border-[#5C3D1E]/10 bg-[linear-gradient(135deg,#2C2416_0%,#4A3820_60%,#6B4F2A_100%)] px-5 py-6 text-white shadow-[0_20px_50px_rgba(44,26,14,0.16)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(210,138,64,0.18),transparent_40%)]" />
          <div className="relative z-10">
            <h1 className="text-[30px] font-semibold leading-[1.05]" style={headingFont}>DairyStream</h1>
            <p className="mt-3 max-w-sm text-sm text-[#F5E6D2]">
              Manage milk deliveries, subscriptions, billing, and customer access from one calm, reliable platform.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                to="/register-dairy"
                className="inline-flex items-center gap-2 rounded-[14px] border border-[#EFD7B3]/40 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white no-underline transition hover:bg-white/16"
              >
                <ShieldCheck size={16} /> Register Dairy
              </Link>
              <Link
                to="/explore"
                className="inline-flex items-center gap-2 rounded-[14px] border border-[#EFD7B3]/40 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white no-underline transition hover:bg-white/16"
              >
                <MapPin size={16} /> Explore Nearby
              </Link>
            </div>
          </div>
          <div className="absolute -bottom-16 -right-14 h-40 w-40 rounded-full bg-[#D28A40]/20 blur-3xl" />
        </div>
      </div>

      {/* ================= LEFT BRAND SECTION ================= */}
      <div className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#2C2416_0%,#4A3820_60%,#6B4F2A_100%)] px-20 text-white lg:flex lg:flex-col lg:justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(210,138,64,0.16),transparent_42%)]" />
        <div className="relative z-10">
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-white" style={headingFont}>DairyStream</h1>
          <div className="mb-6 mt-4 h-1 w-12 rounded-full bg-[#D6A15D]" />
          <p className="max-w-md text-lg text-[#F5E6D2]">
            Manage milk deliveries, subscriptions, billing, and customer access from one calm, reliable platform.
          </p>
          <div className="mt-8 flex gap-4">
            <Link
              to="/register-dairy"
              className="flex items-center gap-2 rounded-[14px] border border-[#EFD7B3]/40 bg-white/10 px-4 py-2.5 text-white no-underline transition hover:bg-white/16"
            >
              <ShieldCheck size={18} /> Register Dairy
            </Link>
            <Link
              to="/explore"
              className="flex items-center gap-2 rounded-[14px] border border-[#EFD7B3]/40 bg-white/10 px-4 py-2.5 text-white no-underline transition hover:bg-white/16"
            >
              <MapPin size={18} /> Explore Nearby
            </Link>
          </div>
        </div>
        <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-[#D28A40]/20 blur-3xl"></div>
        <div className="absolute -top-24 left-10 h-52 w-52 rounded-full bg-[#FFF4E2]/8 blur-3xl"></div>
      </div>

      {/* ================= RIGHT LOGIN FORM SECTION ================= */}
      <div className="order-1 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8 lg:order-none lg:px-4 lg:py-10">
        <div className="w-full max-w-md rounded-[28px] border border-[#E7DAC6] bg-[#FFFDF7] p-5 shadow-[0_24px_60px_rgba(44,26,14,0.12)] sm:p-8">

          {/* HEADER */}
          <div className="text-center mb-8">
            <img
              src={dairyImage}
              alt="Dairy"
              className="h-16 w-auto mx-auto mb-4 object-contain"
            />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">Sign In</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
              {step === "IDENTIFIER" ? "Welcome Back" : "Sign In"}
            </h2>
            <p className="mt-1 text-sm text-[#8B7355]">
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
                    ? "border-[#F0D1B2] bg-[#FFF1E4] text-[#C86A2B]"
                    : (detectedUser.userType === "AGENT" || detectedUser.userType === "STAFF")
                    ? "border-[#F0D1B2] bg-[#FFF1E4] text-[#C86A2B]"
                    : "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]"
                }`}>
                  {detectedUser.userType === "ADMIN" ? "Dairy Admin" : 
                   (detectedUser.userType === "AGENT" || detectedUser.userType === "STAFF") ? "Delivery Agent" : "Customer"}
                </span>
              </div>
            )}
          </div>

          {/* ERROR ALERT */}
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-[16px] border border-[#F2D0C8] bg-[#FDECEA] p-4 text-sm text-[#C0392B]">
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
                  className="w-full rounded-[16px] border border-[#EDE8DF] bg-white py-3 pl-10 text-[#2C1A0E] outline-none transition-all focus:border-[#B8641A]"
                  autoFocus
                />
              </div>
              <button
                disabled={loading || !identifier}
                className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#B8641A] py-3 font-semibold text-white transition-colors hover:bg-[#9F5313] disabled:bg-[#D8C8B2]"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Continue"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          )}

          {/* STEP 2: PASSWORD INPUT (Admin & Agent) */}
          {step === "PASSWORD" && (
            <form
              onSubmit={
                adminResetMode
                  ? handleAdminPasswordReset
                  : agentResetMode
                  ? handleAgentPasswordReset
                  : handleFinalLogin
              }
              className="space-y-5"
            >
              <IdentityDisplay />

              {!adminResetMode && !agentResetMode ? (
                <>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-[16px] border border-[#EDE8DF] bg-white py-3 pl-10 pr-10 text-[#2C1A0E] outline-none transition focus:border-[#B8641A]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A88763] hover:text-[#5C3D1E]"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {(detectedUser?.userType === "ADMIN" ||
                    detectedUser?.userType === "AGENT" ||
                    detectedUser?.userType === "STAFF") && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (detectedUser?.userType === "ADMIN") {
                            handleAdminForgotPasswordRequest();
                          } else {
                            handleAgentForgotPasswordRequest();
                          }
                        }}
                        className="text-xs font-semibold text-[#B8641A] hover:underline"
                        disabled={loading}
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}

                  <button
                    disabled={loading || !password}
                    className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#B8641A] py-3 font-semibold text-white hover:bg-[#9F5313] disabled:bg-[#D8C8B2]"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : "Login"}
                  </button>
                </>
              ) : adminResetMode ? (
                <>
                  <div className="rounded-[14px] border border-[#E7DAC6] bg-[#FFF8EC] p-3 text-xs text-[#8B7355]">
                    OTP will be sent to your registered admin email, irrespective of email/mobile login method.
                  </div>

                  {!adminResetOtpSent ? (
                    <button
                      type="button"
                      onClick={handleAdminForgotPasswordRequest}
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#B8641A] py-3 font-semibold text-white hover:bg-[#9F5313] disabled:bg-[#D8C8B2]"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : "Send OTP"}
                    </button>
                  ) : (
                    <>
                      {typeof adminOtpRequestsRemaining === "number" && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">
                            OTP requests remaining: {adminOtpRequestsRemaining}
                          </span>
                          <button
                            type="button"
                            onClick={handleAdminForgotPasswordRequest}
                            disabled={loading || adminOtpRequestsRemaining <= 0}
                            className="font-semibold text-[#B8641A] hover:underline disabled:text-[#C4A882] disabled:no-underline"
                          >
                            Resend OTP
                          </button>
                        </div>
                      )}
                      {adminOtpRequestsRemaining === 0 && (
                        <p className="text-xs text-red-600 font-medium">
                          Limit reached. Try after 15 minutes.
                        </p>
                      )}

                      <input
                        value={adminResetOtp}
                        onChange={(e) => setAdminResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="Enter 6-digit OTP"
                        className="w-full rounded-[16px] border border-[#EDE8DF] py-3 text-center font-mono text-2xl tracking-widest outline-none focus:border-[#B8641A]"
                        autoFocus
                      />

                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          placeholder="New password"
                          className="w-full rounded-[16px] border border-[#EDE8DF] bg-white py-3 pl-10 pr-10 text-[#2C1A0E] outline-none focus:border-[#B8641A]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A88763] hover:text-[#5C3D1E]"
                        >
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>

                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmAdminPassword}
                          onChange={(e) => setConfirmAdminPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="w-full rounded-[16px] border border-[#EDE8DF] bg-white py-3 pl-10 pr-10 text-[#2C1A0E] outline-none focus:border-[#B8641A]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A88763] hover:text-[#5C3D1E]"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>

                      <button
                        disabled={loading || adminResetOtp.length < 6 || !newAdminPassword || !confirmAdminPassword}
                        className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#4A7C2F] py-3 font-semibold text-white hover:bg-[#3E6928] disabled:bg-[#BFD4AF]"
                      >
                        {loading ? <Loader2 className="animate-spin" /> : "Reset Password"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAdminResetMode(false);
                          setAdminResetOtpSent(false);
                          setAdminResetOtp("");
                          setNewAdminPassword("");
                          setConfirmAdminPassword("");
                          setAdminOtpRequestsRemaining(null);
                        }}
                        className="w-full text-sm text-[#8B7355] hover:text-[#5C3D1E]"
                      >
                        Back to Login
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="rounded-[14px] border border-[#E7DAC6] bg-[#FFF8EC] p-3 text-xs text-[#8B7355]">
                    OTP will be sent to the agent's registered email using your staff ID.
                  </div>

                  {!agentResetOtpSent ? (
                    <button
                      type="button"
                      onClick={handleAgentForgotPasswordRequest}
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#B8641A] py-3 font-semibold text-white hover:bg-[#9F5313] disabled:bg-[#D8C8B2]"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : "Send OTP"}
                    </button>
                  ) : (
                    <>
                      {typeof agentOtpRequestsRemaining === "number" && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">
                            OTP requests remaining: {agentOtpRequestsRemaining}
                          </span>
                          <button
                            type="button"
                            onClick={handleAgentForgotPasswordRequest}
                            disabled={loading || agentOtpRequestsRemaining <= 0}
                            className="font-semibold text-[#B8641A] hover:underline disabled:text-[#C4A882] disabled:no-underline"
                          >
                            Resend OTP
                          </button>
                        </div>
                      )}
                      {agentOtpRequestsRemaining === 0 && (
                        <p className="text-xs text-red-600 font-medium">
                          Limit reached. Try after 15 minutes.
                        </p>
                      )}

                      <input
                        value={agentResetOtp}
                        onChange={(e) => setAgentResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="Enter 6-digit OTP"
                        className="w-full rounded-[16px] border border-[#EDE8DF] py-3 text-center font-mono text-2xl tracking-widest outline-none focus:border-[#B8641A]"
                        autoFocus
                      />

                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newAgentPassword}
                          onChange={(e) => setNewAgentPassword(e.target.value)}
                          placeholder="New password"
                          className="w-full rounded-[16px] border border-[#EDE8DF] bg-white py-3 pl-10 pr-10 text-[#2C1A0E] outline-none focus:border-[#B8641A]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A88763] hover:text-[#5C3D1E]"
                        >
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>

                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmAgentPassword}
                          onChange={(e) => setConfirmAgentPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="w-full rounded-[16px] border border-[#EDE8DF] bg-white py-3 pl-10 pr-10 text-[#2C1A0E] outline-none focus:border-[#B8641A]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A88763] hover:text-[#5C3D1E]"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>

                      <button
                        disabled={loading || agentResetOtp.length < 6 || !newAgentPassword || !confirmAgentPassword}
                        className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#4A7C2F] py-3 font-semibold text-white hover:bg-[#3E6928] disabled:bg-[#BFD4AF]"
                      >
                        {loading ? <Loader2 className="animate-spin" /> : "Reset Password"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAgentResetMode(false);
                          setAgentResetOtpSent(false);
                          setAgentResetOtp("");
                          setNewAgentPassword("");
                          setConfirmAgentPassword("");
                          setAgentOtpRequestsRemaining(null);
                        }}
                        className="w-full text-sm text-[#8B7355] hover:text-[#5C3D1E]"
                      >
                        Back to Login
                      </button>
                    </>
                  )}
                </>
              )}
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
                  className="w-full rounded-[16px] border border-[#EDE8DF] py-4 text-center font-mono text-3xl tracking-widest outline-none focus:border-[#4A7C2F]"
                  autoFocus
                />
                <p className="mt-2 text-xs text-[#A88763]">Enter the 6-digit code sent to your registered email</p>
              </div>

              <button 
                disabled={loading || otp.length < 6}
                className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#4A7C2F] py-3 font-semibold text-white hover:bg-[#3E6928] disabled:bg-[#BFD4AF]"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Verify & Login"}
              </button>

              <div className="text-center">
                 {otpTimer > 0 ? (
                    <span className="text-xs text-[#A88763]">Resend in {otpTimer}s</span>
                 ) : (
                    <button 
                        type="button"
                        onClick={handleCustomerOtpResend}
                        disabled={loading}
                        className="text-xs font-semibold text-[#B8641A] hover:underline disabled:text-[#C4A882] disabled:no-underline"
                    >
                        Resend Code
                    </button>
                 )}
              </div>
            </form>
          )}

          {/* FOOTER LINK */}
          <div className="mt-6 border-t border-[#F2EDE4] pt-6 text-center">
            <p className="text-sm text-[#8B7355]">
              New user?{" "}
              <Link
                to="/customer/register"
                className="font-bold text-[#B8641A] hover:underline"
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
