import { supabase } from "../config/supabase.js";

export const findCustomerByEmail = async (email) => {
  return supabase
    .from("customers")
    .select("*")
    .eq("email", email)
    .single();
};

export const createCustomer = async (data) => {
  return supabase
    .from("customers")
    .insert([data])
    .select()
    .single();
};

export const findCustomerById = async (id) => {
  return supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();
};

export const updateCustomer = async (id, updates) => {
  return supabase
    .from("customers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
};
