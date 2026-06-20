import crypto from "node:crypto";

export const normalizeAccountNumber = (value) => String(value || "").replace(/\D/g, "");

export const maskAccountNumber = (value) => {
  const normalized = normalizeAccountNumber(value);
  if (!normalized) return "";
  return `${"X".repeat(Math.max(normalized.length - 4, 0))}${normalized.slice(-4)}`;
};

const getAccountEncryptionKey = () => {
  const secret = String(
    process.env.BANK_ACCOUNT_ENCRYPTION_KEY ||
      process.env.BANK_VERIFICATION_ENCRYPTION_KEY ||
      ""
  ).trim();

  if (!secret) return null;
  if (/^[a-f0-9]{64}$/i.test(secret)) return Buffer.from(secret, "hex");

  const decoded = Buffer.from(secret, "base64");
  if (decoded.length === 32) return decoded;

  return crypto.createHash("sha256").update(secret).digest();
};

export const encryptAccountNumber = (accountNumber) => {
  const normalized = normalizeAccountNumber(accountNumber);
  if (!normalized) return null;

  const key = getAccountEncryptionKey();
  if (!key) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);

  return {
    encrypted: true,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  };
};

export const decryptAccountNumber = (encryptedPayload) => {
  if (!encryptedPayload?.encrypted) return "";

  const key = getAccountEncryptionKey();
  if (!key) return "";

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(encryptedPayload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(encryptedPayload.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPayload.data, "base64")),
    decipher.final(),
  ]).toString("utf8");
};

export const resolveStoredAccountNumber = (record = {}) => {
  const decrypted = decryptAccountNumber(record.bank_account_number_encrypted);
  return normalizeAccountNumber(decrypted || record.bank_account_number);
};

export const serializeDairyBankFields = (dairy = {}, { revealAccountNumber = false } = {}) => {
  const fullAccountNumber = resolveStoredAccountNumber(dairy);
  const maskedAccountNumber = dairy.masked_account_number || maskAccountNumber(fullAccountNumber);
  const {
    bank_account_number: _bankAccountNumber,
    bank_account_number_encrypted: _encrypted,
    ...safeDairy
  } = dairy;

  return {
    ...safeDairy,
    bank_account_number: revealAccountNumber ? fullAccountNumber : maskedAccountNumber,
    masked_account_number: maskedAccountNumber,
    bank_account_number_revealed: Boolean(revealAccountNumber && fullAccountNumber),
  };
};

export const buildVerificationResetFields = ({ hasBankDetails = false, timestamp = new Date().toISOString() } = {}) => ({
  bank_verified: false,
  verification_provider: null,
  verification_reference_id: null,
  bank_verification_status: hasBankDetails ? "PENDING_REVERIFY" : "NOT_SUBMITTED",
  bank_verification_timestamp: null,
  account_name_match_score: null,
  verified_account_holder_name: null,
  verified_upi_id: null,
  account_verification_response: {},
  verification_last_error: null,
  verification_method: null,
  vpa_detected: false,
  vpa_verified: false,
  payments_enabled: false,
  verification_required: Boolean(hasBankDetails),
  bank_verification_reset_at: timestamp,
});
