import { supabase } from "../../config/supabase.js";

export const listPublicDairies = async ({ search = "" }) => {
  let query = supabase
    .from("dairies")
    .select("*")
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
  const { data, error } = await supabase
    .from("dairies")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
};
