import nodemailer from "nodemailer";

export const sendEmail = async ({ to, subject, html }) => {
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
  const smtpHost = process.env.EMAIL_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.EMAIL_PORT || 465);
  const smtpSecure = String(process.env.EMAIL_SECURE || "true").toLowerCase() === "true";
  const emailFrom = process.env.EMAIL_FROM || `"Dairy Automation System" <${emailUser}>`;
  const connectionTimeout = Number(process.env.EMAIL_CONNECTION_TIMEOUT_MS || 10000);
  const greetingTimeout = Number(process.env.EMAIL_GREETING_TIMEOUT_MS || 10000);
  const socketTimeout = Number(process.env.EMAIL_SOCKET_TIMEOUT_MS || 15000);

  if (!emailUser || !emailPassword) {
    throw new Error("Email credentials are not configured (EMAIL_USER and EMAIL_PASS/EMAIL_PASSWORD)");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
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
  });

  try {
    const info = await transporter.sendMail({
      from: emailFrom,
      to,
      subject,
      html,
    });

    console.log(`[EMAIL SENT] to=${to} subject="${subject}" messageId=${info.messageId}`);
    return info;
  } catch (error) {
    console.error(
      `[EMAIL ERROR] to=${to} host=${smtpHost}:${smtpPort} secure=${smtpSecure} user=${emailUser} connectionTimeout=${connectionTimeout} greetingTimeout=${greetingTimeout} socketTimeout=${socketTimeout} code=${error?.code || "UNKNOWN"} message=${error?.message || error}`
    );
    throw new Error(`Email delivery failed: ${error?.message || "Unknown email transport error"}`);
  }
};
