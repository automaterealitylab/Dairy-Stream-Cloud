import { revokeAccessJti, revokeAuthSession } from "../../utils/jwt.js";

export const logout = async (req, res) => {
  await revokeAccessJti({
    jti: req.user?.jti,
    expiresAt: req.user?.exp,
    actorType: req.user?.role,
    actorId: req.user?.id,
    reason: "LOGOUT",
  });

  await revokeAuthSession({
    sessionId: req.user?.sid,
    actorType: req.user?.role,
    actorId: req.user?.id,
    reason: "LOGOUT",
  });

  res.json({ success: true });
};


