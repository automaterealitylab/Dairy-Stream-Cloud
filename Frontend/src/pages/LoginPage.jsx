import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth.jsx"; // Adjust path if needed

import {
  Loader2, User, AlertCircle, ArrowRight
} from "lucide-react";

import dairyImage from "../assets/dairyproduct-badge.jpg";

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

import { DASHBOARD_VISITED_FLAG, headingFont } from "../constants/loginPage.js";
import {
  normalizeIdentifier,
  normalizeStaffId,
  sanitizeOtp,
  validateIdentifier,
  getErrorMessage,
  getOtpRequestsRemaining,
} from "../utils/loginPage.js";
import { MobileTopLogoCard, MobileBrandCard, LeftBrandPanel } from "../components/login/BrandPanels.jsx";
import { IdentityDisplay } from "../components/login/IdentityDisplay.jsx";
import { RoleBadge } from "../components/login/RoleBadge.jsx";
import { PasswordField } from "../components/login/PasswordField.jsx";
import { PasswordResetForm } from "../components/login/PasswordResetForm.jsx";

const LoginPage = () => {
  const { login, user, loading: authLoading } = useAuth();
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
    if (!authLoading && user) {
      const role = String(user.role || "").toUpperCase();
      if (role === "ADMIN") {
        navigate("/admin/AdminDashboard", { replace: true });
      } else if (role === "AGENT" || role === "STAFF") {
        navigate("/agent/dashboard", { replace: true });
      } else if (role === "CUSTOMER") {
        navigate("/customer/dashboard", { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

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
    const normalizedIdentifier = normalizeIdentifier(identifier);
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
    if (loading) return;
    setError("");
    const normalizedIdentifier = normalizeIdentifier(identifier);

    const { isEmail, isStaffId, isMobile } = validateIdentifier(normalizedIdentifier);

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
          try {
            const otpResponse = await requestOtpApi({
              identifier: normalizedIdentifier,
              dairyId: response.dairy?.id ?? selectedDairy?.id,
            });
            setOtpTimer(30);
            toast.success(otpResponse?.message || "OTP sent successfully");
          } catch (otpErr) {
            const backendMessage =
              otpErr.response?.data?.error ||
              otpErr.response?.data?.message ||
              otpErr.message ||
              "Failed to send OTP";

            setError(backendMessage);
            toast.error(backendMessage);
          }
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
    const normalizedIdentifier = normalizeIdentifier(identifier);
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
      setAdminOtpRequestsRemaining(getOtpRequestsRemaining(result));
      setAgentOtpRequestsRemaining(null);
      toast.success(result?.message || "OTP sent to registered admin email");
    } catch (err) {
      const backendMessage = getErrorMessage(err, "Failed to send OTP");
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
        identifier: normalizeIdentifier(identifier),
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
      const backendMessage = getErrorMessage(err, "Failed to reset password");
      setError(backendMessage);
      toast.error(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentForgotPasswordRequest = async () => {
    const normalizedStaffId = normalizeStaffId(identifier);
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
      setAgentOtpRequestsRemaining(getOtpRequestsRemaining(result));
      setAdminOtpRequestsRemaining(null);
      toast.success(result?.message || "OTP sent to registered agent email");
    } catch (err) {
      const backendMessage = getErrorMessage(err, "Failed to send OTP");
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
        agentId: normalizeStaffId(identifier),
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
      const backendMessage = getErrorMessage(err, "Failed to reset password");
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

  // ================= FULL JSX =================
  return (
    <div
      className="min-h-screen flex flex-col bg-[linear-gradient(180deg,#F5F0E8_0%,#FFFDF8_100%)] lg:grid lg:grid-cols-2"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ================= MOBILE TOP LOGO CARD ================= */}
      <MobileTopLogoCard onLogoClick={() => navigate("/")} />

      {/* ================= MOBILE BOTTOM BRAND CARD ================= */}
      <MobileBrandCard />

      {/* ================= LEFT BRAND SECTION ================= */}
      <LeftBrandPanel />

      {/* ================= RIGHT LOGIN FORM SECTION ================= */}
      <div className="order-2 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8 lg:order-none lg:px-4 lg:py-10">
        <div className="w-full max-w-md rounded-[28px] border border-[#E7DAC6] bg-[#FFFDF7] p-5 shadow-[0_24px_60px_rgba(44,26,14,0.12)] sm:p-8">

          {/* HEADER */}
          <div className="text-center mb-8">
            <img
              src={dairyImage}
              alt="Dairy"
              width="300"
              height="202"
              fetchPriority="high"
              decoding="async"
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
              <RoleBadge userType={detectedUser.userType} />
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
              <IdentityDisplay detectedUser={detectedUser} identifier={identifier} onReset={handleReset} />

              {!adminResetMode && !agentResetMode ? (
                <>
                  <PasswordField
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    show={showPassword}
                    onToggleShow={() => setShowPassword(!showPassword)}
                    transition
                    autoFocus
                  />

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
                <PasswordResetForm
                  infoText="OTP will be sent to your registered admin email, irrespective of email/mobile login method."
                  otp={adminResetOtp}
                  onOtpChange={setAdminResetOtp}
                  newPassword={newAdminPassword}
                  onNewPasswordChange={setNewAdminPassword}
                  showNewPassword={showNewPassword}
                  onToggleShowNewPassword={() => setShowNewPassword(!showNewPassword)}
                  confirmPassword={confirmAdminPassword}
                  onConfirmPasswordChange={setConfirmAdminPassword}
                  showConfirmPassword={showConfirmPassword}
                  onToggleShowConfirmPassword={() => setShowConfirmPassword(!showConfirmPassword)}
                  otpRequestsRemaining={adminOtpRequestsRemaining}
                  otpSent={adminResetOtpSent}
                  onRequestOtp={handleAdminForgotPasswordRequest}
                  onResendOtp={handleAdminForgotPasswordRequest}
                  onBack={() => {
                    setAdminResetMode(false);
                    setAdminResetOtpSent(false);
                    setAdminResetOtp("");
                    setNewAdminPassword("");
                    setConfirmAdminPassword("");
                    setAdminOtpRequestsRemaining(null);
                  }}
                  loading={loading}
                />
              ) : (
                <PasswordResetForm
                  infoText="OTP will be sent to the agent's registered email using your staff ID."
                  otp={agentResetOtp}
                  onOtpChange={setAgentResetOtp}
                  newPassword={newAgentPassword}
                  onNewPasswordChange={setNewAgentPassword}
                  showNewPassword={showNewPassword}
                  onToggleShowNewPassword={() => setShowNewPassword(!showNewPassword)}
                  confirmPassword={confirmAgentPassword}
                  onConfirmPasswordChange={setConfirmAgentPassword}
                  showConfirmPassword={showConfirmPassword}
                  onToggleShowConfirmPassword={() => setShowConfirmPassword(!showConfirmPassword)}
                  otpRequestsRemaining={agentOtpRequestsRemaining}
                  otpSent={agentResetOtpSent}
                  onRequestOtp={handleAgentForgotPasswordRequest}
                  onResendOtp={handleAgentForgotPasswordRequest}
                  onBack={() => {
                    setAgentResetMode(false);
                    setAgentResetOtpSent(false);
                    setAgentResetOtp("");
                    setNewAgentPassword("");
                    setConfirmAgentPassword("");
                    setAgentOtpRequestsRemaining(null);
                  }}
                  loading={loading}
                />
              )}
            </form>
          )}

          {/* STEP 3: OTP INPUT (Customer) */}
          {step === "OTP" && (
            <form onSubmit={handleFinalLogin} className="space-y-5">
              <IdentityDisplay detectedUser={detectedUser} identifier={identifier} onReset={handleReset} />

              <div className="text-center">
                 <input
                  value={otp}
                  onChange={(e) => setOtp(sanitizeOtp(e.target.value))}
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
