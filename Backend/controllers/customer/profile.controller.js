import {
  findCustomerById,
  updateCustomer,
} from "../../models/customer.db.js";
import cloudinary from "../../config/cloudinary.js";
import { supabase } from "../../config/supabase.js";
import streamifier from "streamifier";

const uploadFromBuffer = (fileBuffer) =>
  new Promise((resolve, reject) => {
    const cldUploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "customers/profile",
        resource_type: "image",
      },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(cldUploadStream);
  });

const resolveMembershipLinkColumn = async () => {
  const compatibleColumns = ["customer_id", "customerid", "customerId", "user_id"];

  for (const column of compatibleColumns) {
    const { error } = await supabase.from("memberships").select(column).limit(1);
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

const isMissingCustomerProfileLocationColumns = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("address_line_1") ||
    message.includes("address_line_2") ||
    message.includes("latitude") ||
    message.includes("longitude")
  );
};

const parseCoordinate = (value) => {
  if (value === undefined || value === null || value === "") return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(6)) : undefined;
};

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

    return res.json(data);
  } catch (err) {
    console.error("Profile fetch error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ message: "Unauthorized" });

    if (req.body.password) {
      return res.status(400).json({ message: "Password updates not allowed here" });
    }

    const allowedPayload = {
      customer_name: req.body.customer_name ?? req.body.name,
      email: req.body.email,
      phone_number: req.body.phone_number ?? req.body.phone,
      address_line_1: req.body.address_line_1 ?? req.body.addressLine1,
      address_line_2: req.body.address_line_2 ?? req.body.addressLine2,
      building_name: req.body.building_name ?? req.body.buildingName,
      wing: req.body.wing,
      room_no: req.body.room_no ?? req.body.roomNo,
      latitude: parseCoordinate(req.body.latitude),
      longitude: parseCoordinate(req.body.longitude),
    };

    let profilePhotoUrl = null;
    if (req.file) {
      try {
        const uploaded = await uploadFromBuffer(req.file.buffer);
        profilePhotoUrl = uploaded.secure_url;
      } catch (uploadErr) {
        console.error("Cloudinary upload failed:", uploadErr);
        return res.status(500).json({ error: "Cloud storage upload failed" });
      }
    }

    const payload = {};
    Object.entries(allowedPayload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        payload[key] = value;
      }
    });

    if (profilePhotoUrl) {
      payload.profile_photo_url = profilePhotoUrl;
    }

    const { data, error } = await updateCustomer(customerId, payload);

    if (error) {
      console.error("Profile update Supabase error:", error);
      if (isMissingCustomerProfileLocationColumns(error)) {
        return res.status(400).json({
          error:
            "Customer location fields are not ready in the database. Run the updated SUPABASE_MIGRATIONS.sql and try again.",
        });
      }
      return res.status(400).json({ error: error.message });
    }

    if (data) delete data.password;

    return res.json({
      message: "Profile updated successfully",
      data,
    });
  } catch (err) {
    console.error("Uncaught profile update error:", err);
    return res.status(500).json({ error: err.message });
  }
};
