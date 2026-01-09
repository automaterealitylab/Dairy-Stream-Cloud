import {
  forgotPasswordService,
  resetPasswordService,
} from "../../services/customer/password.service.js";

/**
 * FORGOT PASSWORD
 * POST /api/customer/forgot-password
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    await forgotPasswordService(email);

    res.json({
      message: "Password reset link sent to email",
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * RESET PASSWORD
 * POST /api/customer/reset-password
 */
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        message: "Token and new password are required",
      });
    }

    await resetPasswordService(token, newPassword);

    res.json({
      message: "Password reset successful",
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
