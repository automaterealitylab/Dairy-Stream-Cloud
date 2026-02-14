import bcrypt from "bcryptjs";
import { supabase } from "../../config/supabase.js";
import { generateToken } from "../../utils/jwt.js";
import { ensureIdentityIsUnique } from "../authentication/identityUniqueness.service.js";

const normalizeEmail = (value) => (value || "").trim().toLowerCase();
const formatAdminIdentityConflictMessage = (conflict = {}) => {
  const issues = [];

  if (conflict.emailTakenBy) {
    issues.push("Admin email is already used");
  }

  if (conflict.phoneTakenBy) {
    issues.push("Admin mobile number is already used");
  }

  if (issues.length === 0) {
    return "Admin identity details are already in use";
  }

  return `${issues.join(" and ")}. Please use different admin credentials.`;
};

// ===============================
// REGISTER DAIRY SERVICE
// ===============================
export const registerDairyService = async ({
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
}) => {
  try {
    const normalizedDairyEmail = normalizeEmail(dairyEmail);

    const { data: existingDairyByEmail, error: existingDairyError } = await supabase
      .from("dairies")
      .select("id")
      .ilike("dairy_email", normalizedDairyEmail)
      .limit(1)
      .maybeSingle();

    if (existingDairyError) {
      throw new Error(`Failed to validate dairy email: ${existingDairyError.message}`);
    }

    if (existingDairyByEmail) {
      const conflictError = new Error("Dairy email is already registered");
      conflictError.statusCode = 409;
      throw conflictError;
    }

    try {
      await ensureIdentityIsUnique({
        email: adminEmail,
        phone: adminMobile,
      });
    } catch (identityError) {
      if (identityError?.statusCode === 409 && identityError?.conflict) {
        const conflictError = new Error(
          formatAdminIdentityConflictMessage(identityError.conflict)
        );
        conflictError.statusCode = 409;
        throw conflictError;
      }
      throw identityError;
    }

    // Step 1: Create the dairy
    const { data: dairyData, error: dairyError } = await supabase
      .from("dairies")
      .insert({
        dairy_name: dairyName,
        dairy_phone: dairyPhone,
        dairy_email: dairyEmail,
        gstin,
        category,
        address,
        city,
        state,
        pincode,
        service_type: serviceType,
        service_pincodes: servicePincodes || null,
        service_radius: parseFloat(serviceRadius) || 5,
        owner_name: ownerName,
        selected_plan: selectedPlan,
        status: "ACTIVE",
      })
      .select()
      .single();

    if (dairyError) {
      if (dairyError.code === "23505" && dairyError.constraint === "dairies_dairy_email_key") {
        const conflictError = new Error("Dairy email is already registered");
        conflictError.statusCode = 409;
        throw conflictError;
      }
      throw new Error(`Failed to create dairy: ${dairyError.message}`);
    }

    console.log(`✅ Dairy created with ID: ${dairyData.id}`);

    // Step 2: Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Step 3: Create admin for this dairy
    const { data: adminData, error: adminError } = await supabase
      .from("admins")
      .insert({
        dairy_id: dairyData.id,
        email: adminEmail,
        password: hashedPassword,
        name: ownerName,
        phone: adminMobile,
        role: "ADMIN",
        status: "ACTIVE",
      })
      .select()
      .single();

    if (adminError) {
      // Rollback dairy if admin creation fails
      await supabase.from("dairies").delete().eq("id", dairyData.id);
      if (adminError.code === "23505" && adminError.constraint === "admins_email_key") {
        const conflictError = new Error("Admin email is already registered");
        conflictError.statusCode = 409;
        throw conflictError;
      }
      throw new Error(`Failed to create admin: ${adminError.message}`);
    }

    console.log(`✅ Admin created with ID: ${adminData.id}`);

    // Generate JWT token for the newly created admin
    const token = generateToken({
      id: adminData.id,
      email: adminData.email,
      role: "ADMIN",
      dairyId: dairyData.id,
    });

    return {
      success: true,
      token,
      dairy: dairyData,
      admin: {
        id: adminData.id,
        email: adminData.email,
        name: adminData.name,
      },
    };
  } catch (err) {
    console.error("❌ Dairy registation service error:", err.message);
    throw err;
  }
};
