import { supabase } from "../../config/supabase.js";

export const listPublicDairies = async ({ search = "" }) => {
  const PUBLIC_DAIRY_FIELDS =
    "id, dairy_name, category, address, city, state, pincode, image_url, service_type, service_pincodes, service_radius, selected_plan, status, created_at";

  let query = supabase
    .from("dairies")
    .select(PUBLIC_DAIRY_FIELDS)
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `dairy_name.ilike.%${search}%,dairy_email.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
};

export const getPublicDairyById = async (id) => {
  const PUBLIC_DAIRY_FIELDS =
    "id, dairy_name, category, address, city, state, pincode, image_url, service_type, service_pincodes, service_radius, selected_plan, status, created_at";

  const { data, error } = await supabase
    .from("dairies")
    .select(PUBLIC_DAIRY_FIELDS)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
};
