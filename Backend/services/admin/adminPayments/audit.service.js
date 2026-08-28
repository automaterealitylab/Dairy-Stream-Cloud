// Admin payment audit logging. Write failures on a missing audit_logs table
// are tolerated (the log is best-effort).

import { supabase } from "../../../config/supabase.js";

export const writeAdminPaymentAudit = async ({
  adminId,
  dairyId,
  customerId = null,
  entityType,
  entityId,
  action,
  metadata = {},
}) => {
  await supabase
    .from("audit_logs")
    .insert({
      actor_type: "ADMIN",
      actor_id: adminId || null,
      dairy_id: dairyId || null,
      customer_id: customerId || null,
      entity_type: entityType,
      entity_id: entityId == null ? null : String(entityId),
      action,
      metadata,
    })
    .then(({ error }) => {
      const message = String(error?.message || "").toLowerCase();
      if (error && !(message.includes("relation") && message.includes("does not exist"))) {
        throw error;
      }
    });
};
