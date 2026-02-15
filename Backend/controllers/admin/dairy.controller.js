import { registerDairyService } from "../../services/admin/dairy.service.js";
import cloudinary from "../../config/cloudinary.js";

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

    let imageUrl = null;
    if (req.file) {
      const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const upload = await cloudinary.uploader.upload(dataUri, {
        folder: "dairies",
        resource_type: "image",
      });
      imageUrl = upload.secure_url;
    }

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
      imageUrl,
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
