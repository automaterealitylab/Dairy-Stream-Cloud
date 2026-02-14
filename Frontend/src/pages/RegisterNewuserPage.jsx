import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { 
  User, Phone, Building2, MapPin, Droplets, Calendar, 
  ArrowRight, ArrowLeft, CheckCircle, Loader2, AlertCircle, ShieldCheck 
} from "lucide-react";
import dairyImage from "../assets/dairyproduct.png";



const CustomerRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // --- STATE ---
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
   customerName: "",
  email: "",
  password: "",
  phoneNumber: "",
  buildingName: "",
  wing: "",
  roomNo: "",
  defaultMilkQuantityLiters: 1.0,
  billingCycle: "Monthly",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --- AUTO-FILL PHONE ---
  useEffect(() => {
    if (location.state?.mobile) {
      setFormData(prev => ({ ...prev, phoneNumber: location.state.mobile }));
    }
  }, [location.state]);

  // --- HANDLERS ---
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateStep1 = () => {
  if (!formData.customerName.trim()) return "Please enter your Full Name";
  if (!formData.email.trim()) return "Email is required";
  if (!formData.password || formData.password.length < 6)
    return "Password must be at least 6 characters";
  if (!formData.phoneNumber || formData.phoneNumber.length !== 10)
    return "Valid 10-digit Mobile Number is required";
  return null;
};


  const validateStep2 = () => {
    if (!formData.buildingName.trim()) return "Building Name is required";
    if (!formData.roomNo.trim()) return "Room Number is required";
    return null;
  };

  const handleNext = (e) => {
    e.preventDefault();
    const err = validateStep1();
    if (err) setError(err);
    else {
      setError("");
      setCurrentStep(2);
    }
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError("");

  try {
    const payload = {
      customerName: formData.customerName,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      buildingName: formData.buildingName,
      wing: formData.wing,
      roomNo: formData.roomNo,
      password: formData.password,
      defaultMilkQuantityLiters: formData.defaultMilkQuantityLiters,
      billingCycle: formData.billingCycle,
    };

    console.log("📤 SENDING PAYLOAD:", payload);

    const res = await fetch("http://localhost:4000/api/customer/addCustomer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMessage = data?.message || data?.error || "Registration failed";
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
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
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      
      {/* --- LEFT SIDE: BRANDING (Matches Login) --- */}
      <div className="hidden md:flex w-1/2 bg-blue-600 items-center justify-center p-12 relative">
        <div className="relative z-10 text-white max-w-lg">
          <h1 className="text-5xl font-bold mb-6 tracking-tight">Join DairyStream</h1>
          <p className="text-xl text-blue-100 mb-8 leading-relaxed">
            Create your account to start managing your daily milk delivery, billing, and vacations effortlessly.
          </p>
          <div className="flex gap-4">
             <div className="flex items-center gap-2 bg-blue-500/40 px-4 py-2 rounded-lg backdrop-blur-md border border-blue-400/30">
                <ShieldCheck size={20} /><span>Secure Data</span>
             </div>
             <div className="flex items-center gap-2 bg-blue-500/40 px-4 py-2 rounded-lg backdrop-blur-md border border-blue-400/30">
                <CheckCircle size={20} /><span>Easy Billing</span>
             </div>
          </div>
        </div>
        {/* Decor */}
        <div className="absolute -bottom-40 -right-20 w-96 h-96 bg-blue-400/30 rounded-full blur-3xl"></div>
      </div>

      {/* --- RIGHT SIDE: COMPACT FORM --- */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-6 bg-white relative">
        
        <div className="w-full max-w-md">
          
          {/* Header */}
          <div className="text-center mb-6">
            <img src={dairyImage} alt="Logo" className="h-16 w-auto mx-auto mb-2 object-contain" />
            <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
            <p className="text-gray-500 text-sm">Step {currentStep} of 2: {currentStep === 1 ? "Personal Details" : "Address & Plan"}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={currentStep === 1 ? handleNext : handleSubmit}>
            
            {/* === STEP 1: NAME & MOBILE === */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    <input
                      type="text"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleChange}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      placeholder="9876543210"
                      maxLength={10}
                      // If phone was passed from login, lock it slightly to show it's pre-filled
                      className={`w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${location.state?.mobile ? 'bg-blue-50/50 text-gray-600' : 'bg-gray-50'}`}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">This will be your login ID.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="rahul@gmail.com"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                  />
                </div>

                <button type="submit" className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all">
                  Next Step <ArrowRight size={18} />
                </button>
              </div>
            )}

            {/* === STEP 2: ADDRESS & PLAN === */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                
                {/* Building */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Building Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    <input
                      type="text"
                      name="buildingName"
                      value={formData.buildingName}
                      onChange={handleChange}
                      placeholder="Galaxy Apartments"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Wing & Room */}
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Wing (Opt)</label>
                      <input type="text" name="wing" value={formData.wing} onChange={handleChange} placeholder="A" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                   <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Room No</label>
                      <input type="text" name="roomNo" value={formData.roomNo} onChange={handleChange} placeholder="101" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                </div>

                {/* Plan Details */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                   <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Daily Milk (L)</label>
                      <div className="relative">
                         <Droplets className="absolute left-3 top-3.5 text-blue-500" size={18} />
                         <input type="number" step="0.5" name="defaultMilkQuantityLiters" value={formData.defaultMilkQuantityLiters} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-blue-50 border border-blue-100 text-blue-900 font-bold rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                   </div>
                   <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Billing</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3.5 text-gray-400" size={18} />
                        <select name="billingCycle" value={formData.billingCycle} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                           <option>Daily</option>
                           <option>Weekly</option>
                           <option>Monthly</option>
                        </select>
                      </div>
                   </div>
                </div>

                <div className="flex gap-3 mt-6">
                   <button type="button" onClick={() => setCurrentStep(1)} className="w-1/3 py-3 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 font-semibold transition">Back</button>
                   <button type="submit" disabled={loading} className="w-2/3 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all">
                     {loading ? <Loader2 className="animate-spin" size={20} /> : "Finish Registration"}
                   </button>
                </div>
              </div>
              
            )}

          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-400">
             By joining, you agree to our <a href="#" className="underline">Terms</a> & <a href="#" className="underline">Privacy Policy</a>.
             <div className="mt-2">
                Already have an account? <span onClick={() => navigate('/')} className="text-blue-600 font-bold cursor-pointer hover:underline">Log in</span>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CustomerRegister;
