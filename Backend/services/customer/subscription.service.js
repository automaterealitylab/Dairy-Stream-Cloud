import { supabase } from "../../config/supabase.js";

const isMissingColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("column") && message.includes("does not exist");
};

const isOnConflictConstraintError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("no unique or exclusion constraint matching the on conflict specification");
};

const isUuidSyntaxError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("invalid input syntax for type uuid");
};

const isMissingTableError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("relation") && message.includes("does not exist");
};

const isActiveSubscriptionStatus = (status) => {
  const value = String(status || "ACTIVE").trim().toUpperCase();
  return value !== "CLOSED" && value !== "CANCELLED" && value !== "CANCELED";
};

const ensureCustomerDairyAssignment = async ({ customerId, dairyId }) => {
  if (!customerId) return;

  const { error } = await supabase
    .from("customers")
    .update({ dairy_id: dairyId ?? null })
    .eq("id", customerId);

  if (!error) return;
  if (isMissingTableError(error) || isMissingColumnError(error) || isUuidSyntaxError(error)) {
    return;
  }
  throw error;
};

const ensureMembershipLink = async ({ customerId, dairyId }) => {
  if (!customerId || !dairyId) return;

  const idColumns = ["customer_id", "user_id", "customerid", "customerId"];

  for (const idColumn of idColumns) {
    const payload = { [idColumn]: customerId, dairy_id: dairyId };

    const { error: upsertError } = await supabase
      .from("memberships")
      .upsert(payload, { onConflict: `${idColumn},dairy_id` });

    if (!upsertError) return;

    // Legacy schema case: memberships uses UUID ids while app uses BIGINT ids.
    // Do not fail subscription save because membership sync is auxiliary.
    if (isUuidSyntaxError(upsertError)) {
      return;
    }

    if (isMissingColumnError(upsertError)) {
      continue;
    }

    if (isOnConflictConstraintError(upsertError)) {
      const { data: existing, error: selectError } = await supabase
        .from("memberships")
        .select("id")
        .eq(idColumn, customerId)
        .eq("dairy_id", dairyId)
        .limit(1)
        .maybeSingle();

      if (selectError && !isMissingColumnError(selectError)) {
        if (isUuidSyntaxError(selectError)) return;
        throw selectError;
      }

      if (existing) return;

      const { error: insertError } = await supabase
        .from("memberships")
        .insert(payload);

      if (!insertError) return;
      if (isUuidSyntaxError(insertError)) return;
      if (isMissingColumnError(insertError)) continue;
      throw insertError;
    }

    if (isUuidSyntaxError(upsertError)) return;
    throw upsertError;
  }
};

export const getSubscriptionByCustomerId = async (customerId) => {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    // Legacy-safe behavior: dashboard should still load even if subscriptions
    // table/columns/types are not yet aligned in an older database.
    if (
      isMissingTableError(error) ||
      isMissingColumnError(error) ||
      isUuidSyntaxError(error)
    ) {
      return null;
    }
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return null;

  const active = rows.find((row) => isActiveSubscriptionStatus(row?.status));
  return active || rows[0] || null;
};

export const upsertSubscription = async (customerId, payload) => {
  const body = {
    customer_id: customerId,
    dairy_id: payload.dairy_id,
    milk_type: payload.milk_type,
    quantity_liters: payload.quantity_liters,
    delivery_slot: payload.delivery_slot,
    start_date: payload.start_date,
    address: payload.address,
    payment_method: payload.payment_method,
    status: payload.status || "ACTIVE",
  };

  let data;
  let error;

  ({ data, error } = await supabase
    .from("subscriptions")
    .upsert(body, { onConflict: "customer_id,dairy_id" })
    .select("*")
    .single());

  if (error && isOnConflictConstraintError(error)) {
    const { data: existing, error: existingError } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("customer_id", customerId)
      .eq("dairy_id", payload.dairy_id)
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.id) {
      const { data: updated, error: updateError } = await supabase
        .from("subscriptions")
        .update(body)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (updateError) throw updateError;
      data = updated;
      error = null;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("subscriptions")
        .insert(body)
        .select("*")
        .single();

      if (insertError) throw insertError;
      data = inserted;
      error = null;
    }
  }

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("invalid input syntax for type uuid")) {
      throw new Error(
        "Database schema mismatch for subscriptions IDs. Run updated SUPABASE_MIGRATIONS.sql and ensure subscriptions.customer_id/dairy_id types match customers.id/dairies.id."
      );
    }
    throw error;
  }

  await ensureMembershipLink({
    customerId,
    dairyId: payload.dairy_id,
  });
  await ensureCustomerDairyAssignment({
    customerId,
    dairyId: payload.dairy_id,
  });

  return data;
};

export const clearSubscriptionByCustomerId = async (customerId) => {
  const { data: deletedRows, error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("customer_id", customerId)
    .select("dairy_id");

  if (error) throw error;

  const dairyIds = [...new Set((deletedRows || []).map((row) => row?.dairy_id).filter(Boolean))];
  if (dairyIds.length === 0) {
    await ensureCustomerDairyAssignment({
      customerId,
      dairyId: null,
    });
    return { deleted: 0 };
  }

  // Best-effort cleanup of membership links for removed subscription dairies.
  const idColumns = ["customer_id", "user_id", "customerid", "customerId"];
  for (const idColumn of idColumns) {
    const { error: membershipError } = await supabase
      .from("memberships")
      .delete()
      .eq(idColumn, customerId)
      .in("dairy_id", dairyIds);

    if (!membershipError) break;
    if (isMissingColumnError(membershipError) || isUuidSyntaxError(membershipError)) continue;
    if (isMissingTableError(membershipError)) break;
    // Membership cleanup is auxiliary; don't fail clear-subscription for this.
    console.warn("MEMBERSHIP CLEANUP WARNING:", membershipError.message);
    break;
  }

  await ensureCustomerDairyAssignment({
    customerId,
    dairyId: null,
  });

  return { deleted: deletedRows.length };
};
