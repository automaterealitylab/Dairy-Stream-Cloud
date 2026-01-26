import bcrypt from "bcryptjs";
import crypto from "crypto";
import { supabase } from "../../config.js";

export const createResetToken = async (customerId) => {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const { error } = await supabase
    .from("password_reset_tokens")
    .insert([
      {
        customer_id: customerId,
        token,
        expires_at: expiresAt,
      },
    ]);

  if (error) {
    throw new Error("Failed to create reset token");
  }

  return token;
};

export const resetPasswordService = async (token, newPassword) => {
  const { data: record, error } = await supabase
    .from("password_reset_tokens")
    .select("*")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !record) {
    throw new Error("Invalid or expired reset token");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const { error: updateError } = await supabase
    .from("customers")
    .update({ password: hashedPassword })
    .eq("id", record.customer_id);

  if (updateError) {
    throw new Error("Failed to reset password");
  }

  // 🔐 Important: delete token after use
  await supabase
    .from("password_reset_tokens")
    .delete()
    .eq("id", record.id);
};
