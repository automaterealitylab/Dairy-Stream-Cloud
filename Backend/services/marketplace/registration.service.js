// Marketplace dairy onboarding and listing: register a dairy with Razorpay
// Route (linked account + stakeholder + product), list dairies and products.

import { supabase } from "../../config/supabase.js";
import { encryptDeterministic } from "../../utils/crypto.js";
import { decryptDairyFields } from "../admin/dairy.service.js";
import {
  isActivationStatusEnabled,
  normalizeDigits,
  normalizeEmail,
  normalizeIfsc,
  normalizePan,
  normalizeStatus,
  normalizeString,
  parseRouteError,
  requireField,
} from "./normalizers.js";
import { getDairyById } from "./queries.service.js";
import {
  createLinkedAccount,
  createStakeholder,
  requestRouteProduct,
  updateRouteSettlementConfig,
} from "./razorpayRoute.service.js";

export const registerMarketplaceDairy = async (payload = {}) => {
  const dairyName = requireField(payload, "dairy_name", "Dairy name");
  const ownerName = requireField(payload, "owner_name", "Owner name");
  const email = normalizeEmail(requireField(payload, "email", "Email"));
  const phone = normalizeDigits(requireField(payload, "phone", "Phone"));
  const bankAccount = normalizeDigits(requireField(payload, "bank_account", "Bank account number"));
  const ifsc = normalizeIfsc(requireField(payload, "ifsc", "IFSC code"));
  const pan = normalizePan(requireField(payload, "pan", "PAN number"));
  const upiId = normalizeString(payload.upi_id);
  const address = requireField(payload, "address", "Address");
  const city = normalizeString(payload.city) || "NA";
  const state = normalizeString(payload.state) || "NA";
  const pincode = normalizeDigits(payload.pincode) || "000000";

  if (phone.length < 8 || phone.length > 15) {
    const error = new Error("Phone must be 8 to 15 digits");
    error.statusCode = 400;
    throw error;
  }
  if (bankAccount.length < 5 || bankAccount.length > 20) {
    const error = new Error("Bank account number must be 5 to 20 digits for Route settlement");
    error.statusCode = 400;
    throw error;
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    const error = new Error("Invalid IFSC code");
    error.statusCode = 400;
    throw error;
  }
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    const error = new Error("Invalid PAN number");
    error.statusCode = 400;
    throw error;
  }

  const { data: dairy, error: dairyError } = await supabase
    .from("dairies")
    .insert({
      dairy_name: dairyName,
      owner_name: ownerName,
      email: encryptDeterministic(email),
      dairy_email: encryptDeterministic(email),
      phone: encryptDeterministic(phone),
      dairy_phone: encryptDeterministic(phone),
      bank_account: encryptDeterministic(bankAccount),
      bank_account_number: bankAccount,
      bank_account_holder_name: ownerName,
      ifsc: encryptDeterministic(ifsc),
      bank_ifsc_code: encryptDeterministic(ifsc),
      pan: encryptDeterministic(pan),
      upi_id: upiId || null,
      address,
      city,
      state,
      pincode,
      route_activation_status: "PENDING",
    })
    .select("*")
    .single();

  if (dairyError) throw dairyError;

  try {
    const account = await createLinkedAccount({
      dairyId: dairy.id,
      dairyName,
      ownerName,
      email,
      phone,
      pan,
      address,
      city,
      state,
      pincode,
    });

    const stakeholder = await createStakeholder({
      accountId: account.id,
      ownerName,
      email,
      phone,
      pan,
      address,
      city,
      state,
      pincode,
    });

    const product = await requestRouteProduct(account.id);
    const productId = product?.id;
    let settlementConfig = product;

    if (productId) {
      settlementConfig = await updateRouteSettlementConfig({
        accountId: account.id,
        productId,
        accountNumber: bankAccount,
        ifsc,
        beneficiaryName: ownerName,
      });
    }

    const activationStatus =
      settlementConfig?.activation_status ||
      product?.activation_status ||
      account?.status ||
      "created";
    const normalizedActivationStatus = normalizeStatus(activationStatus);

    const { data: updatedDairy, error: updateError } = await supabase
      .from("dairies")
      .update({
        razorpay_account_id: account.id,
        razorpay_linked_account_id: account.id,
        razorpay_stakeholder_id: stakeholder?.id || null,
        razorpay_route_product_id: productId || null,
        route_activation_status: normalizedActivationStatus,
        payments_enabled: isActivationStatusEnabled(normalizedActivationStatus),
        updated_at: new Date().toISOString(),
      })
      .eq("id", dairy.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return {
      dairy: decryptDairyFields(updatedDairy),
      razorpay: {
        account,
        stakeholder,
        product: settlementConfig,
      },
    };
  } catch (err) {
    await supabase
      .from("dairies")
      .update({
        route_activation_status: "RAZORPAY_SETUP_FAILED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", dairy.id);
    return parseRouteError(err, "Failed to create Razorpay linked account");
  }
};

export const listMarketplaceDairies = async () => {
  const { data, error } = await supabase
    .from("dairies")
    .select(
      "id, dairy_name, owner_name, email, phone, upi_id, address, razorpay_account_id, razorpay_route_product_id, route_activation_status, payments_enabled, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(decryptDairyFields);
};

export const listMarketplaceProducts = async (dairyId) => {
  const dairy = await getDairyById(dairyId);
  const { data, error } = await supabase
    .from("products")
    .select("id, dairy_id, name, product_type, unit, rate_per_unit, stock_quantity, is_active")
    .eq("dairy_id", dairy.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
};
