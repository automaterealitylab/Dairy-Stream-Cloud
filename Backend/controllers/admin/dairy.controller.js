// Backend/src/controllers/admin/dairy.controller.js
import {
  getAdminDairyProfileService,
  registerDairyService,
  updateAdminDairyProfileService,
} from "../../services/admin/dairy.service.js";
import cloudinary from "../../config/cloudinary.js";
import streamifier from "streamifier";

const uploadFromBuffer = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const cld_upload_stream = cloudinary.uploader.upload_stream(
      { folder: "dairies" },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(cld_upload_stream);
  });
};

export const registerDairy = async (req, res) => {
  try {
    // 1. Extract all fields (Ensure these match your frontend formData keys)
    const {
      dairy_name, dairy_phone, dairy_email, address, city, state, pincode,
      latitude, longitude, owner_name, admin_email, password,
      selected_plan
    } = req.body;

    // 2. Logo Validation (Mandatory for Branding Recognition)
    if (!req.file) {
      return res.status(400).json({ success: false, error: "Dairy logo is required." });
    }

    // 3. Strict Validation List (Must match the 400 error triggers)
    const required = { 
      dairy_name, dairy_phone, dairy_email, address, city, state, pincode,
      owner_name, admin_email, password
    };

    const missing = Object.entries(required)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Missing fields: ${missing.join(", ")}` 
      });
    }

    // 4. Upload Logo
    const uploadResult = await uploadFromBuffer(req.file.buffer);

    // 5. Call Service with parsed coordinates for 10km radius logic
    const result = await registerDairyService({
      ...req.body,
      imageUrl: uploadResult.secure_url,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error("REGISTRATION ERROR:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
};

export const getAdminDairyProfile = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId;
    const adminId = req.admin?.id;
    if (!dairyId) {
      return res.status(400).json({
        success: false,
        error: "Dairy context is required",
      });
    }

    const data = await getAdminDairyProfileService({
      adminId,
      dairyId,
      revealBankDetails: req.query?.revealBankDetails === "true",
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error("DAIRY PROFILE LOAD ERROR:", err.message);
    res.status(err.statusCode || 400).json({
      success: false,
      error: err.message || "Failed to load dairy profile",
    });
  }
};

export const updateAdminDairyProfile = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId;
    const adminId = req.admin?.id;
    if (!dairyId) {
      return res.status(400).json({
        success: false,
        error: "Dairy context is required",
      });
    }

    const data = await updateAdminDairyProfileService({
      adminId,
      dairyId,
      payload: req.body || {},
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error("DAIRY PROFILE UPDATE ERROR:", err.message);
    res.status(err.statusCode || 400).json({
      success: false,
      error: err.message || "Failed to update dairy profile",
    });
  }
};
