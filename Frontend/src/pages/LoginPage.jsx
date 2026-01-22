import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck, MapPin, Eye, EyeOff, Lock, User, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import dairyImage from "../assets/dairyproduct.png";

// --- 1. ADVANCED MOCK API (Simulating all PDF Scenarios) ---
const mockDetectAPI = async (identifier) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const id = identifier.toUpperCase();

      // SCENARIO 1: STAFF (Standard Flow)
      if (id.startsWith('STF')) {
        resolve({
          userType: 'STAFF',
          name: 'Staff Member',
          dairy: { id: 'D01', name: 'Nandanvan Dairy', isVerified: true },
          nextStep: 'CONFIRMATION' // Goes to Screen B first [cite: 144]
        });
      } 
      // SCENARIO 2: ADMIN
      else if (id.includes('@')) {
        resolve({
          userType: 'ADMIN',
          name: 'Dairy Owner',
          dairy: { id: 'D02', name: 'Shree Dairy', isVerified: true },
          nextStep: 'PASSWORD' // Admins skip confirmation usually, or can show it
        });
      } 
      // SCENARIO 3: CUSTOMER (Multi-Dairy) -> Try entering '8888888888'
      else if (id === '8888888888') {
        resolve({
          userType: 'CUSTOMER',
          membership: 'MULTIPLE',
          dairies: [
            { id: 'D01', name: 'Nandanvan Dairy', location: 'Pune' },
            { id: 'D02', name: 'Pune Fresh Dairy', location: 'Mumbai' }
          ],
          nextStep: 'SELECT_DAIRY' // Triggers Modal [cite: 122]
        });
      }
      // SCENARIO 4: NEW USER -> Try entering '9999999999'
      else if (id === '9999999999') {
        resolve({
          userType: 'CUSTOMER',
          membership: 'NONE',
          nextStep: 'EXPLORE' // Redirects to profile creation [cite: 128]
        });
      }
      // SCENARIO 5: CUSTOMER (Single Dairy) -> Any other 10 digit number
      else if (id.length === 10) {
        resolve({
          userType: 'CUSTOMER',
          membership: 'SINGLE',
          dairy: { id: 'D01', name: 'Nandanvan Dairy', isVerified: true },
          nextStep: 'OTP' // Standard Customer Flow [cite: 111]
        });
      } 
      else {
        resolve(null);
      }
    }, 1200);
  });
};

