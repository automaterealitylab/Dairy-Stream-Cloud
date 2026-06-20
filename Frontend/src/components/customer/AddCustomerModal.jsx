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
import { useTheme } from "../admin/adminTheme";

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
  const { isDark } = useTheme();
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

  const fieldClass =
    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-[#222B40] dark:bg-[#0B0F19] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#d97706] dark:focus:ring-[#d97706]";
  const iconFieldClass =
    "w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-[#222B40] dark:bg-[#0B0F19] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#d97706] dark:focus:ring-[#d97706]";
  const labelClass = "mb-1.5 block text-sm font-bold text-gray-700 dark:text-[#C4A882]";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={closeModal} />

      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
        <div
          className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl shadow-2xl ring-1 ring-black/5 sm:max-h-[85vh] sm:rounded-2xl"
          style={{
            background: isDark ? "#121829" : "#ffffff",
            border: isDark ? "1px solid #1E293B" : "0",
            color: isDark ? "#ffffff" : "#111827",
          }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4"
            style={{
              background: isDark ? "#161C2C" : "linear-gradient(90deg, #F9FAFB, #FFFFFF)",
              borderColor: isDark ? "#1E293B" : "#E5E7EB",
            }}
          >
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Add New Customer</h2>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">
                Step {currentStep} of 2: {currentStep === 1 ? "Personal Details" : "Address & Plan"}
              </p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-red-100 text-red-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-[#222B40] dark:bg-[#0B0F19] dark:text-red-400 dark:hover:border-red-500/40 dark:hover:bg-red-500/10"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <form
            onSubmit={currentStep === 1 ? handleNext : handleSubmit}
            className="space-y-4 overflow-y-auto p-4 sm:space-y-5 sm:p-6"
            style={{ background: isDark ? "#121829" : "#ffffff" }}
          >
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
                    <input
                      type="text"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleChange}
                      placeholder="e.g. Rahul Sharma"
                      className={iconFieldClass}
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      placeholder="9876543210"
                      maxLength={10}
                      className={iconFieldClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="rahul@gmail.com"
                    className={fieldClass}
                  />
                </div>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-black text-white transition hover:bg-blue-700 dark:bg-[#d97706] dark:hover:bg-[#b45309]"
                >
                  Next Step <ArrowRight size={18} />
                </button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Building Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
                    <input
                      type="text"
                      name="buildingName"
                      value={formData.buildingName}
                      onChange={handleChange}
                      placeholder="Galaxy Apartments"
                      className={iconFieldClass}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Wing (Opt)</label>
                    <input
                      type="text"
                      name="wing"
                      value={formData.wing}
                      onChange={handleChange}
                      placeholder="A"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Room No</label>
                    <input
                      type="text"
                      name="roomNo"
                      value={formData.roomNo}
                      onChange={handleChange}
                      placeholder="101"
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Daily Milk (L)</label>
                    <div className="relative">
                      <Droplets className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 dark:text-[#fbbf24]" size={18} />
                      <input
                        type="number"
                        step="0.5"
                        name="defaultMilkQuantityLiters"
                        value={formData.defaultMilkQuantityLiters}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-blue-100 bg-blue-50 py-3 pl-10 pr-4 font-bold text-blue-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-[#d97706]/30 dark:bg-[#d97706]/10 dark:text-white dark:focus:border-[#d97706] dark:focus:ring-[#d97706]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Billing</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
                      <select
                        name="billingCycle"
                        value={formData.billingCycle}
                        onChange={handleChange}
                        className={`${iconFieldClass} appearance-none`}
                      >
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 border-t border-gray-200 pt-4 dark:border-[#1E293B]">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="w-1/3 rounded-xl border border-gray-300 py-3 font-bold text-gray-600 transition hover:bg-gray-50 dark:border-[#222B40] dark:bg-[#161C2C] dark:text-slate-300 dark:hover:bg-[#1C243A] dark:hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-2/3 items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-black text-white transition hover:bg-green-700 disabled:opacity-50 dark:bg-[#d97706] dark:hover:bg-[#b45309]"
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
