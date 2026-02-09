import { adminLoginService } from "../../../services/authentication/admin.auth.service.js";

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Call Service
    const result = await adminLoginService(email, password);

    res.json({ 
      success: true, 
      ...result, 
      redirect: '/admin/AdminDashboard' 
    });

  } catch (err) {
    const status = err.message === "Incorrect Password" ? 400 : 404;
    res.status(status).json({ error: err.message });
  }
};