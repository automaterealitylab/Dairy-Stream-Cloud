import {
  adminStaffLoginService,
  requestAdminResetOtpService,
  resetAdminPasswordWithOtpService,
} from "../../services/authentication/adminAuth.service.js";

export const adminLogin = async (req, res) => {
  try {
    const { identifier, email, password } = req.body || {};
    const loginIdentifier = String(identifier || email || "").trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        error: "Identifier and password are required",
      });
    }

    const result = await adminStaffLoginService({
      identifier: loginIdentifier,
      password,
    });

    res.json({
      success: true,
      token: result.token,
      user: result.user,
      redirect: "/admin/AdminDashboard",
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      error: err.message,
    });
  }
};

export const requestAdminResetOtp = async (req, res) => {
  try {
    const { identifier, email } = req.body || {};
    const loginIdentifier = String(identifier || email || "").trim();

    if (!loginIdentifier) {
      return res.status(400).json({
        success: false,
        error: "Identifier is required",
      });
    }

    const result = await requestAdminResetOtpService({
      identifier: loginIdentifier,
    });

    res.json({
      success: true,
      message: "OTP sent to admin email",
      email: result.email,
      remainingRequests: result.remainingRequests,
      limit: result.limit,
    });
  } catch (err) {
    res.status(err.statusCode || 400).json({
      success: false,
      error: err.message || "Failed to send reset OTP",
      remainingRequests: err.remainingRequests,
      retryAfterMinutes: err.retryAfterMinutes,
    });
  }
};

export const resetAdminPasswordWithOtp = async (req, res) => {
  try {
    const { identifier, email, otp, newPassword } = req.body || {};
    const loginIdentifier = String(identifier || email || "").trim();

    if (!loginIdentifier || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Identifier, OTP, and newPassword are required",
      });
    }

    await resetAdminPasswordWithOtpService({
      identifier: loginIdentifier,
      otp,
      newPassword,
    });

    res.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message || "Failed to reset password",
    });
  }
};
