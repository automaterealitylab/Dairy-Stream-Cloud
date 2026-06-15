import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getRedisConnection } from "../config/redis.js";
import { supabase } from "../config/supabase.js";

const DEFAULT_ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const DEFAULT_REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 30);

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
};

export const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");

export const generateRefreshToken = () => crypto.randomBytes(48).toString("base64url");

export const generateToken = ({
  id,
  email,
  role,
  dairyId,
  agentId,
  sessionId = null,
  sessionVersion = 1,
  expiresIn = DEFAULT_ACCESS_TOKEN_TTL,
} = {}) => {
  const jti = crypto.randomUUID();
  return jwt.sign(
    {
      id,
      email,
      role,
      dairyId,
      agentId,
      sid: sessionId,
      sv: sessionVersion,
      typ: "access",
    },
    getJwtSecret(),
    {
      expiresIn,
      jwtid: jti,
    }
  );
};

export const decodeAndVerifyJwt = (token) => jwt.verify(token, getJwtSecret());

const isRevokedInRedis = async (jti) => {
  if (!jti) return false;
  const redis = getRedisConnection();
  if (!redis) return false;
  const value = await redis.get(`auth:revoked:jti:${jti}`);
  return Boolean(value);
};

const isRevokedInDatabase = async (jti) => {
  if (!jti) return false;
  if (String(process.env.AUTH_DB_REVOCATION_CHECK_ENABLED || "false").toLowerCase() !== "true") {
    return false;
  }
  const { data, error } = await supabase
    .from("auth_token_revocations")
    .select("id")
    .eq("token_jti", jti)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (error) {
    const message = String(error.message || "").toLowerCase();
    if (message.includes("relation") && message.includes("does not exist")) return false;
    throw error;
  }

  return Boolean(data?.id);
};

export const verifyAccessToken = async (token) => {
  const decoded = decodeAndVerifyJwt(token);
  if (decoded.typ && decoded.typ !== "access") {
    const err = new Error("Invalid token type");
    err.name = "InvalidTokenType";
    throw err;
  }

  if (await isRevokedInRedis(decoded.jti)) {
    const err = new Error("Token has been revoked");
    err.name = "TokenRevokedError";
    throw err;
  }

  if (await isRevokedInDatabase(decoded.jti)) {
    const err = new Error("Token has been revoked");
    err.name = "TokenRevokedError";
    throw err;
  }

  return decoded;
};

export const createAuthSession = async ({
  actorType,
  actorId,
  dairyId = null,
  email = null,
  role,
  agentId = null,
  sessionVersion = 1,
  deviceId = null,
  deviceLabel = null,
  ipAddress = null,
  userAgent = null,
} = {}) => {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + DEFAULT_REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  const payload = {
    actor_type: actorType,
    actor_id: actorId,
    dairy_id: dairyId,
    refresh_token_hash: hashToken(refreshToken),
    session_version: sessionVersion,
    device_id: deviceId,
    device_label: deviceLabel,
    ip_address: ipAddress,
    user_agent: userAgent,
    expires_at: expiresAt.toISOString(),
  };

  const { data: session, error } = await supabase
    .from("auth_sessions")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;

  const accessToken = generateToken({
    id: actorId,
    email,
    role,
    dairyId,
    agentId,
    sessionId: session.id,
    sessionVersion,
  });

  return {
    accessToken,
    refreshToken,
    sessionId: session.id,
    accessTokenExpiresIn: DEFAULT_ACCESS_TOKEN_TTL,
    refreshTokenExpiresAt: expiresAt.toISOString(),
  };
};

export const issueLoginTokens = async ({
  id,
  email,
  role,
  dairyId = null,
  agentId = null,
  sessionVersion = 1,
  actorType = role,
  ipAddress = null,
  userAgent = null,
  deviceId = null,
  deviceLabel = null,
} = {}) => {
  const sessionsEnabled = String(process.env.AUTH_SESSIONS_ENABLED || "true").toLowerCase() !== "false";
  if (sessionsEnabled) {
    try {
      return await createAuthSession({
        actorType: String(actorType || role || "").toUpperCase(),
        actorId: id,
        dairyId,
        email,
        role,
        agentId,
        sessionVersion,
        ipAddress,
        userAgent,
        deviceId,
        deviceLabel,
      });
    } catch (err) {
      const message = String(err?.message || "").toLowerCase();
      const missingSessionTable = message.includes("auth_sessions") || message.includes("relation");
      if (!missingSessionTable) throw err;
    }
  }

  return {
    accessToken: generateToken({
      id,
      email,
      role,
      dairyId,
      agentId,
      sessionVersion,
      expiresIn: process.env.LEGACY_ACCESS_TOKEN_TTL || process.env.ACCESS_TOKEN_TTL || "7d",
    }),
    refreshToken: null,
    sessionId: null,
    accessTokenExpiresIn: process.env.LEGACY_ACCESS_TOKEN_TTL || process.env.ACCESS_TOKEN_TTL || "7d",
    refreshTokenExpiresAt: null,
  };
};

export const revokeAccessJti = async ({ jti, expiresAt, actorType, actorId, reason = "LOGOUT" }) => {
  if (!jti || !expiresAt) return;
  const expiresDate = new Date(Number(expiresAt) * 1000);
  const ttlSeconds = Math.max(1, Math.ceil((expiresDate.getTime() - Date.now()) / 1000));
  const redis = getRedisConnection();
  if (redis) {
    await redis.set(`auth:revoked:jti:${jti}`, "1", "EX", ttlSeconds);
  }
  await supabase.from("auth_token_revocations").upsert(
    {
      token_jti: jti,
      actor_type: actorType || null,
      actor_id: actorId || null,
      expires_at: expiresDate.toISOString(),
      reason,
    },
    { onConflict: "token_jti" }
  );
};
