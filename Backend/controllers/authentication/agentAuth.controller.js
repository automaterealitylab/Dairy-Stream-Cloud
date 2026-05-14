import { supabase } from "../../config/supabase.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../../utils/email.js";
import { getSetting } from "../../services/shared/appSettings.service.js";

const agentResetOtpStore = new Map();
const agentResetOtpRequestStore = new Map();

// Cached settings (will be fetched from DB on demand)
let cachedAgentSettings = null;
let lastSettingsFetchTime = 0;
const SETTINGS_CACHE_INTERVAL = 5 * 60 * 1000; // 5 minutes

const getAgentAuthSettings = async () => {
  const now = Date.now();
  // Use cache if it's fresh
  if (cachedAgentSettings && now - lastSettingsFetchTime < SETTINGS_CACHE_INTERVAL) {
    return cachedAgentSettings;
  }

  // Fetch from database
  const [otpExpiryMs, otpRequestLimit, otpRequestWindowMs] = await Promise.all([
    getSetting("AGENT_OTP_EXPIRY_MS", 10 * 60 * 1000),
    getSetting("AGENT_OTP_REQUEST_LIMIT", 3),
    getSetting("AGENT_OTP_REQUEST_WINDOW_MS", 15 * 60 * 1000),
  ]);

  cachedAgentSettings = {
    otpExpiryMs,
    otpRequestLimit,
    otpRequestWindowMs,
  };
  lastSettingsFetchTime = now;
  return cachedAgentSettings;
};

const normalizeStaffId = (agentId) => String(agentId || "").trim().toUpperCase();

const purgeExpiredAgentResetOtps = () => {
  const now = Date.now();
  for (const [key, value] of agentResetOtpStore.entries()) {
    if (!value?.expiresAt || value.expiresAt <= now) {
      agentResetOtpStore.delete(key);
    }
  }
};

const trackAgentOtpRequest = (key, settings) => {
  const now = Date.now();
  const existing = agentResetOtpRequestStore.get(key);
  const isExpiredWindow =
    !existing || now - existing.windowStart > settings.otpRequestWindowMs;

  if (isExpiredWindow) {
    agentResetOtpRequestStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remainingRequests: settings.otpRequestLimit - 1,
    };
  }

  if (existing.count >= settings.otpRequestLimit) {
    return {
      allowed: false,
      remainingRequests: 0,
    };
  }

  const nextCount = existing.count + 1;
  agentResetOtpRequestStore.set(key, { ...existing, count: nextCount });
  return {
    allowed: true,
    remainingRequests: Math.max(0, settings.otpRequestLimit - nextCount),
  };
};

const findAgentByStaffId = async (agentId) => {
  const normalizedAgentId = normalizeStaffId(agentId);
  if (!normalizedAgentId) return null;

  const { data: agent, error } = await supabase
    .from("agents")
    .select("*")
    .ilike("agent_id", normalizedAgentId)
    .maybeSingle();

  if (error) throw error;
  return agent;
};

export const agentLogin = async (req, res) => {
  try {
    const { agentId, password } = req.body || {};
    const normalizedAgentId = normalizeStaffId(agentId);

    if (!normalizedAgentId || !password) {
      return res.status(400).json({ success: false, error: "Staff ID and password are required" });
    }

    const agent = await findAgentByStaffId(normalizedAgentId);
    if (!agent) return res.status(404).json({ success: false, error: "Agent not found" });

    const isValid = await bcrypt.compare(password, agent.password);
    if (!isValid) return res.status(401).json({ success: false, error: "Invalid password" });

    const token = jwt.sign(
      {
        id: agent.id,
        agentId: agent.agent_id,
        role: "AGENT",
        dairyId: agent.dairy_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      token,
      role: "AGENT",
      user: {
        id: agent.id,
        agentId: agent.agent_id,
        name: agent.agent_name,
        role: "AGENT",
        dairyId: agent.dairy_id,
      },
      redirect: "/agent/dashboard",
    });
  } catch (_err) {
    return res.status(500).json({ success: false, error: "Login failed" });
  }
};

export const requestAgentResetOtp = async (req, res) => {
  try {
    const settings = await getAgentAuthSettings();
    const { agentId, identifier } = req.body || {};
    const normalizedAgentId = normalizeStaffId(agentId || identifier);

    if (!normalizedAgentId) {
      return res.status(400).json({ success: false, error: "Staff ID is required" });
    }

    const agent = await findAgentByStaffId(normalizedAgentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: "Agent not found" });
    }
    if (!agent.email) {
      return res.status(400).json({ success: false, error: "Agent email not available for OTP delivery" });
    }

    purgeExpiredAgentResetOtps();
    const requestCheck = trackAgentOtpRequest(String(agent.id), settings);
    if (!requestCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: "OTP request limit exceeded. Try after 15 minutes.",
        remainingRequests: 0,
        retryAfterMinutes: 15,
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = String(agent.id);
    agentResetOtpStore.set(key, {
      otp,
      expiresAt: Date.now() + settings.otpExpiryMs,
    });

    await sendEmail({
      to: agent.email,
      subject: "DairyStream Agent Password Reset OTP",
      html: `
        <p>Your OTP for agent password reset is:</p>
        <h2>${otp}</h2>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent to agent email",
      email: agent.email,
      remainingRequests: requestCheck.remainingRequests,
      limit: settings.otpRequestLimit,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message || "Failed to send reset OTP",
    });
  }
};

export const resetAgentPasswordWithOtp = async (req, res) => {
  try {
    const { agentId, identifier, otp, newPassword } = req.body || {};
    const normalizedAgentId = normalizeStaffId(agentId || identifier);
    const normalizedOtp = String(otp || "").trim();

    if (!normalizedAgentId || !normalizedOtp || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Staff ID, OTP, and newPassword are required",
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 6 characters",
      });
    }

    const agent = await findAgentByStaffId(normalizedAgentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: "Agent not found" });
    }

    purgeExpiredAgentResetOtps();
    const key = String(agent.id);
    const otpRecord = agentResetOtpStore.get(key);

    if (!otpRecord || otpRecord.expiresAt <= Date.now()) {
      agentResetOtpStore.delete(key);
      return res.status(400).json({ success: false, error: "OTP expired or not found" });
    }

    if (String(otpRecord.otp) !== normalizedOtp) {
      return res.status(400).json({ success: false, error: "Invalid OTP" });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    const { error } = await supabase
      .from("agents")
      .update({ password: hashedPassword })
      .eq("id", agent.id);

    if (error) throw error;

    agentResetOtpStore.delete(key);

    return res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message || "Failed to reset password",
    });
  }
};
