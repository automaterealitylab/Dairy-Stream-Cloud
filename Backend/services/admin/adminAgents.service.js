import { supabase } from "../../config/supabase.js";

export const getAdminAgents = async ({ page, limit, search }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  console.log(`🔎 Service: Fetching Agents (Page ${page})`);

  // 1. Start Query on 'users' table
  let query = supabase
    .from("users")
    .select("id, full_name, email, mobile, role, building, created_at", { count: "exact" })
    // Filter for STAFF / AGENTS
    .in("role", ["STAFF", "AGENT", "agent", "staff"]) 
    .order("created_at", { ascending: false });

  // 2. Apply Search if exists
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,mobile.ilike.%${search}%`);
  }

  // 3. Apply Pagination
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return {
    data,
    total: count,
    page,
    totalPages: Math.ceil(count / limit),
  };
};

export const getAgentDetails = async (id) => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};