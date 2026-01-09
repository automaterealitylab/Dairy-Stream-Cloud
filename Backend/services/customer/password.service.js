import crypto from "crypto";
import bcrypt from "bcryptjs";
import { supabase } from "../../config.js";
import { sendEmail } from "./email.service.js";

export const forgotPasswordService = async (email) => {
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("email", email)
    .single();

  if (!customer) {
    throw new Error("Customer not found");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await supabase.from("password_reset_tokens").insert([
    {
      customer_id: customer.id,
      token,
      expires_at: expiresAt,
    },
  ]);

  const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await sendEmail({
    to: customer.email,
    subject: "Reset your password",
    html: `
      <p>You requested a password reset.</p>
      <a href="${link}">Reset Password</a>
    `,
  });
};

export const resetPasswordService = async (token, newPassword) => {
  const { data: record } = await supabase
    .from("password_reset_tokens")
    .select("*")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!record) {
    throw new Error("Invalid or expired token");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await supabase
    .from("customers")
    .update({ password: hashedPassword })
    .eq("id", record.customer_id);

  await supabase
    .from("password_reset_tokens")
    .delete()
    .eq("id", record.id);
};
