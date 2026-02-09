import { supabase } from "../../config.js";

export const checkUserStatus = async (req, res) => {
  const { identifier } = req.body;

  try {
    // 1. Admin Check (Email)
    if (identifier.includes('@')) {
      const { data: admin } = await supabase
        .from('users')
        .select('full_name')
        .eq('email', identifier)
        .maybeSingle();

      if (admin) {
        return res.json({ userType: 'ADMIN', exists: true, nextStep: 'PASSWORD', name: admin.full_name });
      } else {
        return res.json({ userType: 'ADMIN', exists: false, error: "Admin account not found." });
      }
    }

    // 2. Customer Check (Mobile)
    const isMobile = /^\d{10}$/.test(identifier);
    if (isMobile) {
      const { data: user } = await supabase
        .from('users')
        .select('full_name')
        .eq('mobile', identifier)
        .maybeSingle();

      if (user) {
        return res.json({ userType: 'CUSTOMER', exists: true, nextStep: 'OTP', name: user.full_name });
      } else {
        return res.json({ userType: 'CUSTOMER', exists: false, nextStep: 'REGISTER' });
      }
    }

    return res.status(400).json({ error: "Invalid identifier format" });

  } catch (err) {
    console.error("Check Auth Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};