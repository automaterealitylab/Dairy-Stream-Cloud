import {
  createResetToken,
  resetPasswordService,
} from "../../services/customer/password.service.js";
import { sendResetPasswordEmail } from "../../services/customer/email.service.js";

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("email", email)
      .single();

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

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
