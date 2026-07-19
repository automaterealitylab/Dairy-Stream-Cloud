import bcrypt from "bcryptjs";
import { supabase } from "../../config/supabase.js";
import { issueLoginTokens } from "../../utils/jwt.js";

// Login controller for Super Admin
export const superAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    // Query super_admins table
    const { data: superAdmin, error } = await supabase
      .from("super_admins")
      .select("id, email, name, password, role, status, two_factor_enabled")
      .eq("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!superAdmin) {
      return res.status(401).json({
        success: false,
        error: "Incorrect email or password",
      });
    }

    if (superAdmin.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error: "Your account is suspended",
      });
    }

    const isMatch = await bcrypt.compare(password, superAdmin.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Incorrect email or password",
      });
    }

    // Issue standard tokens using our JWT service
    const tokens = await issueLoginTokens({
      id: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role,
      actorType: "SUPER_ADMIN",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
      userAgent: req.headers["user-agent"] || null,
    });

    // Write audit log entry
    await supabase.from("super_admin_audit_logs").insert({
      super_admin_id: superAdmin.id,
      action: "LOGIN",
      ip_address: req.ip || req.headers["x-forwarded-for"] || null,
      details: { email: superAdmin.email },
    });

    res.json({
      success: true,
      token: tokens.accessToken,
      user: {
        id: superAdmin.id,
        email: superAdmin.email,
        name: superAdmin.name,
        role: superAdmin.role,
        twoFactorEnabled: superAdmin.two_factor_enabled,
      },
    });
  } catch (err) {
    console.error("Super Admin Login Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Me controller to verify current user session
export const getMe = async (req, res) => {
  try {
    const adminId = req.superAdmin.id;
    const { data: superAdmin, error } = await supabase
      .from("super_admins")
      .select("id, email, name, role, status, two_factor_enabled")
      .eq("id", adminId)
      .maybeSingle();

    if (error) throw error;
    if (!superAdmin) {
      return res.status(404).json({ success: false, error: "Admin profile not found" });
    }

    res.json({
      success: true,
      user: {
        id: superAdmin.id,
        email: superAdmin.email,
        name: superAdmin.name,
        role: superAdmin.role,
        twoFactorEnabled: superAdmin.two_factor_enabled,
      },
    });
  } catch (err) {
    console.error("Super Admin getMe Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
