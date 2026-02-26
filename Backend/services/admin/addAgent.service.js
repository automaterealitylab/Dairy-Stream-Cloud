import { supabase } from "../../config/supabase.js";
import bcrypt from "bcryptjs";
import verifyEmail from "../../utils/verifyEmail.js";

const MAX_ID_ATTEMPTS = 25;

const generateStaffId = () => {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `STF${randomNum}`;
};

const isDuplicateAgentIdError = (error) =>
  error?.code === "23505" &&
  String(error?.message || "").toLowerCase().includes("agent_id");

const isAgentIdTaken = async (agentId) => {
  const { data, error } = await supabase
    .from("agents")
    .select("id")
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to verify staff ID uniqueness");
  }

  return Boolean(data);
};

export const generateUniqueAgentId = async () => {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    const candidate = generateStaffId();
    if (!(await isAgentIdTaken(candidate))) {
      return candidate;
    }
  }

  throw new Error("Could not generate a unique staff ID. Please retry.");
};

export const createAgentService = async (agentData) => {
  const { email, password, agentName, phoneNumber, building, dairyId, agentId } = agentData;
  if (!dairyId) throw new Error("Invalid admin context: dairy is required");

  const isEmailValid = await verifyEmail(email);
  if (!isEmailValid) throw new Error("Invalid or undeliverable email address");

  const hashedPassword = await bcrypt.hash(password, 10);

  let finalAgentId = String(agentId || "").trim().toUpperCase();
  if (!finalAgentId) {
    finalAgentId = await generateUniqueAgentId();
  }

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    if (await isAgentIdTaken(finalAgentId)) {
      finalAgentId = await generateUniqueAgentId();
      continue;
    }

    const { data, error } = await supabase
      .from("agents")
      .insert([
        {
          agent_id: finalAgentId,
          email,
          password: hashedPassword,
          agent_name: agentName,
          phone_number: phoneNumber,
          building,
          dairy_id: dairyId,
        },
      ])
      .select()
      .single();

    if (!error) {
      return data;
    }

    if (!isDuplicateAgentIdError(error)) {
      throw new Error(error.message || "Failed to add agent");
    }

    finalAgentId = await generateUniqueAgentId();
  }

  throw new Error("Could not create agent with a unique staff ID. Please retry.");
};
