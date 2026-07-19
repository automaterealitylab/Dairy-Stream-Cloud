import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import { superAdminLoginApi } from "../../api/superAdmin.api.js";
import toast from "react-hot-toast";
import { ShieldAlert, Mail, Lock, KeyRound, Eye, EyeOff } from "lucide-react";

const SuperAdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [require2FA, setRequire2FA] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setLoading(true);
    try {
      const response = await superAdminLoginApi(email, password);

      if (response.success) {
        if (response.user.twoFactorEnabled && !twoFactorCode) {
          // Trigger 2FA step
          setRequire2FA(true);
          setLoading(false);
          toast.success("Password verified. Please enter 2FA code.");
          return;
        }

        // Complete Login
        login({
          token: response.token,
          role: response.user.role,
          user: response.user,
        });

        toast.success(`Welcome back, ${response.user.name}!`);
        navigate("/super-admin/dashboard");
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || "Failed to log in";
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Neon Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse duration-3000"></div>

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl shadow-cyan-950/20 relative z-10">
        
        {/* Portal Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-white mb-4 shadow-lg shadow-cyan-500/30">
            <ShieldAlert size={32} className="animate-pulse" />
          </div>
          <h1 className="font-extrabold text-2xl bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
            DairyStream Cloud
          </h1>
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold font-mono mt-1">
            Super Admin Access Portal
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {!require2FA ? (
            <>
              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@dairystream.com"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/80 outline-none text-slate-200 transition-all duration-200 text-sm"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-slate-400 font-medium">Password</label>
                  <a href="#forgot" className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-11 py-3 rounded-xl bg-slate-950/40 border border-slate-800 focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/80 outline-none text-slate-200 transition-all duration-200 text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* 2FA Verification Form */
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs text-slate-400 font-medium">Two-Factor Authentication Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="Enter 6-digit Authenticator OTP"
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/80 outline-none text-slate-200 transition-all duration-200 text-sm tracking-wider font-mono text-center"
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => setRequire2FA(false)}
                className="text-xs text-slate-500 hover:text-slate-400 mt-2 block"
              >
                ← Back to Password
              </button>
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 active:scale-98 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer mt-2"
          >
            {loading ? "Authorizing Security Session..." : require2FA ? "Verify & Sign In" : "Establish Secure Session"}
          </button>
        </form>

        {/* Security Footer Notice */}
        <div className="mt-8 text-center border-t border-slate-850 pt-4">
          <p className="text-[10px] text-slate-600 leading-normal">
            Unauthorized platform access attempts are strictly monitored, logged, and will lead to immediate IP suspension and investigation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