const LoginPage = () => {
  const navigate = useNavigate();
  
  // Logic States
  const [step, setStep] = useState('IDENTIFIER'); // IDENTIFIER | CONFIRMATION | SELECT_DAIRY | PASSWORD | OTP
  const [identifier, setIdentifier] = useState('');
  const [detectedUser, setDetectedUser] = useState(null);
  const [selectedDairy, setSelectedDairy] = useState(null);
  
  // Input States
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- HANDLER: SMART DETECT ---
  const handleIdentifierSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // 1. Strict Validation [cite: 140-142]
    const isEmail = identifier.includes('@');
    const isStaffId = identifier.toUpperCase().startsWith('STF');
    const isMobile = /^\d{10}$/.test(identifier);

    if (!isEmail && !isStaffId && !isMobile) {
      setError("Please enter a valid Email, 10-digit Mobile, or Staff ID (STF...)");
      return;
    }

    setLoading(true);

    try {
      const response = await mockDetectAPI(identifier);
      
      if (response) {
        setDetectedUser(response);

        // Handle New User immediately [cite: 128, 179]
        if (response.nextStep === 'EXPLORE') {
           navigate('/register'); // Or /customer/setup-profile
           return;
        }

        // Handle Single Dairy Auto-Select
        if (response.dairy) {
            setSelectedDairy(response.dairy);
        }

        setStep(response.nextStep);
      } else {
        setError('Account not found. Please register first.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLER: DAIRY SELECTION (For Multi-Dairy Users) ---
  const handleDairySelect = (dairy) => {
    setSelectedDairy(dairy);
    setStep('OTP'); // After selecting, go to OTP [cite: 227]
  };

  // --- HANDLER: FINAL LOGIN ---
  const handleFinalLogin = (e) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      // Routing Logic [cite: 236-238]
      const role = detectedUser.userType;
      localStorage.setItem("userRole", role);
      localStorage.setItem("dairyId", selectedDairy?.id);

      if (role === 'CUSTOMER') navigate('/customer-dashboard');
      else if (role === 'STAFF') navigate('/staff/home');
      else if (role === 'ADMIN') navigate('/admin/dashboard');
    }, 1000);
  };

  // --- HELPER: RESET ---
  const handleReset = () => {
      setStep('IDENTIFIER'); 
      setDetectedUser(null); 
      setPassword(''); 
      setOtp('');
      setSelectedDairy(null);
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      
      {/* --- LEFT SIDE: BRANDING --- */}
      <div className="hidden md:flex w-1/2 bg-blue-600 items-center justify-center p-12 relative overflow-hidden">
        <div className="relative z-10 text-white max-w-lg">
          <h1 className="text-5xl font-bold mb-6 tracking-tight">Dairy Automation</h1>
          <p className="text-xl text-blue-100 mb-8 leading-relaxed">
            The complete fresh milk delivery system. Manage customers, track deliveries, and automate billing.
          </p>
          <div className="flex gap-4">
             <div className="flex items-center gap-2 bg-blue-500/40 px-4 py-2 rounded-lg backdrop-blur-md border border-blue-400/30">
                <ShieldCheck size={20} /><span>Register new Dairy</span>
             </div>
             <div className="flex items-center gap-2 bg-blue-500/40 px-4 py-2 rounded-lg backdrop-blur-md border border-blue-400/30">
                <MapPin size={20} /><span>Nearby Dairies</span>
             </div>
          </div>
        </div>
        <div className="absolute -bottom-40 -right-20 w-96 h-96 bg-blue-400/30 rounded-full blur-3xl"></div>
      </div>

      {/* --- RIGHT SIDE: LOGIN FORM --- */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-md">
          
          {/* HEADER */}
          <div className="text-center mb-8">
            <img src={dairyImage} alt="Dairy" className="h-16 w-auto mx-auto mb-4 object-contain" />
            <h2 className="text-2xl font-bold text-gray-900">
                {step === 'IDENTIFIER' ? 'Welcome Back' : 'Sign In'}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
                {step === 'IDENTIFIER' && "Enter your Email, Mobile, or Staff ID"}
                {step === 'CONFIRMATION' && "Verify your account details"}
                {step === 'SELECT_DAIRY' && "Select a dairy to continue"}
                {step === 'OTP' && `Verifying ${identifier}`}
            </p>
          </div>

          {/* ERROR ALERT */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* --- STEP 1: IDENTIFIER --- */}
          {step === 'IDENTIFIER' && (
            <form onSubmit={handleIdentifierSubmit} className="space-y-5">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. 9876543210 or STF1023 or admin@gmail.com"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-sm transition-all flex justify-center items-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={20} /> : "Continue"}
              </button>
            </form>
          )}

          {/* --- STEP 1.5: CONFIRMATION (Screen B) [cite: 144] --- */}
          {step === 'CONFIRMATION' && selectedDairy && (
            <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl text-center">
                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-2">Signing in to</p>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedDairy.name}</h3>
                    {selectedDairy.isVerified && (
                        <div className="inline-flex items-center gap-1 text-green-600 text-sm font-medium bg-green-100 px-3 py-1 rounded-full mt-2">
                            <ShieldCheck size={14} /> Verified Business
                        </div>
                    )}
                    <div className="mt-6 pt-6 border-t border-blue-200/50">
                        <p className="text-sm text-gray-500 mb-1">Account Identifier</p>
                        <p className="font-mono font-medium text-gray-800">{identifier}</p>
                    </div>
                </div>

                <button 
                    onClick={() => setStep(detectedUser.userType === 'CUSTOMER' ? 'OTP' : 'PASSWORD')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-sm"
                >
                    Continue to Login
                </button>
                <button onClick={handleReset} className="w-full text-gray-500 text-sm hover:text-gray-700">Change Account</button>
            </div>
          )}

          {/* --- STEP 2: MULTI-DAIRY SELECTION [cite: 220] --- */}
          {step === 'SELECT_DAIRY' && (
             <div className="space-y-4">
                <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                    {detectedUser.dairies.map((dairy) => (
                        <div 
                            key={dairy.id}
                            onClick={() => handleDairySelect(dairy)}
                            className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all flex items-center justify-between group"
                        >
                            <div>
                                <h4 className="font-semibold text-gray-900">{dairy.name}</h4>
                                <p className="text-sm text-gray-500">{dairy.location}</p>
                            </div>
                            <ChevronRight className="text-gray-300 group-hover:text-blue-500" size={20} />
                        </div>
                    ))}
                </div>
                <button onClick={handleReset} className="w-full text-gray-500 text-sm hover:text-gray-700 mt-4">Cancel</button>
             </div>
          )}

          {/* --- STEP 3: PASSWORD --- */}
          {step === 'PASSWORD' && (
            <form onSubmit={handleFinalLogin} className="space-y-5">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password"
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-sm flex justify-center items-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={20} /> : "Login"}
              </button>
              <button type="button" onClick={handleReset} className="w-full text-gray-500 text-sm hover:text-gray-700">Back</button>
            </form>
          )}

          {/* --- STEP 4: OTP --- */}
          {step === 'OTP' && (
            <form onSubmit={handleFinalLogin} className="space-y-5">
              <div className="text-center">
                <input
                  type="text"
                  maxLength="6"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="000000"
                  className="w-full text-center text-3xl font-bold tracking-[0.5em] py-4 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-3">Resend OTP in 00:30</p>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg shadow-sm flex justify-center items-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={20} /> : "Verify & Login"}
              </button>
              <button type="button" onClick={handleReset} className="w-full text-gray-500 text-sm hover:text-gray-700">Change Number</button>
            </form>
          )}

          {/* FOOTER LINKS (Only on first step) */}
          {step === 'IDENTIFIER' && (
            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                <div className="flex justify-center gap-6 text-sm text-gray-500 mb-6">
                    <a href="#" className="hover:text-blue-600 flex items-center gap-1"><MapPin size={14}/> Explore Dairies</a>
                    <a href="#" className="hover:text-blue-600">Register Dairy</a>
                </div>
                <div className="text-xs text-gray-400">
                    <a href="#" className="hover:underline">Terms</a> &bull; <a href="#" className="hover:underline">Privacy</a>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;