import { adminStaffLoginService } 
from "../../services/authentication/admin.auth.service.js";

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    console.log(`📨 Admin login request for: ${email}`);

    // ✅ Correct service call
    const result = await adminStaffLoginService({
      identifier: email,
      password,
    });

    console.log(`✅ Sending login response with token for: ${email}`);

    res.json({
      success: true,
      token: result.token,
      user: result.user,
      redirect: "/admin/AdminDashboard",
    });

  } catch (err) {
    console.error(`❌ Admin login error: ${err.message}`);
    res.status(401).json({
      error: err.message,
      success: false,
    });
  }
};
