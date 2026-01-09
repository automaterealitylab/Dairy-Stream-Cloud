import bcrypt from "bcryptjs";
import crypto from "crypto";
import { supabase } from "../../config.js";

export const createResetToken = async (customerId) => {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await supabase.from("password_reset_tokens").insert([
    { customer_id: customerId, token, expires_at: expiresAt },
  ]);

  return token;
};

export const resetPasswordService = async (token, newPassword) => {
  const { data: record } = await supabase
    .from("password_reset_tokens")
    .select("*")
    .eq("token", token)
    .single();

  if (!record) throw new Error("Invalid or expired token");

  const hashed = await bcrypt.hash(newPassword, 10);

  await supabase
    .from("customers")
    .update({ password: hashed })
    .eq("id", record.customer_id);
};
