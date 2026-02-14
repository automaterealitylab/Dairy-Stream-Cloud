import { registerDairyService } from "../../services/admin/dairy.service.js";

// ===============================
// REGISTER DAIRY
// ===============================
export const registerDairy = async (req, res) => {
  try {
    const {
      dairyName,
      dairyPhone,
      dairyEmail,
      gstin,
      category,
      address,
      city,
      state,
      pincode,
      serviceType,
      servicePincodes,
      serviceRadius,
      ownerName,
      adminEmail,
      adminMobile,
      password,
      selectedPlan,
    } = req.body;

    // Validation
    const requiredFields = {
      dairyName,
      dairyPhone,
      dairyEmail,
      address,
      city,
      state,
      pincode,
      ownerName,
      adminEmail,
      password,
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      console.error("❌ Missing fields:", missingFields);
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const result = await registerDairyService({
      dairyName,
      dairyPhone,
      dairyEmail,
      gstin,
      category,
      address,
      city,
      state,
      pincode,
      serviceType,
      servicePincodes,
      serviceRadius,
      ownerName,
      adminEmail,
      adminMobile,
      password,
      selectedPlan,
    });

    res.json({
      success: true,
      message: "Dairy registered successfully",
      data: result,
    });
  } catch (err) {
    console.error("❌ Dairy registration error:", err.message);
    res.status(err.statusCode || 400).json({
      success: false,
      error: err.message,
    });
  }
};
