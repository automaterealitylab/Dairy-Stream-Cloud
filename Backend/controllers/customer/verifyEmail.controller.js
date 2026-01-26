import { verifyEmailToken } from "../../services/customer/email.service.js";

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        message: "Verification token is required",
      });
    }

    await verifyEmailToken(token);

    res.json({
      message: "Email verified successfully",
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
};
