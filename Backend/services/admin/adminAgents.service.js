import { supabase } from "../../config/supabase.js"; // Adjust path to match your customer service import

export const getAdminAgents = async ({
  page = 1,
  limit = 10,
  search = "",
}) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // 1. Start Query on 'users' table (since agents are users with a role)
  let query = supabase
    .from("users")
    .select("*", { count: "exact" })
    // Filter to only get Agents/Staff
    .in("role", ["STAFF", "AGENT", "agent", "staff"]) 
    .order("created_at", { ascending: false })
    .range(from, to);

  // 2. Apply Search
  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,email.ilike.%${search}%,mobile.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    agents: data, // ✅ Matches pattern: 'customers' -> 'agents'
    total: count,
    page,
    limit,
  };
};

export const getAgentDetails = async (agentId) => {
  // 1. Fetch Basic Agent Info from Users
  const { data: agent, error: agentError } = await supabase
    .from("users")
    .select("*")
    .eq("id", agentId)
    .single();

  if (agentError) throw agentError;

  // 2. (Optional) Fetch related delivery stats or assignments if you have them
  // For now, we return the agent profile to match the structure
  
  return {
    agent,
    // You can add more related data here later, like:
    // deliveries: [], 
    // assignments: null
  };
};