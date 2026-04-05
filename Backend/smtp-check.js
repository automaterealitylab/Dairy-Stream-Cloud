// smtp-check.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;
const emailHost = process.env.EMAIL_HOST || "smtp.gmail.com";
const emailPort = Number(process.env.EMAIL_PORT || 465);
const emailSecure = String(process.env.EMAIL_SECURE || "true").toLowerCase() === "true";

(async () => {
  if (!emailUser || !emailPass) {
    console.error("Missing EMAIL_USER/EMAIL_PASSWORD.");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailSecure,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    connectionTimeout: Number(process.env.EMAIL_CONNECTION_TIMEOUT_MS || 60000),
    greetingTimeout: Number(process.env.EMAIL_GREETING_TIMEOUT_MS || 60000),
    socketTimeout: Number(process.env.EMAIL_SOCKET_TIMEOUT_MS || 120000),
    tls: { rejectUnauthorized: false },
  });

  try {
    const success = await transporter.verify();
    console.log("SMTP verify OK:", success);
  } catch (err) {
    console.error("SMTP verify failed:", err.code || err.name, "-", err.message);
  }
})();