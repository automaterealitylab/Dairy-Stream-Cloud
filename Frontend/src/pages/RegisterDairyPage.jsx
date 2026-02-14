import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from "react-hot-toast";
import { 
  Building2, MapPin, User, CreditCard, CheckCircle, 
  ArrowRight, ArrowLeft, Upload, Loader2, ShieldCheck, 
  LayoutDashboard, Users, BarChart3, ChevronRight 
} from 'lucide-react';
import { registerDairyApi } from '../api/admin.api';

const RegisterDairyPage = () => {
  const navigate = useNavigate();
  
  // --- STATE MANAGEMENT ---
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    // Step 1: Dairy Details
    dairyName: '',
    dairyPhone: '',
    dairyEmail: '',
    gstin: '',
    category: 'Milk & Dairy',
    
    // Step 2: Location
    address: '',
    city: '',
    state: '',
    pincode: '',
    serviceType: 'PINCODE', // 'PINCODE' or 'RADIUS'
    servicePincodes: '',
    serviceRadius: '5',

    // Step 3: Owner Admin
    ownerName: '',
    adminEmail: '',
    adminMobile: '',
    password: '',
    confirmPassword: '',

    // Step 4: Plan
    selectedPlan: 'GROWTH' // 'STARTER' | 'GROWTH' | 'ENTERPRISE'
  });

  // --- HANDLERS ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePlanSelect = (plan) => {
    setFormData(prev => ({ ...prev, selectedPlan: plan }));
  };

  // --- VALIDATION (Simple Check) ---
  const validateStep = (step) => {
    if (step === 1) return formData.dairyName && formData.dairyPhone;
    if (step === 2) return formData.address && formData.city && formData.pincode;
    if (step === 3) return formData.ownerName && formData.adminEmail && formData.password === formData.confirmPassword;
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    } else {
      alert("Please fill all required fields correctly.");
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  // --- SUBMIT ---
  const handleSubmit = async () => {
    // Validate all required fields before submitting
    const requiredFields = {
      dairyName: formData.dairyName,
      dairyPhone: formData.dairyPhone,
      dairyEmail: formData.dairyEmail,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      ownerName: formData.ownerName,
      adminEmail: formData.adminEmail,
      adminMobile: formData.adminMobile,
      password: formData.password,
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      alert(`Please fill in all required fields: ${missingFields.join(", ")}`);
      return;
    }

    // Validate password confirmation
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    setLoading(true);
    try {
      // Log the data being sent
      const submitData = {
        dairyName: formData.dairyName,
        dairyPhone: formData.dairyPhone,
        dairyEmail: formData.dairyEmail,
        gstin: formData.gstin,
        category: formData.category,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        serviceType: formData.serviceType,
        servicePincodes: formData.servicePincodes,
        serviceRadius: formData.serviceRadius,
        ownerName: formData.ownerName,
        adminEmail: formData.adminEmail,
        adminMobile: formData.adminMobile,
        password: formData.password,
        selectedPlan: formData.selectedPlan,
      };

      console.log("📤 Submitting dairy registration with data:", submitData);

      // Call the backend API
      const response = await registerDairyApi(submitData);

      console.log("✅ Dairy registered successfully:", response);

      // Auto-login: Store admin token and user data
      if (response.data?.token) {
        localStorage.setItem("adminToken", response.data.token);
        localStorage.setItem("adminUser", JSON.stringify(response.data.admin));
        console.log("✅ Admin auto-logged in with token");
      }

      setLoading(false);
      setIsSuccess(true);

      // Auto-redirect to admin dashboard after 2 seconds
      setTimeout(() => {
        navigate("/admin/AdminDashboard");
      }, 2000);
    } catch (err) {
      console.error("❌ Dairy registration error:", err);
      toast.error(err.message || "Registration failed");
      setLoading(false);
    }
  };

  // --- SUCCESS SCREEN (Post-Registration) ---
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-lg w-full p-10 rounded-2xl shadow-xl text-center">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Workspace Created!</h2>
          <p className="text-gray-500 mb-8">
            <span className="font-semibold text-gray-800">{formData.dairyName}</span> has been registered successfully. You can now start setting up your products.
          </p>
          
          <div className="bg-blue-50 p-4 rounded-xl text-left mb-8 border border-blue-100">
             <div className="flex gap-3 mb-2">
                <ShieldCheck className="text-blue-600" size={20}/>
                <span className="font-semibold text-gray-700">Next Steps:</span>
             </div>
             <ul className="text-sm text-gray-600 space-y-1 ml-8 list-disc">
                <li>Verify your email address</li>
                <li>Add your first product</li>
                <li>Set up delivery routes</li>
             </ul>
          </div>

          <button 
            onClick={() => navigate('/admin/AdminDashboard')} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md hover:shadow-lg"
          >
            Go to Admin Console
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4">
      
      {/* --- HEADER --- */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Register Your Dairy</h1>
        <p className="text-gray-500 mt-2">Create your business workspace in minutes</p>
      </div>

      {/* --- STEPPER --- */}
      <div className="w-full max-w-4xl mb-8">
        <div className="flex justify-between items-center relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-0"></div>
          {[
            { id: 1, label: "Details", icon: Building2 },
            { id: 2, label: "Location", icon: MapPin },
            { id: 3, label: "Owner", icon: User },
            { id: 4, label: "Plan", icon: CreditCard },
            { id: 5, label: "Review", icon: CheckCircle },
          ].map((step) => (
            <div key={step.id} className="relative z-10 flex flex-col items-center bg-slate-50 px-2">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  currentStep >= step.id 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                <step.icon size={18} />
              </div>
              <span className={`text-xs font-semibold mt-2 ${currentStep >= step.id ? 'text-blue-700' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* --- MAIN FORM CARD --- */}
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* === STEP 1: DAIRY DETAILS === */}
        {currentStep === 1 && (
          <div className="p-8 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-bold mb-6">Dairy Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Dairy Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" name="dairyName" value={formData.dairyName} onChange={handleChange}
                  placeholder="e.g. Nandanvan Farms" 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>

              <div>
                 <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                 <select name="category" value={formData.category} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>Milk & Dairy</option>
                    <option>Organic Farm</option>
                    <option>Agro Products</option>
                 </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Official Phone <span className="text-red-500">*</span></label>
                <input type="tel" name="dairyPhone" value={formData.dairyPhone} onChange={handleChange} placeholder="9876543210" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Official Email</label>
                <input type="email" name="dairyEmail" value={formData.dairyEmail} onChange={handleChange} placeholder="contact@dairy.com" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div className="col-span-2">
                 <label className="block text-sm font-semibold text-gray-700 mb-1">Logo Upload (Optional)</label>
                 <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition cursor-pointer">
                    <Upload size={32} className="mb-2"/>
                    <span className="text-sm">Click to upload brand logo</span>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* === STEP 2: LOCATION === */}
        {currentStep === 2 && (
          <div className="p-8 animate-in fade-in slide-in-from-right-4">
             <h2 className="text-xl font-bold mb-6">Location & Service Area</h2>
             <div className="space-y-6">
                
                {/* Address */}
                <div>
                   <label className="block text-sm font-semibold text-gray-700 mb-1">Full Address <span className="text-red-500">*</span></label>
                   <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Shop No. 12, Market Yard" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                <div className="grid grid-cols-3 gap-4">
                   <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                      <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                   <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">State</label>
                      <input type="text" name="state" value={formData.state} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                   <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Pincode <span className="text-red-500">*</span></label>
                      <input type="text" name="pincode" value={formData.pincode} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                </div>

                {/* Service Type */}
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                   <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2"><MapPin size={18}/> Delivery Rules</h3>
                   
                   <div className="flex gap-6 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                         <input type="radio" name="serviceType" value="PINCODE" checked={formData.serviceType === 'PINCODE'} onChange={handleChange} className="text-blue-600 focus:ring-blue-500"/>
                         <span className="text-sm font-medium">Specific Pincodes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                         <input type="radio" name="serviceType" value="RADIUS" checked={formData.serviceType === 'RADIUS'} onChange={handleChange} className="text-blue-600 focus:ring-blue-500"/>
                         <span className="text-sm font-medium">Distance Radius</span>
                      </label>
                   </div>

                   {formData.serviceType === 'PINCODE' ? (
                      <div>
                         <label className="block text-sm font-semibold text-gray-700 mb-1">Enter Serviceable Pincodes</label>
                         <input type="text" name="servicePincodes" value={formData.servicePincodes} onChange={handleChange} placeholder="411001, 411002, 411005" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                         <p className="text-xs text-gray-500 mt-1">Separate multiple pincodes with commas</p>
                      </div>
                   ) : (
                      <div>
                         <label className="block text-sm font-semibold text-gray-700 mb-1">Delivery Radius (KM)</label>
                         <input type="number" name="serviceRadius" value={formData.serviceRadius} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                   )}
                </div>

             </div>
          </div>
        )}

        {/* === STEP 3: OWNER ADMIN === */}
        {currentStep === 3 && (
           <div className="p-8 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-xl font-bold mb-6">Create Admin Account</h2>
              <p className="text-sm text-gray-500 mb-6 bg-yellow-50 p-3 rounded-lg border border-yellow-100 flex gap-2">
                 <ShieldCheck className="text-yellow-600" size={18}/>
                 This account will have full access to manage the dairy.
              </p>

              <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Owner Name <span className="text-red-500">*</span></label>
                    <input type="text" name="ownerName" value={formData.ownerName} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Admin Mobile <span className="text-red-500">*</span></label>
                       <input type="tel" name="adminMobile" value={formData.adminMobile} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Admin Email <span className="text-red-500">*</span></label>
                       <input type="email" name="adminEmail" value={formData.adminEmail} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                       <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
                       <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* === STEP 4: PLAN === */}
        {currentStep === 4 && (
           <div className="p-8 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-xl font-bold mb-6 text-center">Choose a Plan</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {/* Starter */}
                 <div onClick={() => handlePlanSelect('STARTER')} className={`cursor-pointer border-2 rounded-2xl p-6 transition-all ${formData.selectedPlan === 'STARTER' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                    <h3 className="text-lg font-bold text-gray-800">Starter</h3>
                    <p className="text-2xl font-bold mt-2">₹0 <span className="text-sm font-normal text-gray-500">/mo</span></p>
                    <ul className="mt-4 space-y-2 text-sm text-gray-600">
                       <li className="flex gap-2"><CheckCircle size={16} className="text-green-500"/> Up to 50 Customers</li>
                       <li className="flex gap-2"><CheckCircle size={16} className="text-green-500"/> Basic Analytics</li>
                    </ul>
                 </div>

                 {/* Growth */}
                 <div onClick={() => handlePlanSelect('GROWTH')} className={`cursor-pointer border-2 rounded-2xl p-6 transition-all relative ${formData.selectedPlan === 'GROWTH' ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-100' : 'border-gray-200 hover:border-blue-300'}`}>
                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-lg">POPULAR</div>
                    <h3 className="text-lg font-bold text-gray-800">Growth</h3>
                    <p className="text-2xl font-bold mt-2">₹999 <span className="text-sm font-normal text-gray-500">/mo</span></p>
                    <ul className="mt-4 space-y-2 text-sm text-gray-600">
                       <li className="flex gap-2"><CheckCircle size={16} className="text-green-500"/> 500 Customers</li>
                       <li className="flex gap-2"><CheckCircle size={16} className="text-green-500"/> WhatsApp Support</li>
                       <li className="flex gap-2"><CheckCircle size={16} className="text-green-500"/> Route Management</li>
                    </ul>
                 </div>

                 {/* Enterprise */}
                 <div onClick={() => handlePlanSelect('ENTERPRISE')} className={`cursor-pointer border-2 rounded-2xl p-6 transition-all ${formData.selectedPlan === 'ENTERPRISE' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                    <h3 className="text-lg font-bold text-gray-800">Enterprise</h3>
                    <p className="text-2xl font-bold mt-2">₹2999 <span className="text-sm font-normal text-gray-500">/mo</span></p>
                    <ul className="mt-4 space-y-2 text-sm text-gray-600">
                       <li className="flex gap-2"><CheckCircle size={16} className="text-green-500"/> Unlimited</li>
                       <li className="flex gap-2"><CheckCircle size={16} className="text-green-500"/> Custom Domain</li>
                       <li className="flex gap-2"><CheckCircle size={16} className="text-green-500"/> Priority Support</li>
                    </ul>
                 </div>
              </div>
           </div>
        )}

        {/* === STEP 5: REVIEW === */}
        {currentStep === 5 && (
           <div className="p-8 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-xl font-bold mb-6">Review & Confirm</h2>
              
              <div className="bg-gray-50 rounded-xl p-6 space-y-4 border border-gray-200">
                 <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                    <div>
                       <p className="text-sm text-gray-500">Dairy Name</p>
                       <p className="font-bold text-lg">{formData.dairyName}</p>
                    </div>
                    <Building2 className="text-gray-300" size={24}/>
                 </div>

                 <div className="grid grid-cols-2 gap-4 border-b border-gray-200 pb-4">
                    <div>
                       <p className="text-sm text-gray-500">Owner</p>
                       <p className="font-semibold">{formData.ownerName}</p>
                    </div>
                    <div>
                       <p className="text-sm text-gray-500">Contact</p>
                       <p className="font-semibold">{formData.adminMobile}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <p className="text-sm text-gray-500">Location</p>
                       <p className="font-semibold">{formData.city} ({formData.pincode})</p>
                    </div>
                    <div>
                       <p className="text-sm text-gray-500">Selected Plan</p>
                       <p className="font-bold text-blue-600">{formData.selectedPlan}</p>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* --- FOOTER BUTTONS --- */}
        <div className="bg-gray-50 p-6 flex justify-between items-center border-t border-gray-200">
           
           {currentStep > 1 ? (
              <button 
                onClick={handleBack} 
                className="flex items-center gap-2 text-gray-600 font-semibold px-6 py-2 hover:bg-gray-200 rounded-lg transition"
              >
                 <ArrowLeft size={18} /> Back
              </button>
           ) : (
              <div></div> // Empty div for spacing
           )}

           {currentStep < 5 ? (
              <button 
                onClick={handleNext} 
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition shadow-md hover:shadow-lg"
              >
                 Next <ArrowRight size={18} />
              </button>
           ) : (
              <button 
                onClick={handleSubmit} 
                disabled={loading}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 rounded-lg transition shadow-md hover:shadow-lg"
              >
                 {loading ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18} />}
                 Create Workspace
              </button>
           )}

        </div>

      </div>
    </div>
  );
};

export default RegisterDairyPage;
