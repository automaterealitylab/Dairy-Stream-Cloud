import { detectUserService } from "../../services/authentication/detectUser.service.js";

export const detectUser = async (req, res) => {
  try {
    const { identifier, requestCustomerOtp, dairyId } = req.body;

    if (!identifier) {
      return res.status(400).json({ 
        success: false, 
        message: "Identifier (Email, Phone, or Staff ID) is required" 
      });
    }

    // Call the service logic
    const result = await detectUserService(identifier, {
      requestCustomerOtp,
      dairyId,
    });

    // Send the roadmap back to Frontend
    return res.status(200).json({
      success: true,
      ...result 
      // Returns: { exists, userType, nextStep, name }
    });

  } catch (err) {
    console.error("Detect User Error:", err.message);

    const rawMessage = String(err?.message || err || "");
    const normalizedMessage = rawMessage.toLowerCase();
    const isOtpDeliveryError =
      normalizedMessage.includes("email delivery failed") ||
      normalizedMessage.includes("email credentials are not configured");

    return res.status(isOtpDeliveryError ? 503 : 500).json({ 
      success: false, 
      message: isOtpDeliveryError
        ? rawMessage
        : "Unable to detect user. Please try again." 
    });
  }
};
