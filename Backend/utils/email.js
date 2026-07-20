import nodemailer from "nodemailer";

const EMAIL_HTTP_TIMEOUT_MS = Number(process.env.EMAIL_HTTP_TIMEOUT_MS || 8000);
const smtpTransporterCache = new Map();

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
    throw new Error(`Email delivery failed via Resend: ${message}`, { cause: error });
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
    throw new Error(`Email delivery failed via Brevo: ${message}`, { cause: error });
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
    throw new Error(`Email delivery failed via SendGrid: ${message}`, { cause: error });
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
  const connectionTimeout = Number(process.env.EMAIL_CONNECTION_TIMEOUT_MS || 5000);
  const greetingTimeout = Number(process.env.EMAIL_GREETING_TIMEOUT_MS || 5000);
  const socketTimeout = Number(process.env.EMAIL_SOCKET_TIMEOUT_MS || 8000);
  const maxAttempts = Number(process.env.EMAIL_SMTP_MAX_ATTEMPTS || 1);
  const retryBackoffMs = Number(process.env.EMAIL_SMTP_RETRY_BACKOFF_MS || 2000);

  if (!emailUser || !emailPassword) {
    throw new Error("Email credentials are not configured (EMAIL_USER and EMAIL_PASS/EMAIL_PASSWORD)");
  }

  const buildConfig = (override = {}) => ({
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
    connectionTimeout,
    greetingTimeout,
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    socketTimeout,
    tls: {
      rejectUnauthorized: false,
    },
    ...override,
  });

  const getTransporter = (config) => {
    const cacheKey = JSON.stringify({
      service: config.service || null,
      host: config.host || null,
      port: config.port || null,
      secure: config.secure ?? null,
      user: config.auth?.user || null,
    });

    if (!smtpTransporterCache.has(cacheKey)) {
      smtpTransporterCache.set(cacheKey, nodemailer.createTransport(config));
    }

    return smtpTransporterCache.get(cacheKey);
  };

  const smtpConfigs = [];
  if (emailService) {
    smtpConfigs.push(buildConfig({ service: emailService }));
  } else {
    smtpConfigs.push(buildConfig({ host: smtpHost, port: smtpPort, secure: smtpSecure }));

    // Gmail alternative bindings (common timeout/resolution path)
    if (smtpHost.includes("gmail.com")) {
      if (smtpPort !== 465) {
        smtpConfigs.push(buildConfig({ host: "smtp.gmail.com", port: 465, secure: true }));
      }
      if (smtpPort !== 587) {
        smtpConfigs.push(buildConfig({ host: "smtp.gmail.com", port: 587, secure: false }));
      }
    }
  }

  let lastError = null;
  for (const config of smtpConfigs) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const transporter = getTransporter(config);
        const info = await transporter.sendMail({ from, to, subject, html });

        console.log(
          `[EMAIL SENT] provider=smtp to=${to} subject="${subject}" host=${config.host || emailService} port=${config.port || ""} secure=${config.secure || ""} messageId=${info.messageId}`
        );
        return info;
      } catch (error) {
        lastError = error;
        console.warn(
          `[SMTP RETRY] attempt=${attempt}/${maxAttempts} host=${config.host || emailService} port=${config.port || ""} secure=${config.secure || ""} code=${error?.code || "UNKNOWN"} message=${error?.message || error}`
        );

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, retryBackoffMs));
        }
      }
    }
  }

  const errorCode = lastError?.code || "UNKNOWN";
  const errorMessage = lastError?.message || "Connection failed for all SMTP options";
  console.error(
    `[EMAIL ERROR] to=${to} service=${emailService || "custom"} host=${smtpHost}:${smtpPort} secure=${smtpSecure} user=${emailUser} connectionTimeout=${connectionTimeout} greetingTimeout=${greetingTimeout} socketTimeout=${socketTimeout} code=${errorCode} message=${errorMessage}`
  );

  throw new Error(`Email delivery failed via SMTP: ${errorCode} - ${errorMessage}`);
};

export const sendEmail = async ({ to, subject, html }) => {
  const emailUser = String(process.env.EMAIL_USER || "").trim();
  const emailFrom = process.env.EMAIL_FROM || `"Dairy Automation System" <${emailUser}>`;
  const forceSmtp = String(process.env.EMAIL_ONLY_SMTP || "false").toLowerCase() === "true";

  const hasResend = Boolean(String(process.env.RESEND_API_KEY || "").trim());
  const hasBrevo = Boolean(String(process.env.BREVO_API_KEY || "").trim());
  const hasSendGrid = Boolean(String(process.env.SENDGRID_API_KEY || "").trim());
  const hasSmtp = Boolean(emailUser && (process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD));
  const providerAttempts = [];

  if (!forceSmtp) {
    if (hasResend) {
      providerAttempts.push({
        name: "resend",
        send: () => sendViaResend({ to, subject, html, from: emailFrom }),
      });
    }

    if (hasBrevo) {
      providerAttempts.push({
        name: "brevo",
        send: () => sendViaBrevo({ to, subject, html, from: emailFrom }),
      });
    }

    if (hasSendGrid) {
      providerAttempts.push({
        name: "sendgrid",
        send: () => sendViaSendGrid({ to, subject, html, from: emailFrom }),
      });
    }
  }

  if (hasSmtp) {
    providerAttempts.push({
      name: "smtp",
      send: () => sendViaSmtp({ to, subject, html, from: emailFrom }),
    });
  }

  if (providerAttempts.length === 0) {
    throw new Error(
      "Email delivery failed: no email provider configured. Set RESEND_API_KEY, BREVO_API_KEY, SENDGRID_API_KEY, or SMTP credentials."
    );
  }

  const errors = [];
  for (const provider of providerAttempts) {
    try {
      return await provider.send();
    } catch (error) {
      const message = error?.message || "Unknown error";
      errors.push(`${provider.name}: ${message}`);
      console.error(`[EMAIL PROVIDER FAILED] provider=${provider.name} message=${message}`);
    }
  }

  throw new Error(`Email delivery failed across all configured providers. ${errors.join(" | ")}`);
};
