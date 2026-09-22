import {
  findCustomerById,
  updateCustomer,
} from "../../models/customer.db.js";
import cloudinary from "../../config/cloudinary.js";
import { supabase } from "../../config/supabase.js";
import streamifier from "streamifier";
import { resolveOrCreateCustomerHierarchy } from "../../services/propertyHierarchy/propertyHierarchy.service.js";

const uploadFromBuffer = (fileBuffer) =>
  new Promise((resolve, reject) => {
    const cldUploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "customers/profile",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
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

    // Resolve hierarchy if any hierarchy fields provided
    let hierarchy = null;
    const hasHierarchyInput = Boolean(
      req.body.property_id || req.body.propertyId ||
      req.body.property_name || req.body.propertyName ||
      req.body.building_id || req.body.buildingId ||
      req.body.building_name || req.body.buildingName ||
      req.body.floor_id || req.body.floorId ||
      req.body.floor_name || req.body.floorName ||
      req.body.unit_id || req.body.unitId ||
      req.body.unit_number || req.body.unitNumber
    );

    if (hasHierarchyInput) {
      try {
        hierarchy = await resolveOrCreateCustomerHierarchy({
          propertyId: req.body.property_id || req.body.propertyId || null,
          propertyName: req.body.property_name || req.body.propertyName || "",
          buildingId: req.body.building_id || req.body.buildingId || null,
          buildingName: req.body.building_name || req.body.buildingName || req.body.building || "",
          hasWing: Boolean(
            (req.body.has_wing ?? req.body.hasWing) ??
            (req.body.wing || req.body.wing_name || req.body.wingName)
          ),
          wingId: req.body.wing_id || req.body.wingId || null,
          wingName: req.body.wing_name || req.body.wingName || req.body.wing || "",
          floorId: req.body.floor_id || req.body.floorId || null,
          floorName: req.body.floor_name || req.body.floorName || "",
          unitId: req.body.unit_id || req.body.unitId || null,
          unitType: req.body.unit_type || req.body.unitType || "Flat",
          unitNumber: req.body.unit_number || req.body.unitNumber || req.body.room_no || req.body.roomNo || "",
          address: [req.body.address_line_1 || req.body.addressLine1, req.body.address_line_2 || req.body.addressLine2].filter(Boolean).join(", "),
          latitude: parseCoordinate(req.body.latitude),
          longitude: parseCoordinate(req.body.longitude),
        });
      } catch (hErr) {
        console.warn("Property hierarchy resolution in profile update fallback:", hErr?.message || hErr);
      }
    }

    const resolvedBuildingName = hierarchy?.buildingName || (req.body.building_name ?? req.body.buildingName);
    const resolvedWing = hierarchy ? hierarchy.wingName : req.body.wing;
    const resolvedRoomNo = hierarchy?.unitNumber || ((req.body.room_no ?? req.body.roomNo) || (req.body.unit_number ?? req.body.unitNumber));

    const allowedPayload = {
      customer_name: req.body.customer_name ?? req.body.name,
      email: req.body.email,
      phone_number: req.body.phone_number ?? req.body.phone,
      address_line_1: req.body.address_line_1 ?? req.body.addressLine1,
      address_line_2: req.body.address_line_2 ?? req.body.addressLine2,
      building_name: resolvedBuildingName,
      wing: resolvedWing,
      room_no: resolvedRoomNo,
      latitude: parseCoordinate(req.body.latitude),
      longitude: parseCoordinate(req.body.longitude),
      // Hierarchy relational fields
      property_id: hierarchy ? hierarchy.propertyId : (req.body.property_id ?? req.body.propertyId),
      building_id: hierarchy ? hierarchy.buildingId : (req.body.building_id ?? req.body.buildingId),
      wing_id: hierarchy ? hierarchy.wingId : (req.body.wing_id ?? req.body.wingId),
      floor_id: hierarchy ? hierarchy.floorId : (req.body.floor_id ?? req.body.floorId),
      unit_id: hierarchy ? hierarchy.unitId : (req.body.unit_id ?? req.body.unitId),
      property_name: hierarchy ? hierarchy.propertyName : (req.body.property_name ?? req.body.propertyName),
      floor_name: hierarchy ? hierarchy.floorName : (req.body.floor_name ?? req.body.floorName),
      unit_type: hierarchy ? hierarchy.unitType : (req.body.unit_type ?? req.body.unitType),
      unit_number: hierarchy ? hierarchy.unitNumber : (req.body.unit_number ?? req.body.unitNumber),
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
      if (value !== undefined) {
        payload[key] = value;
      }
    });

    if (profilePhotoUrl) {
      payload.profile_photo_url = profilePhotoUrl;
    }

    let { data, error } = await updateCustomer(customerId, payload);

    // If update fails due to schema cache miss on new hierarchy columns, retry with legacy fields only
    if (error && (String(error.message).includes("column") || String(error.message).includes("does not exist"))) {
      console.warn("Retrying customer update without new hierarchy columns due to schema error:", error.message);
      const legacyPayload = {};
      const legacyAllowedKeys = [
        "customer_name", "email", "phone_number", "address_line_1", "address_line_2",
        "building_name", "wing", "room_no", "latitude", "longitude", "profile_photo_url"
      ];
      legacyAllowedKeys.forEach((key) => {
        if (payload[key] !== undefined) legacyPayload[key] = payload[key];
      });
      const retry = await updateCustomer(customerId, legacyPayload);
      data = retry.data;
      error = retry.error;
    }

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


