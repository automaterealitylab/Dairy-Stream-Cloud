import {
  createResetToken,
  resetPasswordService,
} from "../../../services/customer/password.service.js";
import { sendResetPasswordEmail } from "../../../services/customer/email.service.js";
import { supabase } from "../../../config/supabase.js";
import { encryptDeterministic, decryptDeterministic } from "../../../utils/crypto.js";

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const encryptedEmail = encryptDeterministic(normalizedEmail);

    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .or(`email.eq.${encryptedEmail},email.eq.${normalizedEmail}`)
      .limit(1)
      .maybeSingle();

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    customer.email = decryptDeterministic(customer.email);

    const token = await createResetToken(customer.id);
    await sendResetPasswordEmail(customer.email, token);

    res.json({ message: "Password reset email sent" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    await resetPasswordService(token, password);

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
