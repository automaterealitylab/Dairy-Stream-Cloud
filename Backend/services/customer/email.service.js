import crypto from "crypto";
import { supabase } from "../../config.js";
import { sendEmail } from "../../utils/email.js"

export const createEmailVerificationToken = async (customer) => {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await supabase.from("email_verification_tokens").insert([
    {
      customer_id: customer.id,
      token,
      expires_at: expiresAt,
    },
  ]);

  const link = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  await sendEmail({
    to: customer.email,
    subject: "Verify your email",
    html: `
      <p>Welcome to Dairy Automation System 👋</p>
      <p>Please verify your email:</p>
      <a href="${link}">Verify Email</a>
    `,
  });
};

export const verifyEmailToken = async (token) => {
  const { data: record } = await supabase
    .from("email_verification_tokens")
    .select("*")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!record) {
    throw new Error("Invalid or expired verification token");
  }

  await supabase
    .from("customers")
    .update({ is_active: true })
    .eq("id", record.customer_id);

  await supabase
    .from("email_verification_tokens")
    .delete()
    .eq("id", record.id);
};


export const sendResetPasswordEmail = async (email, token) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await sendEmail({
    to: email,
    subject: "Reset your password",
    html: `
      <p>You requested a password reset.</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
    `,
  });
};
