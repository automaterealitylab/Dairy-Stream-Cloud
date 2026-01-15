import crypto from "crypto";
import { supabase } from "../../config.js";
import { sendEmail } from "../../utils/email.js"

export const createEmailVerificationToken = async (customer) => {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("email_verification_tokens")
    .insert([
      {
        customer_id: customer.id,
        token,
        expires_at: expiresAt,
      },
    ])
    .select();

  console.log("🧪 EMAIL TOKEN INSERT RESULT:", data, error);

  if (error) {
    throw error;
  }

  const link = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  // await sendEmail({
  //   to: customer.email,
  //   subject: "Verify your email",
  //   html: `
  //     <p>Welcome to Dairy Automation System 👋</p>
  //     <p>Please verify your email:</p>
  //     <a href="${link}">Verify Email</a>
  //   `,
  // });

  return token;
};

export const verifyEmailToken = async (token) => {
  // 1️⃣ Find valid token
  const { data: record, error: tokenError } = await supabase
    .from("email_verification_tokens")
    .select("*")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  console.log("🧪 VERIFY TOKEN RECORD:", record, tokenError);

  if (tokenError || !record) {
    throw new Error("Invalid or expired verification token");
  }

  // 2️⃣ Update customer (LOUD)
  const { data: updatedCustomer, error: updateError } = await supabase
    .from("customers")
    .update({ is_active: true })
    .eq("id", record.customer_id)
    .select()
    .single();

  console.log("🧪 CUSTOMER UPDATE RESULT:", updatedCustomer, updateError);

  if (updateError) {
    throw updateError;
  }

  if (!updatedCustomer) {
    throw new Error("Customer update failed — no row updated");
  }

  // 3️⃣ Delete token (one-time use)
  const { error: deleteError } = await supabase
    .from("email_verification_tokens")
    .delete()
    .eq("id", record.id);

  if (deleteError) {
    throw deleteError;
  }

  return true;
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
