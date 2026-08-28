// Scheduled-delivery email alerts for admin-initiated scheduling.

import { sendEmail } from "../../../utils/email.js";
import { normalizeDate } from "./normalizers.js";

export const hasEmailConfig = () =>
  Boolean(process.env.EMAIL_USER) && Boolean(process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD);

export const sendScheduledDeliveryAlert = async ({
  email,
  customerName,
  dairyName,
  deliveryDate,
  quantityLiters,
  milkType,
  slot,
}) => {
  if (!email || !hasEmailConfig()) return;

  const quantityLabel =
    quantityLiters == null || Number.isNaN(Number(quantityLiters))
      ? "-"
      : `${Number(quantityLiters)} L`;

  const formattedDate = normalizeDate(deliveryDate) || deliveryDate;

  try {
    await sendEmail({
      to: email,
      subject: `Delivery Scheduled for ${formattedDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2 style="margin-bottom: 8px;">Delivery Scheduled</h2>
          <p>Hello ${customerName || "Customer"},</p>
          <p>Your milk delivery has been scheduled by ${dairyName || "your dairy"}.</p>
          <ul>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Milk:</strong> ${milkType || "Milk"}</li>
            <li><strong>Quantity:</strong> ${quantityLabel}</li>
            <li><strong>Slot:</strong> ${slot || "-"}</li>
          </ul>
          <p>Please open your dashboard to track delivery updates.</p>
        </div>
      `,
    });
  } catch (err) {
    console.warn("DELIVERY ALERT EMAIL WARNING:", err?.message || err);
  }
};
