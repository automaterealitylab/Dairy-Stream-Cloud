import {
  findCustomerById,
  updateCustomer,
} from "../../models/customer.db.js";
import cloudinary from "../../config/cloudinary.js";
import { supabase } from "../../config/supabase.js";
import streamifier from "streamifier";

/**
 * HELPER: Upload Buffer to Cloudinary
 * Uses streams to handle memory buffers efficiently.
 */
const uploadFromBuffer = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const cld_upload_stream = cloudinary.uploader.upload_stream(
      { 
        folder: "customers/profile",
        resource_type: "image" 
      },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(cld_upload_stream);
  });
};

/**
 * HELPER: Resolve linked dairy name
 */
const resolveMembershipLinkColumn = async () => {
  const compatibleColumns = ["customer_id", "customerid", "customerId", "user_id"];
  for (const column of compatibleColumns) {
    const { error } = await supabase
      .from("memberships")
      .select(column)
      .limit(1);
    if (!error) return column;
  }
  return null;
};

const getLinkedDairyName = async (customer, hintedDairyId = null) => {
  if (!customer?.id) return null;

  let linkedDairyId = customer?.dairy_id ?? hintedDairyId ?? null;

  const linkColumn = await resolveMembershipLinkColumn();
  if (linkColumn) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("dairy_id")
      .eq(linkColumn, customer.id)
      .limit(1)
      .maybeSingle();
    if (membership?.dairy_id) linkedDairyId = membership.dairy_id;
  }

  if (!linkedDairyId) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("dairy_id")
      .eq("customer_id", customer.id)
      .neq("status", "CLOSED")
      .limit(1)
      .maybeSingle();
    if (subscription?.dairy_id) linkedDairyId = subscription.dairy_id;
  }

  if (!linkedDairyId) return null;

  const { data: dairy } = await supabase
    .from("dairies")
    .select("dairy_name")
    .eq("id", linkedDairyId)
    .maybeSingle();

  return dairy?.dairy_name ?? null;
};

/**
 * GET CUSTOMER PROFILE
 * GET /api/customer/profile
 */
export const getProfile = async (req, res) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ message: "Unauthorized" });

    const { data, error } = await findCustomerById(customerId);

    if (error || !data) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const dairyName = await getLinkedDairyName(data, req.customer?.dairyId ?? null);

    delete data.password;
    data.member_of_dairy = dairyName;

    res.json(data);
  } catch (err) {
    console.error("❌ Profile Fetch Error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * UPDATE CUSTOMER PROFILE
 * PUT /api/customer/profile
 */
export const updateProfile = async (req, res) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ message: "Unauthorized" });

    // 1. Logic Gate: Prevent password hacks via profile update
    if (req.body.password) {
      return res.status(400).json({ message: "Password updates not allowed here" });
    }

    // 2. Prepare Payload (Support both camelCase and snake_case from frontend)
    const allowedPayload = {
      customer_name: req.body.customer_name ?? req.body.name,
      email: req.body.email,
      phone_number: req.body.phone_number ?? req.body.phone,
      building_name: req.body.building_name ?? req.body.buildingName,
      wing: req.body.wing,
      room_no: req.body.room_no ?? req.body.roomNo,
    };

    // 3. Handle Image Upload via Stream
    let profilePhotoUrl = null;
    if (req.file) {
      try {
        console.log("📤 Uploading buffer to Cloudinary...");
        const uploaded = await uploadFromBuffer(req.file.buffer);
        profilePhotoUrl = uploaded.secure_url;
      } catch (uploadErr) {
        console.error("❌ Cloudinary Upload Failed:", uploadErr);
        return res.status(500).json({ error: "Cloud storage upload failed" });
      }
    }

    // 4. Clean Payload (Remove null/undefined)
    const payload = {};
    Object.entries(allowedPayload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        payload[key] = value;
      }
    });

    if (profilePhotoUrl) {
      payload.profile_photo_url = profilePhotoUrl;
    }

    // 5. Database Execution
    const { data, error } = await updateCustomer(customerId, payload);

    if (error) {
      console.error("❌ Supabase Update Error:", error);
      return res.status(400).json({ error: error.message });
    }

    if (data) delete data.password;

    res.json({
      message: "Profile updated successfully",
      data,
    });

  } catch (err) {
    // This will finally reveal the 500 error cause in your terminal
    console.error("🔥 UNCAUGHT UPDATE ERROR:", err); 
    res.status(500).json({ error: err.message });
  }
};