import {
  findCustomerById,
  updateCustomer,
} from "../../models/customer.db.js";
import cloudinary from "../../config/cloudinary.js";
import { supabase } from "../../config/supabase.js";

const resolveMembershipLinkColumn = async () => {
  const compatibleColumns = ["customer_id", "customerid", "customerId", "user_id"];
  for (const column of compatibleColumns) {
    const { error } = await supabase
      .from("memberships")
      .select(column)
      .limit(1);
    if (!error) return column;

    const message = String(error?.message || "").toLowerCase();
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    const isMissingTable = message.includes("relation") && message.includes("does not exist");
    if (!isMissingColumn && !isMissingTable) throw error;
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
  console.log("🧪 AUTH CUSTOMER OBJECT:", req.customer);

  try {
    if (!req.customer || !req.customer.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const customerId = req.customer.id; // ✅ MISSING LINE (FIX)

    const { data, error } = await findCustomerById(customerId);

    if (error || !data) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const dairyName = await getLinkedDairyName(data, req.customer?.dairyId ?? null);

    // Never send password back
    delete data.password;
    data.member_of_dairy = dairyName;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 * UPDATE CUSTOMER PROFILE
 * PUT /api/customer/profile
 */
export const updateProfile = async (req, res) => {
  try {
    const customerId = req.customer.id;

    // Prevent password update here
    if (req.body.password) {
      return res.status(400).json({
        message: "Password cannot be updated from profile",
      });
    }

    const allowedPayload = {
      customer_name: req.body.customer_name ?? req.body.name,
      email: req.body.email,
      phone_number: req.body.phone_number ?? req.body.phone,
      building_name: req.body.building_name ?? req.body.buildingName,
      wing: req.body.wing,
      room_no: req.body.room_no ?? req.body.roomNo,
    };

    let profilePhotoUrl = null;
    if (req.file) {
      const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const uploaded = await cloudinary.uploader.upload(dataUri, {
        folder: "customers/profile",
        resource_type: "image",
      });
      profilePhotoUrl = uploaded.secure_url;
    }

    const payload = Object.fromEntries(
      Object.entries({
        ...allowedPayload,
        ...(profilePhotoUrl ? { profile_photo_url: profilePhotoUrl } : {}),
      }).filter(([, value]) => value !== undefined)
    );

    const { data, error } = await updateCustomer(customerId, payload);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    delete data.password;

    res.json({
      message: "Profile updated successfully",
      data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
