import {
  registerCustomerService,
  generateCustomerOtp,
  verifyCustomerOtp,
  customerOtpLoginService,
  determineRedirectPath
} from "../../../services/authentication/customerAuth.service.js";

// ==========================================
// 1. REGISTRATION (Public)
// ==========================================
// ==========================================
// 1. REGISTRATION (Public - No Password/Photo)
// ==========================================
export const addCustomerAuth = async (req, res) => {
  try {
    // 1. Extract Data from req.body (JSON)
    const {
      customerName,
      email,
      phoneNumber,
      buildingName,
      roomNo,
    } = req.body;

    // 2. Validate Required Fields
    // (Ensure these match what your frontend is sending)
    if (!customerName || !phoneNumber || !roomNo) {
      return res.status(400).json({
        success: false,
        message: "Customer Name, Phone Number, and Room No are required",
      });
    }

    // 3. Call Service
    // ✅ REMOVED req.file - strictly passing req.body now
    const customer = await registerCustomerService(req.body);

    // 4. Send Response
    return res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      customer,
    });

  } catch (err) {
    console.error("Registration Controller Error:", err.message);
    
    // Handle specific errors (like duplicate email/phone from your uniqueness service)
    const isDuplicate = err.message.includes("already used") || err.message.includes("unique");
    const statusCode = err.statusCode || (isDuplicate ? 409 : 500);
    
    return res.status(statusCode).json({
      success: false,
      message: statusCode >= 500 ? "Registration failed" : err.message,
      error: err.message,
    });
  }
};

// ==========================================
// 2. LOGIN: REQUEST OTP (Mobile Only)
// ==========================================
export const requestOtpAuth = async (req, res) => {
  try {
    const { identifier, dairyId } = req.body;
    const raw = String(identifier || "").trim();
    const isEmail = raw.includes("@");
    const normalizedIdentifier = isEmail ? raw.toLowerCase() : raw.replace(/\D/g, "");

    if (!normalizedIdentifier) {
      return res.status(400).json({
        success: false,
        message: "Email or mobile number is required",
      });
    }

    if (!isEmail && normalizedIdentifier.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit mobile number",
      });
    }

    // 2. Call Service to Generate & Send OTP
    await generateCustomerOtp({ identifier: normalizedIdentifier, dairyId });

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email",
    });

  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "Failed to send OTP",
      error: err.message,
    });
  }
};

// ==========================================
// 3. LOGIN: VERIFY OTP (Mobile Only)
// ==========================================
export const verifyOtpLoginAuth = async (req, res) => {
  try {
    const { otp, dairyId, identifier } = req.body;
    const raw = String(identifier || "").trim();
    const isEmail = raw.includes("@");
    const normalizedIdentifier = isEmail ? raw.toLowerCase() : raw.replace(/\D/g, "");

    // 2. Verify OTP via Service
    const verifiedData = await verifyCustomerOtp({ 
      identifier: normalizedIdentifier, 
      otp, 
      dairyId 
    });

    // 3. Perform Login (Find User & Generate Token)
    // If dairyId was provided during request, use it. Otherwise use the one linked to OTP.
    const loginDairyId = verifiedData.dairy_id || dairyId;
    
    const { token, user } = await customerOtpLoginService({ 
      identifier: normalizedIdentifier, 
      dairyId: loginDairyId 
    });

    // 4. Determine where to send the user next
    // (e.g., Dashboard if they have a subscription, Explore if they don't)
    const { redirect, isRegisteredToRequestedDairy } = await determineRedirectPath(
      user.id, 
      loginDairyId
    );

    // 5. Send Success Response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.customer_name,
        mobile: user.phone_number,
        email: user.email,
        role: "CUSTOMER"
      },
      role: "CUSTOMER",
      isRegisteredToRequestedDairy,
      redirect,
    });

  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid OTP or Login Failed",
      error: err.message,
    });
  }
};
