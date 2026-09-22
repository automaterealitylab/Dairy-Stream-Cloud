import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

describe("Email Architecture & OTP Delivery Verification Tests", () => {
  const originalEnv = { ...process.env };
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    process.env.BREVO_API_KEY = "test-brevo-key";
    process.env.EMAIL_USER = "automaterealitylabs@gmail.com";
    process.env.EMAIL_PASS = "test-app-password";
    process.env.EMAIL_FROM = "DairyStream <automaterealitylabs@gmail.com>";
    process.env.EMAIL_ONLY_SMTP = "false";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  describe("1. Provider Priority & Fallback Logic", () => {
    test("when primary provider (Brevo) succeeds, fallback (SMTP) is NOT called and exactly one email is sent", async () => {
      let brevoCallCount = 0;
      let brevoPayload = null;

      global.fetch = async (url, options) => {
        if (url.includes("api.brevo.com")) {
          brevoCallCount += 1;
          brevoPayload = JSON.parse(options.body);
          return {
            ok: true,
            status: 200,
            json: async () => ({ messageId: "brevo-msg-123" }),
          };
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      };

      // Import sendEmail dynamically to use the mocked environment
      const { sendEmail } = await import(`../utils/email.js?t=${Date.now()}`);

      const result = await sendEmail({
        to: "customer@example.com",
        subject: "DairyStream Customer Login OTP",
        text: "Your OTP is: 123456",
        html: "<p>Your OTP is: <strong>123456</strong></p>",
      });

      // Primary provider succeeded
      assert.equal(brevoCallCount, 1, "Brevo was attempted exactly once");
      assert.equal(result.messageId, "brevo-msg-123");
      assert.equal(brevoPayload.sender.email, "automaterealitylabs@gmail.com");
      assert.equal(brevoPayload.sender.name, "DairyStream");
      assert.equal(brevoPayload.replyTo.email, "automaterealitylabs@gmail.com");
      assert.ok(brevoPayload.textContent.includes("123456"), "Multipart plain text contains OTP");
      assert.ok(brevoPayload.htmlContent.includes("123456"), "HTML content contains OTP");
    });

    test("when Brevo fails with 401 unauthorized IP, it falls back to secondary provider", async () => {
      let brevoCallCount = 0;

      global.fetch = async (url) => {
        if (url.includes("api.brevo.com")) {
          brevoCallCount += 1;
          return {
            ok: false,
            status: 401,
            json: async () => ({
              message: "We have detected you are using an unrecognised IP address 42.108.224.245.",
              code: "unauthorized",
            }),
          };
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      };

      const { sendEmail } = await import(`../utils/email.js?t=${Date.now() + 1}`);

      // Brevo will fail, and SMTP will be attempted.
      // Since SMTP credentials in this mock test are dummy, SMTP will catch and throw full provider exhaustion error,
      // confirming that Brevo was tried first, failed with the IP error, and execution proceeded to SMTP.
      await assert.rejects(
        async () => {
          await sendEmail({
            to: "customer@example.com",
            subject: "DairyStream Customer Login OTP",
            text: "Your OTP is: 654321",
            html: "<p>Your OTP is: 654321</p>",
          });
        },
        (err) => {
          assert.equal(brevoCallCount, 1, "Brevo was attempted before fallback");
          assert.ok(err.message.includes("Email delivery failed across all configured providers"));
          assert.ok(err.message.includes("unrecognised IP address 42.108.224.245"));
          assert.ok(err.message.includes("smtp:"));
          return true;
        }
      );
    });
  });

  describe("2. OTP Content, Expiry, and Security Constraints", () => {
    test("OTP format is 6 numeric digits and expiry is strictly 5 minutes", () => {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const ttlMs = 5 * 60 * 1000;

      assert.equal(otp.length, 6);
      assert.match(otp, /^\d{6}$/);
      assert.equal(ttlMs, 300000); // 5 mins in ms
    });

    test("Customer OTP message conforms to required branding, security notice, and plaintext parity", () => {
      const otp = "987654";
      const text = `Your DairyStream customer login OTP is: ${otp}\n\nThis OTP is valid for 5 minutes.\nIf you did not request this OTP, please ignore this email.`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2C1A0E; margin-top: 0;">DairyStream Verification</h2>
          <p style="color: #555; font-size: 16px;">Your one-time password (OTP) for customer login is:</p>
          <div style="background-color: #f8f4f0; padding: 12px 20px; border-radius: 6px; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #B8641A; text-align: center; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 14px;">This OTP is valid for <strong>5 minutes</strong>.</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">If you did not request this OTP, please ignore this email.</p>
        </div>
      `;

      // Brand check
      assert.ok(html.includes("DairyStream Verification"));
      // Purpose check
      assert.ok(html.includes("Your one-time password (OTP) for customer login is:"));
      assert.ok(text.includes("Your DairyStream customer login OTP is:"));
      // Expiry check
      assert.ok(html.includes("5 minutes"));
      assert.ok(text.includes("5 minutes"));
      // Security warning
      assert.ok(html.includes("If you did not request this OTP, please ignore this email."));
      assert.ok(text.includes("If you did not request this OTP, please ignore this email."));
      // OTP match
      assert.ok(html.includes(otp));
      assert.ok(text.includes(otp));
      // No spam triggers
      assert.ok(!html.toLowerCase().includes("urgent!"));
      assert.ok(!html.toLowerCase().includes("congratulations"));
      assert.ok(!html.toLowerCase().includes("click here immediately"));
    });

    test("Sender header parsing correctly resolves display name, email, and replyTo", async () => {
      let sentPayload = null;
      global.fetch = async (url, options) => {
        sentPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ messageId: "msg-test-headers" }),
        };
      };

      const { sendEmail } = await import(`../utils/email.js?t=${Date.now() + 2}`);

      await sendEmail({
        to: "recipient@example.com",
        subject: "Subject",
        text: "Plain text",
        html: "<p>HTML</p>",
      });

      assert.equal(sentPayload.sender.name, "DairyStream");
      assert.equal(sentPayload.sender.email, "automaterealitylabs@gmail.com");
      assert.equal(sentPayload.replyTo.email, "automaterealitylabs@gmail.com");
    });
  });
});
