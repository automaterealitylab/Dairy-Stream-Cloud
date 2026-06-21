import crypto from "node:crypto";

const getEncryptionKey = () => {
  const secret = String(
    process.env.DATA_ENCRYPTION_KEY ||
      process.env.BANK_ACCOUNT_ENCRYPTION_KEY ||
      process.env.BANK_VERIFICATION_ENCRYPTION_KEY ||
      process.env.JWT_SECRET ||
      "fallback_secret_key_change_in_production_dairy_stream"
  ).trim();

  if (/^[a-f0-9]{64}$/i.test(secret)) {
    return Buffer.from(secret, "hex");
  }

  return crypto.createHash("sha256").update(secret).digest();
};

export const encryptDeterministic = (text) => {
  if (text === null || text === undefined) return text;
  const str = String(text);
  if (!str) return str;

  if (str.startsWith("ENC_DET:aes-256-gcm:")) return str;

  const key = getEncryptionKey();
  const ivSalt = process.env.DET_IV_SALT || "deterministic_iv_salt_dairy_stream_2026";
  const iv = crypto.createHash("sha256").update(str + ivSalt).digest().slice(0, 12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(str, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `ENC_DET:aes-256-gcm:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
};

export const decryptDeterministic = (text) => {
  if (text === null || text === undefined) return text;
  const str = String(text);
  if (!str || !str.startsWith("ENC_DET:aes-256-gcm:")) return str;

  try {
    const parts = str.split(":");
    if (parts.length !== 5) return str;
    const [, , ivBase64, tagBase64, dataBase64] = parts;

    const key = getEncryptionKey();
    const iv = Buffer.from(ivBase64, "base64");
    const tag = Buffer.from(tagBase64, "base64");
    const encryptedData = Buffer.from(dataBase64, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Decryption failed:", error.message);
    return str;
  }
};

export const decryptRecursive = (data) => {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    if (data.startsWith("ENC_DET:aes-256-gcm:")) {
      return decryptDeterministic(data);
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => decryptRecursive(item));
  }

  if (typeof data === "object") {
    if (data instanceof Buffer || data instanceof Date) {
      return data;
    }
    const decrypted = {};
    for (const key of Object.keys(data)) {
      decrypted[key] = decryptRecursive(data[key]);
    }
    return decrypted;
  }

  return data;
};

