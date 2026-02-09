import { verifyLoginService, registerCustomerService } from "../../../services/authentication/customer.auth.service.js";

// --- LOGIN ---
export const verifyLogin = async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    
    // Call Service
    const result = await verifyLoginService(mobile, otp);

    res.json({ 
      success: true, 
      ...result,
      redirect: '/customer-dashboard'
    });

  } catch (err) {
    const status = err.message === "Invalid OTP" ? 400 : 404;
    res.status(status).json({ error: err.message });
  }
};

// --- REGISTER ---
export const registerCustomer = async (req, res) => {
  try {
    // Call Service
    const result = await registerCustomerService(req.body);

    res.json({ 
      success: true, 
      ...result, 
      redirect: '/customer-dashboard' 
    });

  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ error: err.message });
  }
};