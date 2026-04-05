import { useEffect, useState } from "react";
import client from "../../api/client";
import {
  User,
  Phone,
  Building2,
  Droplets,
  Calendar,
  ArrowRight,
  Loader2,
  X,
} from "lucide-react";

const initialFormData = {
  customerName: "",
  email: "",
  phoneNumber: "",
  buildingName: "",
  wing: "",
  roomNo: "",
  defaultMilkQuantityLiters: 1.0,
  billingCycle: "Monthly",
};

export default function AddCustomerModal({ open, onClose, onCreated }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setFormData(initialFormData);
      setError("");
      setLoading(false);
    }
  }, [open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateStep1 = () => {
    if (!formData.customerName.trim()) return "Please enter Full Name";
    if (!formData.email.trim()) return "Email is required";
    if (!formData.phoneNumber || formData.phoneNumber.length !== 10) {
      return "Valid 10-digit Mobile Number is required";
    }
    return null;
  };

  const handleNext = (e) => {
    e.preventDefault();
    const validationError = validateStep1();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setCurrentStep(2);
  };

  const closeModal = () => {
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data } = await client.post("/customer/addCustomer", formData);

      alert("Customer added successfully.");
      const createdCustomer = data?.customer || null;
      closeModal();
      if (onCreated) onCreated(createdCustomer);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={closeModal} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden">
          <div className="px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Add New Customer</h2>
              <p className="text-sm text-gray-500">
                Step {currentStep} of 2: {currentStep === 1 ? "Personal Details" : "Address & Plan"}
              </p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="h-9 w-9 rounded-full border border-red-100 text-red-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 flex items-center justify-center"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <form
            onSubmit={currentStep === 1 ? handleNext : handleSubmit}
            className="p-6 space-y-5 max-h-[85vh] overflow-y-auto"
          >
            {error && <div className="p-3 text-sm bg-red-50 text-red-600 rounded-lg">{error}</div>}

            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input
                      type="text"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleChange}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      placeholder="9876543210"
                      maxLength={10}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="rahul@gmail.com"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2"
                >
                  Next Step <ArrowRight size={18} />
                </button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Building Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input
                      type="text"
                      name="buildingName"
                      value={formData.buildingName}
                      onChange={handleChange}
                      placeholder="Galaxy Apartments"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Wing (Opt)</label>
                    <input
                      type="text"
                      name="wing"
                      value={formData.wing}
                      onChange={handleChange}
                      placeholder="A"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Room No</label>
                    <input
                      type="text"
                      name="roomNo"
                      value={formData.roomNo}
                      onChange={handleChange}
                      placeholder="101"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Daily Milk (L)</label>
                    <div className="relative">
                      <Droplets className="absolute left-3 top-3 text-blue-500" size={18} />
                      <input
                        type="number"
                        step="0.5"
                        name="defaultMilkQuantityLiters"
                        value={formData.defaultMilkQuantityLiters}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2.5 bg-blue-50 border border-blue-100 text-blue-900 font-semibold rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Billing</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 text-gray-400" size={18} />
                      <select
                        name="billingCycle"
                        value={formData.billingCycle}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                      >
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="w-1/3 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-2/3 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : "Finish Registration"}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
