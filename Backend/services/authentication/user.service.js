import { supabase } from "../../config/supabase.js";

const clean = (v)=> String(v ?? "").trim();
const digits = (v)=> String(v ?? "").replace(/\D/g,"");

// ================= ADMIN =================
export const findAdminByEmail = async(email)=>{
  const {data} = await supabase
  .from("admins")
  .select("*")
  .eq("email", email)
  .maybeSingle();

  return data || null;
};

// ================= AGENT =================
export const findAgentById = async(agentId)=>{
  const {data} = await supabase
  .from("agents")
  .select("*")
  .eq("agent_id", agentId.toUpperCase())
  .maybeSingle();

  return data || null;
};

// ================= CUSTOMER =================
export const findCustomerByIdentifier = async(identifier)=>{
  const value = clean(identifier);

  // email
  if(value.includes("@")){
    const {data} = await supabase
    .from("customers")
    .select("*")
    .ilike("email", value)
    .maybeSingle();

    return data || null;
  }

  // phone
  const onlyDigits = digits(value);
  const last10 = onlyDigits.length>10 ? onlyDigits.slice(-10) : onlyDigits;

  const {data} = await supabase
  .from("customers")
  .select("*")
  .ilike("phone_number", `%${last10}%`)
  .maybeSingle();

  return data || null;
};
