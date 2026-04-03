import nodemailer from "nodemailer";

const EMAIL_HTTP_TIMEOUT_MS = Number(process.env.EMAIL_HTTP_TIMEOUT_MS || 15000);

const withTimeoutSignal = (timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
};

const sendViaResend = async ({ to, subject, html, from }) => {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return null;

  const { signal, clear } = withTimeoutSignal(EMAIL_HTTP_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
      signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error?.message ||
        `Resend API request failed with status ${response.status}`;
      throw new Error(message);
    }

    console.log(
      `[EMAIL SENT] provider=resend to=${Array.isArray(to) ? to.join(",") : to} subject="${subject}" id=${payload?.id || "-"}`
    );

    return payload;
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? `Resend API request timed out after ${EMAIL_HTTP_TIMEOUT_MS}ms`
        : error?.message || "Unknown Resend error";
    throw new Error(`Email delivery failed via Resend: ${message}`);
  } finally {
    clear();
  }
};

const sendViaBrevo = async ({ to, subject, html, from }) => {
  const apiKey = String(process.env.BREVO_API_KEY || "").trim();
  if (!apiKey) return null;

  const fromEmailMatch = String(from || "").match(/<([^>]+)>/);
  const fromEmail = fromEmailMatch?.[1] || String(process.env.EMAIL_USER || "").trim();
  const fromName = String(from || "").replace(/<[^>]+>/, "").replace(/"/g, "").trim() || "Dairy Automation System";

  const { signal, clear } = withTimeoutSignal(EMAIL_HTTP_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: fromName,
          email: fromEmail,
        },
        to: (Array.isArray(to) ? to : [to]).map((email) => ({ email })),
        subject,
        htmlContent: html,
      }),
      signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.code ||
        `Brevo API request failed with status ${response.status}`;
      throw new Error(message);
    }

    console.log(
      `[EMAIL SENT] provider=brevo to=${Array.isArray(to) ? to.join(",") : to} subject="${subject}" id=${payload?.messageId || "-"}`
    );

    return payload;
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? `Brevo API request timed out after ${EMAIL_HTTP_TIMEOUT_MS}ms`
        : error?.message || "Unknown Brevo error";
    throw new Error(`Email delivery failed via Brevo: ${message}`);
  } finally {
    clear();
  }
};

const sendViaSendGrid = async ({ to, subject, html, from }) => {
  const apiKey = String(process.env.SENDGRID_API_KEY || "").trim();
  if (!apiKey) return null;

  const fromEmailMatch = String(from || "").match(/<([^>]+)>/);
  const fromEmail = fromEmailMatch?.[1] || String(process.env.EMAIL_USER || "").trim();
  const fromName =
    String(from || "").replace(/<[^>]+>/, "").replace(/"/g, "").trim() ||
    "Dairy Automation System";

  const { signal, clear } = withTimeoutSignal(EMAIL_HTTP_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: (Array.isArray(to) ? to : [to]).map((email) => ({ email })),
            subject,
          },
        ],
        from: {
          email: fromEmail,
          name: fromName,
        },
        content: [
          {
            type: "text/html",
            value: html,
          },
        ],
      }),
      signal,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const firstError = Array.isArray(payload?.errors) ? payload.errors[0] : null;
      const message =
        firstError?.message ||
        payload?.message ||
        `SendGrid API request failed with status ${response.status}`;
      throw new Error(message);
    }

    console.log(
      `[EMAIL SENT] provider=sendgrid to=${Array.isArray(to) ? to.join(",") : to} subject="${subject}"`
    );

    return { success: true };
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? `SendGrid API request timed out after ${EMAIL_HTTP_TIMEOUT_MS}ms`
        : error?.message || "Unknown SendGrid error";
    throw new Error(`Email delivery failed via SendGrid: ${message}`);
  } finally {
    clear();
  }
};

const sendViaSmtp = async ({ to, subject, html, from }) => {
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
  const emailService = String(process.env.EMAIL_SERVICE || "").trim();
  const smtpHost = process.env.EMAIL_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.EMAIL_PORT || 465);
  const smtpSecure = String(process.env.EMAIL_SECURE || "true").toLowerCase() === "true";
  const connectionTimeout = Number(process.env.EMAIL_CONNECTION_TIMEOUT_MS || 10000);
  const greetingTimeout = Number(process.env.EMAIL_GREETING_TIMEOUT_MS || 10000);
  const socketTimeout = Number(process.env.EMAIL_SOCKET_TIMEOUT_MS || 15000);

  if (!emailUser || !emailPassword) {
    throw new Error("Email credentials are not configured (EMAIL_USER and EMAIL_PASS/EMAIL_PASSWORD)");
  }

  const transportConfig = {
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
    tls: {
      rejectUnauthorized: false,
    },
  };

  if (emailService) {
    transportConfig.service = emailService;
  } else {
    transportConfig.host = smtpHost;
    transportConfig.port = smtpPort;
    transportConfig.secure = smtpSecure;
  }

  const transporter = nodemailer.createTransport(transportConfig);

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });

    console.log(
      `[EMAIL SENT] provider=smtp to=${to} subject="${subject}" messageId=${info.messageId}`
    );
    return info;
  } catch (error) {
    console.error(
      `[EMAIL ERROR] to=${to} service=${emailService || "custom"} host=${smtpHost}:${smtpPort} secure=${smtpSecure} user=${emailUser} connectionTimeout=${connectionTimeout} greetingTimeout=${greetingTimeout} socketTimeout=${socketTimeout} code=${error?.code || "UNKNOWN"} message=${error?.message || error}`
    );
    throw new Error(`Email delivery failed via SMTP: ${error?.message || "Unknown email transport error"}`);
  }
};

export const sendEmail = async ({ to, subject, html }) => {
  const emailUser = String(process.env.EMAIL_USER || "").trim();
  const emailFrom = process.env.EMAIL_FROM || `"Dairy Automation System" <${emailUser}>`;

  if (String(process.env.RESEND_API_KEY || "").trim()) {
    return sendViaResend({ to, subject, html, from: emailFrom });
  }

  if (String(process.env.BREVO_API_KEY || "").trim()) {
    return sendViaBrevo({ to, subject, html, from: emailFrom });
  }

  if (String(process.env.SENDGRID_API_KEY || "").trim()) {
    return sendViaSendGrid({ to, subject, html, from: emailFrom });
  }

  return sendViaSmtp({ to, subject, html, from: emailFrom });
};
