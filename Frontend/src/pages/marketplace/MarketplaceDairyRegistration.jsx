import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Building2, Landmark, Loader2, ShieldCheck } from "lucide-react";
import { registerMarketplaceDairy } from "../../api/marketplace.api";

const initialForm = {
  dairy_name: "",
  owner_name: "",
  phone: "",
  email: "",
  bank_account: "",
  ifsc: "",
  pan: "",
  upi_id: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

const Field = ({ label, name, value, onChange, type = "text", className = "" }) => (
  <label className={`block ${className}`}>
    <span className="text-xs font-black uppercase tracking-[0.16em] text-[#8B7355]">{label}</span>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      className="mt-2 w-full rounded-lg border border-[#E7DAC6] bg-white px-4 py-3 text-sm font-semibold text-[#2C1A0E] outline-none focus:border-[#B8641A] focus:ring-4 focus:ring-[#F4E1CB]"
    />
  </label>
);

export default function MarketplaceDairyRegistration() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: name === "ifsc" || name === "pan" ? value.toUpperCase() : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await registerMarketplaceDairy(form);
      toast.success("Dairy linked account created");
      const dairyId = result?.dairy?.id;
      navigate(dairyId ? `/marketplace/dairy/${dairyId}` : "/marketplace/admin");
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || "Registration failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FAFAF7] px-4 py-6 text-[#2C1A0E]">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => navigate("/marketplace/checkout")}
          className="mb-5 inline-flex items-center gap-2 rounded-lg border border-[#E7DAC6] bg-white px-4 py-2 text-sm font-bold text-[#7B6247]"
        >
          <ArrowLeft size={16} />
          Checkout
        </button>

        <section className="rounded-2xl border border-[#E7DAC6] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#B8641A]">Razorpay Route Onboarding</p>
              <h1 className="mt-2 text-3xl font-black">Register Dairy Linked Account</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#7B6247]">
                Creates a Route linked account, requests Route product access, and configures bank settlement.
              </p>
            </div>
            <div className="rounded-xl bg-[#EEF7EB] p-3 text-[#4A7C2F]">
              <ShieldCheck size={28} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#5C3D1E]">
                <Building2 size={18} />
                Business Details
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Dairy Name" name="dairy_name" value={form.dairy_name} onChange={handleChange} />
                <Field label="Owner Name" name="owner_name" value={form.owner_name} onChange={handleChange} />
                <Field label="Phone" name="phone" value={form.phone} onChange={handleChange} />
                <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} />
                <Field label="PAN Number" name="pan" value={form.pan} onChange={handleChange} />
                <Field label="UPI ID" name="upi_id" value={form.upi_id} onChange={handleChange} />
                <Field label="City" name="city" value={form.city} onChange={handleChange} />
                <Field label="State" name="state" value={form.state} onChange={handleChange} />
                <Field label="Pincode" name="pincode" value={form.pincode} onChange={handleChange} />
                <label className="block md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[#8B7355]">Address</span>
                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-[#E7DAC6] bg-white px-4 py-3 text-sm font-semibold text-[#2C1A0E] outline-none focus:border-[#B8641A] focus:ring-4 focus:ring-[#F4E1CB]"
                  />
                </label>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#5C3D1E]">
                <Landmark size={18} />
                Settlement Bank Details
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Bank Account Number" name="bank_account" value={form.bank_account} onChange={handleChange} />
                <Field label="IFSC Code" name="ifsc" value={form.ifsc} onChange={handleChange} />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#B8641A] px-6 py-4 font-black text-white transition hover:bg-[#9E5415] disabled:bg-[#D8C8B2] md:w-auto"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : null}
              Create Linked Account
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
