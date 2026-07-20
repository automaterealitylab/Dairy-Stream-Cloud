import React, { useEffect, useState } from "react";
import SuperAdminSidebar from "./SuperAdminSidebar.jsx";
import { fetchSettingsApi, updateSettingsApi } from "../../api/superAdmin.api.js";
import toast from "react-hot-toast";
import { Settings, Save, ShieldAlert, Key, Link2, Mail, Store } from "lucide-react";

const SuperAdminSettings = () => {
  const [_settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [companyName, setCompanyName] = useState("");
  const [companyGst, setCompanyGst] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [smsGatewayUrl, setSmsGatewayUrl] = useState("");
  const [smsApiKey, setSmsApiKey] = useState("");
  const [emailApiKey, setEmailApiKey] = useState("");
  const [paymentGatewayKey, setPaymentGatewayKey] = useState("");
  const [paymentGatewaySecret, setPaymentGatewaySecret] = useState("");

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetchSettingsApi();
      if (response.success) {
        const s = response.settings;
        setSettings(s);
        setCompanyName(s.COMPANY_NAME || "");
        setCompanyGst(s.COMPANY_GST || "");
        setSupportEmail(s.SUPPORT_EMAIL || "");
        setSupportPhone(s.SUPPORT_PHONE || "");
        setSmsGatewayUrl(s.SMS_GATEWAY_URL || "");
        setSmsApiKey(s.SMS_API_KEY || "");
        setEmailApiKey(s.EMAIL_API_KEY || "");
        setPaymentGatewayKey(s.PAYMENT_GATEWAY_KEY || "");
        setPaymentGatewaySecret(s.PAYMENT_GATEWAY_SECRET || "");
      }
    } catch (err) {
      toast.error("Failed to load platform settings");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await updateSettingsApi({
        COMPANY_NAME: companyName,
        COMPANY_GST: companyGst,
        SUPPORT_EMAIL: supportEmail,
        SUPPORT_PHONE: supportPhone,
        SMS_GATEWAY_URL: smsGatewayUrl,
        SMS_API_KEY: smsApiKey,
        EMAIL_API_KEY: emailApiKey,
        PAYMENT_GATEWAY_KEY: paymentGatewayKey,
        PAYMENT_GATEWAY_SECRET: paymentGatewaySecret,
      });

      if (response.success) {
        toast.success("Platform settings updated successfully!");
      }
    } catch (_err) {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SuperAdminSidebar>
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
          <div className="w-12 h-12 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin mb-4"></div>
          <p className="text-slate-400 font-medium">Extracting global registry settings...</p>
        </div>
      </SuperAdminSidebar>
    );
  }

  return (
    <SuperAdminSidebar>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            System & Configurations Control
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Define global company metadata registers, configure API gateways, and manage Razorpay subscription secrets.
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl text-xs">
        
        {/* Company profile branding details */}
        <div className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 space-y-4">
          <h3 className="font-extrabold text-slate-200 text-sm flex items-center gap-2">
            <Store size={16} className="text-cyan-400" />
            <span>Company & Legal Metadata</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Registered Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="DairyStream Cloud Pvt Ltd"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Corporate GST Number</label>
              <input
                type="text"
                value={companyGst}
                onChange={(e) => setCompanyGst(e.target.value)}
                placeholder="27AAAAA1111A1Z1"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200 font-mono uppercase"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Support Desk Email</label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@dairystream.com"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Support Desk Contact Phone</label>
              <input
                type="text"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                required
              />
            </div>
          </div>
        </div>

        {/* API Credentials */}
        <div className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 space-y-4">
          <h3 className="font-extrabold text-slate-200 text-sm flex items-center gap-2">
            <Key size={16} className="text-indigo-400" />
            <span>Payment Gateway Credentials (Razorpay)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Razorpay API Key ID</label>
              <input
                type="text"
                value={paymentGatewayKey}
                onChange={(e) => setPaymentGatewayKey(e.target.value)}
                placeholder="rzp_live_••••••••••••"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-indigo-500/80 outline-none text-slate-200 font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Razorpay Key Secret</label>
              <input
                type="password"
                value={paymentGatewaySecret}
                onChange={(e) => setPaymentGatewaySecret(e.target.value)}
                placeholder="••••••••••••••••••••••••"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-indigo-500/80 outline-none text-slate-200"
                required
              />
            </div>
          </div>
        </div>

        {/* API Connections for email and SMS alerts */}
        <div className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 space-y-4">
          <h3 className="font-extrabold text-slate-200 text-sm flex items-center gap-2">
            <Link2 size={16} className="text-purple-400" />
            <span>Messaging Alerts & Communications APIs</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">SMS Alert API Gateway Endpoint</label>
              <input
                type="text"
                value={smsGatewayUrl}
                onChange={(e) => setSmsGatewayUrl(e.target.value)}
                placeholder="https://api.smsalert.co/v1/send"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200 font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">SMS Alerts Secret API Key</label>
              <input
                type="password"
                value={smsApiKey}
                onChange={(e) => setSmsApiKey(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">SMTP / Brevo Email API Secret Key</label>
              <input
                type="password"
                value={emailApiKey}
                onChange={(e) => setEmailApiKey(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                required
              />
            </div>
          </div>
        </div>

        {/* Warning text */}
        <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex gap-3 text-amber-500 max-w-4xl text-[11px] leading-relaxed">
          <ShieldAlert size={18} className="shrink-0" />
          <span>
            <strong>Attention:</strong> Updating Razorpay credentials or SMS gateways directly impacts active checkout sessions, WhatsApp scheduling pipelines, and notifications logs. Ensure keys are validated in Sandbox settings before deploying.
          </span>
        </div>

        {/* Save button */}
        <div className="flex justify-end gap-3 max-w-4xl">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-bold shadow-lg shadow-cyan-500/20 active:scale-98 transition-all duration-200 cursor-pointer"
          >
            <Save size={14} />
            <span>{saving ? "Saving configurations..." : "Save Registry Changes"}</span>
          </button>
        </div>
      </form>
    </SuperAdminSidebar>
  );
};

export default SuperAdminSettings;
