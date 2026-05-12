import { supabase } from "../../config/supabase.js";
import { logger, logError } from "../../utils/logger.js";
import { metrics } from "../../utils/metrics.js";

const isMissingTableOrColumn = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("column") && message.includes("does not exist"))
  );
};

const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

const templates = {
  MONTHLY_BILL_REMINDER: ({ customerName, amount, dueDate, invoiceNumber }) =>
    `Hello ${customerName || "Customer"}, your dairy bill ${invoiceNumber || ""} of Rs. ${Number(amount || 0).toFixed(2)} is due${dueDate ? ` on ${dueDate}` : ""}. Please pay directly to the dairy UPI ID and submit the UTR in DairyStream.`,
  OVERDUE_ESCALATION: ({ customerName, amount }) =>
    `Hello ${customerName || "Customer"}, your dairy payment of Rs. ${Number(amount || 0).toFixed(2)} is overdue. Please complete UPI payment and submit UTR for verification.`,
  PAYMENT_CONFIRMATION: ({ customerName, amount, utrNumber }) =>
    `Payment confirmed. Thank you ${customerName || ""}. We verified Rs. ${Number(amount || 0).toFixed(2)}${utrNumber ? ` with UTR ${utrNumber}` : ""}.`,
  DELIVERY_NOTIFICATION: ({ customerName, deliveryText }) =>
    `Hello ${customerName || "Customer"}, ${deliveryText || "your dairy delivery has been updated."}`,
  INVOICE_SHARE: ({ customerName, invoiceNumber, amount, invoiceUrl }) =>
    `Hello ${customerName || "Customer"}, invoice ${invoiceNumber || ""} for Rs. ${Number(amount || 0).toFixed(2)} is ready.${invoiceUrl ? ` View: ${invoiceUrl}` : ""}`,
};

const renderMessage = ({ templateKey, payload }) => {
  const renderer = templates[templateKey] || templates.MONTHLY_BILL_REMINDER;
  return renderer(payload || {});
};

const sendViaCloudApi = async ({ to, body }) => {
  const token = String(process.env.WHATSAPP_CLOUD_TOKEN || "").trim();
  const phoneNumberId = String(process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID || "").trim();
  if (!token || !phoneNumberId) return { configured: false };

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: true, body },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "WhatsApp Cloud API failed");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return { configured: true, provider: "whatsapp-cloud", response: payload };
};

const sendViaTwilio = async ({ to, body }) => {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  const from = String(process.env.TWILIO_WHATSAPP_FROM || "").trim();
  if (!accountSid || !authToken || !from) return { configured: false };

  const form = new URLSearchParams({
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    To: `whatsapp:+${to}`,
    Body: body,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || "Twilio WhatsApp failed");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return { configured: true, provider: "twilio-whatsapp", response: payload };
};

export const enqueueWhatsAppNotification = async ({
  customerId = null,
  dairyId = null,
  phone,
  templateKey,
  payload = {},
  scheduledFor = null,
}) => {
  const destination = normalizePhone(phone);
  if (!destination) {
    const error = new Error("WhatsApp destination phone is required");
    error.statusCode = 400;
    throw error;
  }

  const event = {
    customer_id: customerId,
    dairy_id: dairyId,
    event_type: templateKey,
    channel: "WHATSAPP",
    status: "QUEUED",
    destination,
    template_key: templateKey,
    payload,
    scheduled_for: scheduledFor,
  };

  const { data, error } = await supabase.from("notification_events").insert(event).select("*").single();
  if (error) {
    if (isMissingTableOrColumn(error)) return { ...event, id: null };
    throw error;
  }

  metrics.increment("notification_enqueued", { channel: "WHATSAPP", templateKey });
  return data;
};

export const sendWhatsAppNotificationEvent = async (event) => {
  const body = renderMessage({ templateKey: event.template_key || event.event_type, payload: event.payload });
  const destination = normalizePhone(event.destination);
  const now = new Date().toISOString();

  try {
    const cloudResult = await sendViaCloudApi({ to: destination, body });
    const result = cloudResult.configured ? cloudResult : await sendViaTwilio({ to: destination, body });

    if (!result.configured) {
      await markNotificationEvent(event.id, {
        status: "SKIPPED",
        error: "WhatsApp provider is not configured",
        provider_response: { bodyPreview: body.slice(0, 120) },
      });
      return { success: false, skipped: true };
    }

    await markNotificationEvent(event.id, {
      status: "SENT",
      sent_at: now,
      provider_response: result.response,
      error: null,
    });
    metrics.increment("notification_sent", { channel: "WHATSAPP", provider: result.provider });
    return { success: true, provider: result.provider };
  } catch (err) {
    logError("whatsapp_notification_failed", err, { eventId: event.id });
    const attemptCount = Number(event.attempt_count || 0) + 1;
    const maxAttempts = Number(process.env.WHATSAPP_MAX_ATTEMPTS || 3);
    const retryDelayMs = Number(process.env.WHATSAPP_RETRY_DELAY_MS || 5 * 60 * 1000);
    await markNotificationEvent(event.id, {
      status: attemptCount >= maxAttempts ? "FAILED" : "RETRY",
      attempt_count: attemptCount,
      scheduled_for:
        attemptCount >= maxAttempts
          ? event.scheduled_for
          : new Date(Date.now() + retryDelayMs).toISOString(),
      error: err.message,
      provider_response: err.payload || {},
    });
    metrics.increment("notification_failed", { channel: "WHATSAPP" });
    return { success: false, error: err.message };
  }
};

export const processQueuedWhatsAppNotifications = async ({ limit = 25 } = {}) => {
  const { data, error } = await supabase
    .from("notification_events")
    .select("*")
    .eq("channel", "WHATSAPP")
    .in("status", ["QUEUED", "RETRY"])
    .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    if (isMissingTableOrColumn(error)) return { processed: 0, skipped: true };
    throw error;
  }

  let processed = 0;
  for (const event of data || []) {
    await sendWhatsAppNotificationEvent(event);
    processed += 1;
  }

  logger.info("whatsapp_queue_processed", { processed });
  return { processed };
};

const markNotificationEvent = async (id, patch) => {
  if (!id) return;
  const { error } = await supabase
    .from("notification_events")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error && !isMissingTableOrColumn(error)) throw error;
};
