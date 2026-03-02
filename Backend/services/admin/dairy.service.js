import bcrypt from "bcryptjs";
import { supabase } from "../../config/supabase.js";
import { generateToken } from "../../utils/jwt.js";
import { ensureIdentityIsUnique } from "../authentication/identityUniqueness.service.js";
import verifyEmail from "../../utils/verifyEmail.js";

const normalizeEmail = (value) => (value || "").trim().toLowerCase();
const normalizeIfsc = (value) => String(value || "").trim().toUpperCase();
const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");
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
// ===============================
// REGISTER DAIRY SERVICE (FIXED)
// ===============================
export const registerDairyService = async ({
  dairy_name,
  dairy_phone,
  dairy_email,
  gstin,
  category,
  address,
  city,
  state,
  pincode,
  latitude,
  longitude,
  service_type,
  service_pincodes,
  service_radius,
  owner_name,
  admin_email,
  adminMobile,
  password,
  selected_plan,
  bank_account_holder_name,
  bank_account_number,
  bank_ifsc_code, // ✅ Corrected name here
  bank_name,
  bank_branch,
  upi_id,
  imageUrl,
}) => {
  try {
    const normalizedDairyEmail = normalizeEmail(dairy_email);
    const normalizedAdminEmail = normalizeEmail(admin_email);
    
    // Use the exact names from the arguments above
    const sanitizedAccountNumber = normalizeDigits(bank_account_number);
    const sanitizedIfsc = normalizeIfsc(bank_ifsc_code); // ✅ No longer undefined

    // 1. Validation Logic
    if (sanitizedAccountNumber.length < 8 || sanitizedAccountNumber.length > 20) {
      const inputError = new Error("Bank account number must be between 8 and 20 digits");
      inputError.statusCode = 400;
      throw inputError;
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(sanitizedIfsc)) {
      const inputError = new Error("Invalid IFSC code format");
      inputError.statusCode = 400;
      throw inputError;
    }

    // 2. Uniqueness Checks
    const { data: existingDairyByEmail } = await supabase
      .from("dairies")
      .select("id")
      .ilike("dairy_email", normalizedDairyEmail)
      .maybeSingle();

    if (existingDairyByEmail) {
      const conflictError = new Error("Dairy email is already registered");
      conflictError.statusCode = 409;
      throw conflictError;
    }

    // 3. Insert Dairy
    const { data: dairyData, error: dairyError } = await supabase
      .from("dairies")
      .insert({
        dairy_name,
        dairy_phone,
        dairy_email: normalizedDairyEmail,
        image_url: imageUrl || null,
        gstin,
        category,
        address,
        city,
        state,
        pincode,
        latitude: parseFloat(latitude) || null,
        longitude: parseFloat(longitude) || null,
        service_type,
        service_pincodes,
        service_radius: parseFloat(service_radius) || 10,
        owner_name,
        selected_plan,
        status: "ACTIVE",
        bank_account_holder_name,
        bank_account_number: sanitizedAccountNumber,
        bank_ifsc_code: sanitizedIfsc,
        bank_name,
        bank_branch,
        upi_id,
      })
      .select()
      .single();

    if (dairyError) throw new Error(`Failed to create dairy: ${dairyError.message}`);

    // 4. Create Admin Account
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: adminData, error: adminError } = await supabase
      .from("admins")
      .insert({
        dairy_id: dairyData.id,
        email: normalizedAdminEmail,
        password: hashedPassword,
        name: owner_name,
        phone: adminMobile,
        role: "ADMIN",
        status: "ACTIVE",
      })
      .select()
      .single();

    if (adminError) {
      await supabase.from("dairies").delete().eq("id", dairyData.id); // Rollback
      throw new Error(`Failed to create admin: ${adminError.message}`);
    }

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
      admin: { id: adminData.id, email: adminData.email, name: adminData.name },
    };
  } catch (err) {
    console.error("❌ Dairy registration service error:", err.message);
    throw err;
  }
};
