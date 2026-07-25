import {
  createResetToken,
  resetPasswordService,
} from "../../../services/customer/password.service.js";
import { sendResetPasswordEmail } from "../../../services/customer/email.service.js";
import { supabase } from "../../../config/supabase.js";
import { encryptDeterministic, decryptDeterministic } from "../../../utils/crypto.js";

const RESET_RESPONSE = { message: "If the account exists, a password reset email will be sent" };

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return res.json(RESET_RESPONSE);

    const encryptedEmail = encryptDeterministic(normalizedEmail);
    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .in("email", [encryptedEmail, normalizedEmail])
      .limit(1)
      .maybeSingle();

    if (customer) {
      customer.email = decryptDeterministic(customer.email);
      const token = await createResetToken(customer.id);
      await sendResetPasswordEmail(customer.email, token);
    }

    res.json(RESET_RESPONSE);
  } catch {
    res.json(RESET_RESPONSE);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    await resetPasswordService(token, password);

    res.json({ message: "Password reset successful" });
  } catch {
    res.status(400).json({ message: "Invalid or expired reset token" });
  }
};
