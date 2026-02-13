import bcrypt from "bcryptjs";
import { supabase } from "../../config/supabase.js";
import { generateToken } from "../../utils/jwt.js";

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
