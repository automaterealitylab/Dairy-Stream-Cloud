// Marketplace customer upsert: find or create a customer row for an
// anonymous checkout, with deterministic phone/email encryption.

import { supabase } from "../../config/supabase.js";
import { encryptDeterministic, decryptDeterministic } from "../../utils/crypto.js";
import {
  getSyntheticMarketplaceEmail,
  getSyntheticMarketplacePassword,
  normalizeDigits,
  normalizeString,
} from "./normalizers.js";

export const upsertCustomer = async ({ name, phone, address }) => {
  const cleanPhone = normalizeDigits(phone);
  if (!cleanPhone) {
    const error = new Error("Customer phone is required");
    error.statusCode = 400;
    throw error;
  }

  const encryptedPhone = encryptDeterministic(cleanPhone);
  const { data: existing, error: existingError } = await supabase
    .from("customers")
    .select("*")
    .or(`phone.eq.${cleanPhone},phone_number.eq.${cleanPhone},phone.eq.${encryptedPhone},phone_number.eq.${encryptedPhone}`)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) {
    existing.email = decryptDeterministic(existing.email);
    existing.phone = decryptDeterministic(existing.phone);
    existing.phone_number = decryptDeterministic(existing.phone_number);
    return existing;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      email: encryptDeterministic(getSyntheticMarketplaceEmail(cleanPhone)),
      password: getSyntheticMarketplacePassword(),
      name: normalizeString(name) || "Customer",
      phone: encryptDeterministic(cleanPhone),
      address: normalizeString(address),
      customer_name: normalizeString(name) || "Customer",
      phone_number: encryptDeterministic(cleanPhone),
    })
    .select("*")
    .single();

  if (error) throw error;
  if (data) {
    data.email = decryptDeterministic(data.email);
    data.phone = decryptDeterministic(data.phone);
    data.phone_number = decryptDeterministic(data.phone_number);
  }
  return data;
};
