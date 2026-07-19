import { supabase } from "../../config/supabase.js";

// Fetch all system settings
export const fetchSettings = async (req, res) => {
  try {
    const { data: settings, error } = await supabase
      .from("platform_settings")
      .select("*");

    if (error) throw error;

    // Convert setting list to key-value pairs
    const configMap = {};
    (settings || []).forEach(s => {
      configMap[s.key] = s.value;
    });

    // Provide default fallback values if settings table is empty
    const responseSettings = {
      COMPANY_NAME: configMap.COMPANY_NAME || "DairyStream Cloud Pvt Ltd",
      COMPANY_GST: configMap.COMPANY_GST || "27AAAAA1111A1Z1",
      SUPPORT_EMAIL: configMap.SUPPORT_EMAIL || "support@dairystream.com",
      SUPPORT_PHONE: configMap.SUPPORT_PHONE || "+91 9876543210",
      SMS_GATEWAY_URL: configMap.SMS_GATEWAY_URL || "https://api.smsalert.co/v1/send",
      SMS_API_KEY: configMap.SMS_API_KEY || "sms_api_key_placeholder",
      EMAIL_API_KEY: configMap.EMAIL_API_KEY || "email_api_key_placeholder",
      PAYMENT_GATEWAY_KEY: configMap.PAYMENT_GATEWAY_KEY || "rzp_live_T7HpblkzpjrCtF",
      PAYMENT_GATEWAY_SECRET: configMap.PAYMENT_GATEWAY_SECRET || "••••••••••••••••••••",
    };

    res.json({ success: true, settings: responseSettings });
  } catch (err) {
    console.error("Fetch Settings Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Update a system setting key-value pair
export const updateSettings = async (req, res) => {
  try {
    const settingsObject = req.body || {};

    // Iterate through settings object and upsert keys
    const upserts = Object.keys(settingsObject).map(async (key) => {
      const value = settingsObject[key];
      return supabase
        .from("platform_settings")
        .upsert({
          key,
          value: { val: value },
          updated_at: new Date().toISOString()
        });
    });

    await Promise.all(upserts);

    // Log audit
    await supabase.from("super_admin_audit_logs").insert({
      super_admin_id: req.superAdmin.id,
      action: "UPDATE_SYSTEM_SETTINGS",
      details: { updatedKeys: Object.keys(settingsObject) },
    });

    res.json({ success: true, message: "Settings updated successfully" });
  } catch (err) {
    console.error("Update Settings Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
