import crypto from "crypto";
import { supabase } from "../../config/supabase.js";
import { assertArray, assertPositiveNumber } from "../../utils/validation.js";
import { logger } from "../../utils/logger.js";
import { metrics } from "../../utils/metrics.js";
import {
  writeFinancialLedgerEntry,
  writeImmutableAudit,
  writeSettlementLedgerEntry,
} from "./auditLedger.service.js";
import { enqueueMarketplaceJob, isQueueEnabled, QUEUE_NAMES } from "./queue.service.js";
import {
  createStakeholder,
  createLinkedAccount,
  fetchOrderTransfers,
  fetchLinkedAccount,
  fetchRazorpayPayment,
  fetchRouteProduct,
  getRouteKeyId,
  getRouteRazorpayClient,
  requestRouteProduct,
  updateRouteSettlementConfig,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "./razorpayRoute.service.js";
import { detectSuspiciousMarketplaceOrder } from "./fraud.service.js";

const normalizeString = (value) => String(value || "").trim();
const normalizeEmail = (value) => normalizeString(value).toLowerCase();
const normalizeDigits = (value) => normalizeString(value).replace(/\D/g, "");
const normalizeIfsc = (value) => normalizeString(value).toUpperCase();
const normalizePan = (value) => normalizeString(value).toUpperCase();
const normalizeStatus = (value) => normalizeString(value).toUpperCase();
const isWebhookQueueRequired = () =>
  String(process.env.WEBHOOK_QUEUE_REQUIRED || "false").toLowerCase() === "true";

const getTaxPercent = () => {
  const value = Number(process.env.MARKETPLACE_TAX_PERCENT || 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
};

const getDeliveryFee = () => {
  const value = Number(process.env.MARKETPLACE_DELIVERY_FEE || 0);
  return Number.isFinite(value) && value >= 0 ? Number(value.toFixed(2)) : 0;
};

const requireField = (payload, key, label = key) => {
  const value = normalizeString(payload?.[key]);
  if (!value) {
    const error = new Error(`${label} is required`);
    error.statusCode = 400;
    throw error;
  }
  return value;
};

const parseRouteError = (err, fallback) => {
  const description =
    err?.response?.data?.error?.description ||
    err?.response?.data?.error?.reason ||
    err?.response?.data?.message ||
    err?.message ||
    fallback;
  const error = new Error(description);
  error.statusCode = err?.response?.status || err?.statusCode || 400;
  throw error;
};

const getSyntheticMarketplaceEmail = (phone) =>
  `marketplace-${normalizeDigits(phone)}@dairy-stream.local`;

const getSyntheticMarketplacePassword = () =>
  `marketplace:${crypto.randomBytes(24).toString("hex")}`;

const isRouteStatusBlocking = (status) =>
  ["RAZORPAY_SETUP_FAILED", "REJECTED", "SUSPENDED", "DISABLED", "FAILED"].includes(
    normalizeStatus(status)
  );

const isDairyRouteReady = (dairy) =>
  Boolean(dairy?.payments_enabled) &&
  Boolean(normalizeString(dairy?.razorpay_account_id) || normalizeString(dairy?.razorpay_linked_account_id)) &&
  !isRouteStatusBlocking(dairy?.route_activation_status || dairy?.razorpay_onboarding_status);

const isActivationStatusEnabled = (status) =>
  ["ACTIVE", "ACTIVATED", "ENABLED", "LINKED"].includes(normalizeStatus(status));

const verifyLinkedAccountReadiness = async ({ dairy, linkedAccountId }) => {
  if (!normalizeString(dairy?.razorpay_route_product_id)) {
    const error = new Error("Razorpay Route product is not configured for this dairy");
    error.statusCode = 400;
    throw error;
  }

  const account = await fetchLinkedAccount(linkedAccountId);
  const accountStatus = normalizeStatus(account?.status || account?.activation_status);
  if (isRouteStatusBlocking(accountStatus)) {
    const error = new Error(`Linked account is not active. Current status: ${accountStatus || "UNKNOWN"}`);
    error.statusCode = 400;
    throw error;
  }

  let product = null;
  product = await fetchRouteProduct({
    accountId: linkedAccountId,
    productId: dairy.razorpay_route_product_id,
  });
  const productStatus = normalizeStatus(product?.activation_status || product?.status);
  if (!isActivationStatusEnabled(productStatus)) {
    const error = new Error(`Route product is not active. Current status: ${productStatus || "UNKNOWN"}`);
    error.statusCode = 400;
    throw error;
  }

  return { account, product };
};

const upsertCustomer = async ({ name, phone, address }) => {
  const cleanPhone = normalizeDigits(phone);
  if (!cleanPhone) {
    const error = new Error("Customer phone is required");
    error.statusCode = 400;
    throw error;
  }

  const { data: existing, error: existingError } = await supabase
    .from("customers")
    .select("*")
    .or(`phone.eq.${cleanPhone},phone_number.eq.${cleanPhone}`)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing;

  const { data, error } = await supabase
    .from("customers")
    .insert({
      email: getSyntheticMarketplaceEmail(cleanPhone),
      password: getSyntheticMarketplacePassword(),
      name: normalizeString(name) || "Customer",
      phone: cleanPhone,
      address: normalizeString(address),
      customer_name: normalizeString(name) || "Customer",
      phone_number: cleanPhone,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

const getDairyById = async (dairyId) => {
  const id = Number(dairyId);
  if (!Number.isFinite(id) || id <= 0) {
    const error = new Error("Valid dairy is required");
    error.statusCode = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from("dairies")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const notFound = new Error("Dairy not found");
    notFound.statusCode = 404;
    throw notFound;
  }
  return data;
};

const getOrderByRazorpayOrderId = async (razorpayOrderId) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("razorpay_order_id", razorpayOrderId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

const updateOrderAndPaymentStatus = async ({
  razorpayOrderId,
  razorpayPaymentId = null,
  paymentStatus,
  settlementStatus = null,
  transferId = null,
  transferStatus = null,
  settlementId = null,
  failureReason = null,
}) => {
  const order = await getOrderByRazorpayOrderId(razorpayOrderId);
  if (!order?.id) return null;

  const now = new Date().toISOString();
  const orderUpdate = {
    payment_status: paymentStatus,
    updated_at: now,
  };
  if (razorpayPaymentId) orderUpdate.razorpay_payment_id = razorpayPaymentId;

  const { error: orderError } = await supabase
    .from("orders")
    .update(orderUpdate)
    .eq("id", order.id);

  if (orderError) throw orderError;

  const paymentUpdate = {
    status: paymentStatus,
    updated_at: now,
  };
  if (settlementStatus) paymentUpdate.settlement_status = settlementStatus;
  if (transferStatus) paymentUpdate.transfer_status = transferStatus;
  if (transferId) paymentUpdate.razorpay_transfer_id = transferId;
  if (settlementId) paymentUpdate.settlement_id = settlementId;
  if (failureReason) paymentUpdate.failure_reason = failureReason;
  if (razorpayPaymentId) paymentUpdate.razorpay_payment_id = razorpayPaymentId;

  const { error: paymentError } = await supabase
    .from("payments")
    .update(paymentUpdate)
    .eq("order_id", order.id);

  if (paymentError) throw paymentError;
  if (paymentStatus === "PAID") {
    await writeFinancialLedgerEntry({
      paymentId: null,
      orderId: order.id,
      dairyId: order.dairy_id,
      customerId: order.customer_id,
      entryType: "PAYMENT_CAPTURED",
      direction: "CREDIT",
      amount: order.amount,
      referenceType: "RAZORPAY_PAYMENT",
      referenceId: razorpayPaymentId,
      metadata: { razorpayOrderId, transferId, transferStatus, settlementId },
    });
  }
  await writeImmutableAudit({
    entityType: "payment",
    entityId: razorpayPaymentId || razorpayOrderId,
    eventType: `PAYMENT_STATUS_${paymentStatus}`,
    payload: { razorpayOrderId, razorpayPaymentId, settlementStatus, transferId, transferStatus, settlementId },
  });
  return order;
};

const updatePaymentByTransferId = async ({
  transferId,
  settlementStatus,
  transferStatus,
  settlementId = null,
  failureReason = null,
}) => {
  if (!transferId) return null;

  const update = {
    updated_at: new Date().toISOString(),
  };
  if (settlementStatus) update.settlement_status = settlementStatus;
  if (transferStatus) update.transfer_status = transferStatus;
  if (settlementId) update.settlement_id = settlementId;
  if (failureReason) update.failure_reason = failureReason;

  const { data, error } = await supabase
    .from("payments")
    .update(update)
    .eq("razorpay_transfer_id", transferId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (data?.id) {
    await writeSettlementLedgerEntry({
      paymentId: data.id,
      dairyId: data.dairy_id,
      razorpayTransferId: transferId,
      settlementId,
      amount: data.amount,
      status: settlementStatus || transferStatus,
      metadata: { failureReason },
    });
  }
  return data || null;
};

const updatePaymentsBySettlementId = async ({ settlementId }) => {
  if (!settlementId) return [];

  const { data, error } = await supabase
    .from("payments")
    .update({
      settlement_status: "SETTLED",
      transfer_status: "PROCESSED",
      settlement_id: settlementId,
      updated_at: new Date().toISOString(),
    })
    .eq("settlement_id", settlementId)
    .select("*");

  if (error) throw error;
  await Promise.all(
    (data || []).map((payment) =>
      writeSettlementLedgerEntry({
        paymentId: payment.id,
        dairyId: payment.dairy_id,
        razorpayTransferId: payment.razorpay_transfer_id,
        settlementId,
        amount: payment.amount,
        status: "SETTLED",
      })
    )
  );
  return data || [];
};

const getFirstOrderTransfer = async (orderId) => {
  try {
    const transfers = await fetchOrderTransfers(orderId);
    return transfers[0] || null;
  } catch {
    return null;
  }
};

const calculateMarketplacePricing = async ({ dairyId, items }) => {
  const cleanItems = assertArray(items, "Order items").map((item) => ({
    productId: Number(item.product_id || item.productId),
    quantity: assertPositiveNumber(item.quantity, "Item quantity"),
  }));

  if (cleanItems.length > 25) {
    const error = new Error("Order cannot contain more than 25 line items");
    error.statusCode = 400;
    throw error;
  }

  const productIds = [...new Set(cleanItems.map((item) => item.productId).filter(Boolean))];
  if (productIds.length !== cleanItems.length) {
    const error = new Error("Each order item must reference one valid product");
    error.statusCode = 400;
    throw error;
  }

  const { data: products, error } = await supabase
    .from("products")
    .select("id, dairy_id, name, product_type, unit, rate_per_unit, stock_quantity, is_active")
    .eq("dairy_id", dairyId)
    .in("id", productIds);

  if (error) throw error;
  const productById = new Map((products || []).map((product) => [Number(product.id), product]));

  const lineItems = cleanItems.map((item) => {
    const product = productById.get(item.productId);
    if (!product || !product.is_active) {
      const err = new Error(`Product ${item.productId} is not available for this dairy`);
      err.statusCode = 400;
      throw err;
    }

    const rate = Number(product.rate_per_unit || 0);
    const stock = Number(product.stock_quantity || 0);
    if (rate <= 0) {
      const err = new Error(`${product.name} does not have a valid price`);
      err.statusCode = 400;
      throw err;
    }
    if (stock > 0 && item.quantity > stock) {
      const err = new Error(`${product.name} has only ${stock} ${product.unit || "units"} in stock`);
      err.statusCode = 400;
      throw err;
    }

    const lineTotal = Number((rate * item.quantity).toFixed(2));
    return {
      product_id: product.id,
      name: product.name,
      unit: product.unit,
      quantity: item.quantity,
      rate_per_unit: rate,
      line_total: lineTotal,
    };
  });

  const subtotal = Number(lineItems.reduce((sum, item) => sum + item.line_total, 0).toFixed(2));
  const taxPercent = getTaxPercent();
  const taxAmount = Number(((subtotal * taxPercent) / 100).toFixed(2));
  const deliveryFee = getDeliveryFee();
  const total = Number((subtotal + taxAmount + deliveryFee).toFixed(2));

  if (total < 1) {
    const error = new Error("Calculated order total must be at least INR 1.00");
    error.statusCode = 400;
    throw error;
  }

  return {
    subtotal,
    taxPercent,
    taxAmount,
    deliveryFee,
    total,
    lineItems,
  };
};

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
      email,
      dairy_email: email,
      phone,
      dairy_phone: phone,
      bank_account: bankAccount,
      bank_account_number: bankAccount,
      bank_account_holder_name: ownerName,
      ifsc,
      bank_ifsc_code: ifsc,
      pan,
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
      dairy: updatedDairy,
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
  return data || [];
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

export const createMarketplaceOrder = async (payload = {}) => {
  const dairy = await getDairyById(payload.dairy_id);

  const linkedAccountId =
    normalizeString(dairy.razorpay_account_id) ||
    normalizeString(dairy.razorpay_linked_account_id);

  if (!linkedAccountId) {
    const error = new Error("Dairy is not configured with a Razorpay linked account");
    error.statusCode = 400;
    throw error;
  }

  if (!isDairyRouteReady(dairy)) {
    const error = new Error(
      `Dairy Razorpay Route account is not ready for payments. Current status: ${
        dairy.route_activation_status || dairy.razorpay_onboarding_status || "PENDING"
      }`
    );
    error.statusCode = 400;
    throw error;
  }

  await verifyLinkedAccountReadiness({ dairy, linkedAccountId });

  const customer = await upsertCustomer({
    name: payload.customer_name,
    phone: payload.customer_phone,
    address: payload.customer_address,
  });

  const pricing = await calculateMarketplacePricing({
    dairyId: dairy.id,
    items: payload.items,
  });
  await detectSuspiciousMarketplaceOrder({ customer, dairy, pricing, payload });
  const amount = pricing.total;
  const amountInPaise = Math.round(amount * 100);
  const razorpay = getRouteRazorpayClient();
  const receipt = `mkt_${Date.now()}_${dairy.id}`.slice(0, 40);
  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt,
    partial_payment: false,
    notes: {
      customer_id: String(customer.id),
      dairy_id: String(dairy.id),
      marketplace: "dairy_stream_cloud",
      commission: "0",
    },
    transfers: [
      {
        account: linkedAccountId,
        amount: amountInPaise,
        currency: "INR",
        notes: {
          dairy_id: String(dairy.id),
          customer_id: String(customer.id),
          commission: "0",
        },
        linked_account_notes: ["dairy_id", "customer_id", "commission"],
        on_hold: false,
      },
    ],
  });

  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customer.id,
      dairy_id: dairy.id,
      amount,
      subtotal: pricing.subtotal,
      tax_amount: pricing.taxAmount,
      delivery_fee: pricing.deliveryFee,
      pricing_snapshot: {
        tax_percent: pricing.taxPercent,
        line_items: pricing.lineItems,
      },
      payment_status: "CREATED",
      razorpay_order_id: order.id,
    })
    .select("*")
    .single();

  if (orderError) throw orderError;

  const transfer = Array.isArray(order?.transfers)
    ? order.transfers[0]
    : await getFirstOrderTransfer(order.id);
  const transferId = transfer?.id || null;
  const { data: paymentRow, error: paymentError } = await supabase
    .from("payments")
    .insert({
      order_id: orderRow.id,
      customer_id: customer.id,
      dairy_id: dairy.id,
      amount,
      status: "CREATED",
      settlement_status: transferId ? "TRANSFER_CREATED" : "PENDING",
      transfer_status: transfer?.status ? normalizeStatus(transfer.status) : "PENDING",
      razorpay_order_id: order.id,
      razorpay_transfer_id: transferId || null,
    })
    .select("*")
    .single();

  if (paymentError) throw paymentError;

  return {
    keyId: getRouteKeyId(),
    order,
    orderRow,
    payment: paymentRow,
    customer,
    pricing,
    dairy: {
      id: dairy.id,
      dairy_name: dairy.dairy_name,
      razorpay_account_id: linkedAccountId,
    },
  };
};

export const verifyMarketplacePayment = async ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    const error = new Error("Missing Razorpay verification fields");
    error.statusCode = 400;
    throw error;
  }

  const isValid = verifyCheckoutSignature({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
  });

  if (!isValid) {
    const error = new Error("Payment signature verification failed");
    error.statusCode = 400;
    throw error;
  }

  const localOrder = await getOrderByRazorpayOrderId(razorpay_order_id);
  if (!localOrder?.id) {
    const error = new Error("Local order not found for Razorpay order");
    error.statusCode = 404;
    throw error;
  }

  const payment = await fetchRazorpayPayment(razorpay_payment_id);
  const expectedAmount = Math.round(Number(localOrder.amount || 0) * 100);
  if (payment?.order_id !== razorpay_order_id) {
    const error = new Error("Razorpay payment does not belong to this order");
    error.statusCode = 400;
    throw error;
  }
  if (Number(payment?.amount || 0) !== expectedAmount || payment?.currency !== "INR") {
    const error = new Error("Razorpay payment amount or currency mismatch");
    error.statusCode = 400;
    throw error;
  }
  if (payment?.status !== "captured" && payment?.captured !== true) {
    const error = new Error(`Payment is not captured yet. Current Razorpay status: ${payment?.status || "unknown"}`);
    error.statusCode = 409;
    throw error;
  }

  const transfer = await getFirstOrderTransfer(razorpay_order_id);
  const order = await updateOrderAndPaymentStatus({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    paymentStatus: "PAID",
    settlementStatus: transfer?.recipient_settlement_id ? "SETTLED" : "TRANSFER_CREATED",
    transferId: transfer?.id || null,
    transferStatus: transfer?.status ? normalizeStatus(transfer.status) : "PENDING",
    settlementId: transfer?.recipient_settlement_id || null,
  });

  return {
    success: true,
    order,
    razorpay_payment_id,
  };
};

export const processMarketplaceWebhookPayload = async (payload = {}) => {
  const eventType = payload?.event || "unknown";
  const paymentEntity = payload?.payload?.payment?.entity || {};
  const orderEntity = payload?.payload?.order?.entity || {};
  const transferEntity = payload?.payload?.transfer?.entity || {};
  const settlementEntity = payload?.payload?.settlement?.entity || {};
  const razorpayOrderId = paymentEntity.order_id || orderEntity.id || transferEntity.source || null;
  const razorpayPaymentId = paymentEntity.id || null;
  const transferId = transferEntity.id || null;
  metrics.increment("marketplace_webhook_processed", { event: eventType });
  await writeImmutableAudit({
    entityType: "razorpay_webhook",
    entityId: payload?.id || paymentEntity?.id || transferId || razorpayOrderId,
    eventType,
    payload: {
      razorpayOrderId,
      razorpayPaymentId,
      transferId,
      settlementId: settlementEntity?.id || transferEntity?.recipient_settlement_id || null,
    },
  });

  if (eventType === "payment.captured" || eventType === "order.paid") {
    if (razorpayOrderId) {
      const transfer = await getFirstOrderTransfer(razorpayOrderId);
      await updateOrderAndPaymentStatus({
        razorpayOrderId,
        razorpayPaymentId,
        paymentStatus: "PAID",
        settlementStatus: transfer?.recipient_settlement_id ? "SETTLED" : "TRANSFER_CREATED",
        transferId: transfer?.id || null,
        transferStatus: transfer?.status ? normalizeStatus(transfer.status) : "PENDING",
        settlementId: transfer?.recipient_settlement_id || null,
      });
    }
  }

  if (eventType === "payment.failed") {
    if (razorpayOrderId) {
      await updateOrderAndPaymentStatus({
        razorpayOrderId,
        razorpayPaymentId,
        paymentStatus: "FAILED",
        settlementStatus: "NOT_SETTLED",
        failureReason: paymentEntity?.error_description || paymentEntity?.error_reason || null,
      });
    }
  }

  if (eventType === "transfer.processed") {
    await updatePaymentByTransferId({
      transferId,
      settlementStatus: transferEntity?.recipient_settlement_id ? "SETTLED" : "TRANSFER_PROCESSED",
      transferStatus: "PROCESSED",
      settlementId: transferEntity?.recipient_settlement_id || null,
    });
  }

  if (eventType === "transfer.failed") {
    await updatePaymentByTransferId({
      transferId,
      settlementStatus: "TRANSFER_FAILED",
      transferStatus: "FAILED",
      failureReason: transferEntity?.error_description || transferEntity?.error_reason || "Transfer failed",
    });
  }

  if (eventType === "settlement.processed") {
    const settlementId = settlementEntity?.id || transferEntity?.recipient_settlement_id || null;
    if (transferId) {
      await updatePaymentByTransferId({
        transferId,
        settlementStatus: "SETTLED",
        transferStatus: transferEntity?.status ? normalizeStatus(transferEntity.status) : "PROCESSED",
        settlementId,
      });
    } else {
      await updatePaymentsBySettlementId({ settlementId });
    }
  }

  return { event: eventType };
};

export const processStoredMarketplaceWebhook = async (logRow) => {
  if (!logRow?.id) return { processed: false };

  try {
    await processMarketplaceWebhookPayload(logRow.payload || {});
    await supabase
      .from("webhook_logs")
      .update({
        processed: true,
        processing_error: null,
        next_retry_at: null,
        dead_letter: false,
        processed_at: new Date().toISOString(),
      })
      .eq("id", logRow.id);

    return { processed: true };
  } catch (err) {
    const attempts = Number(logRow.attempts || 0) + 1;
    await supabase
      .from("webhook_logs")
      .update({
        attempts,
        processing_error: err.message || "Webhook retry processing failed",
        next_retry_at: attempts >= 5 ? null : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        dead_letter: attempts >= 5,
      })
      .eq("id", logRow.id);

    throw err;
  }
};

export const handleMarketplaceWebhook = async ({ rawBody, signature, eventId = null }) => {
  if (!verifyWebhookSignature({ rawBody, signature })) {
    const error = new Error("Invalid Razorpay webhook signature");
    error.statusCode = 400;
    throw error;
  }

  const payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody || "{}"));
  const eventType = payload?.event || "unknown";
  const resolvedEventId = normalizeString(eventId) || normalizeString(payload?.id) || null;
  const eventCreatedAt = Number(payload?.created_at || payload?.payload?.payment?.entity?.created_at || 0);
  const replayWindowSeconds = Number(process.env.RAZORPAY_WEBHOOK_REPLAY_WINDOW_SECONDS || 86400);
  if (eventCreatedAt > 0 && Math.abs(Date.now() / 1000 - eventCreatedAt) > replayWindowSeconds) {
    const error = new Error("Webhook event is outside replay protection window");
    error.statusCode = 400;
    throw error;
  }

  let logRow = null;
  let webhookAttempts = 0;
  if (resolvedEventId) {
    const { data: existingLog, error: existingLogError } = await supabase
      .from("webhook_logs")
      .select("id, processed, attempts")
      .eq("razorpay_event_id", resolvedEventId)
      .limit(1)
      .maybeSingle();

    if (existingLogError) throw existingLogError;
    if (existingLog?.processed) {
      return { received: true, duplicate: true, event: eventType };
    }
    if (existingLog?.id) {
      webhookAttempts = Number(existingLog.attempts || 0);
      const { data: updatedLog, error: updateLogError } = await supabase
        .from("webhook_logs")
        .update({
          event_type: eventType,
          payload,
          processing_error: null,
          event_version: String(payload?.version || "v1"),
          lineage_key: razorpayOrderIdFromPayload(payload) || resolvedEventId,
        })
        .eq("id", existingLog.id)
        .select("id")
        .single();

      if (updateLogError) throw updateLogError;
      logRow = updatedLog;
    }
  }

  if (!logRow?.id) {
    const { data: insertedLog, error: logError } = await supabase.from("webhook_logs").insert({
      razorpay_event_id: resolvedEventId,
      event_type: eventType,
      payload,
      event_version: String(payload?.version || "v1"),
      lineage_key: razorpayOrderIdFromPayload(payload) || resolvedEventId,
    }).select("id").maybeSingle();
    if (logError) {
      if (logError.code === "23505") {
        return { received: true, duplicate: true, event: eventType };
      }
      throw logError;
    }
    logRow = insertedLog;
  }

  const { data: queuedLog, error: queuedLogError } = await supabase
    .from("webhook_logs")
    .select("*")
    .eq("id", logRow.id)
    .single();
  if (queuedLogError) throw queuedLogError;

  if (isQueueEnabled()) {
    const queued = await enqueueMarketplaceJob({
      queueName: QUEUE_NAMES.webhooks,
      name: eventType,
      data: queuedLog,
      jobId: resolvedEventId || `webhook-log-${logRow.id}`,
    });
    await supabase
      .from("webhook_logs")
      .update({ queued_at: new Date().toISOString() })
      .eq("id", logRow.id);
    return { received: true, queued: queued.queued, event: eventType };
  }

  if (isWebhookQueueRequired()) {
    const error = new Error("Webhook queue is required but Redis/BullMQ is unavailable");
    error.statusCode = 503;
    throw error;
  }

  try {
    await processMarketplaceWebhookPayload(payload);

    if (logRow?.id) {
      await supabase
        .from("webhook_logs")
        .update({ processed: true, processing_error: null, processed_at: new Date().toISOString() })
        .eq("id", logRow.id);
    }
  } catch (err) {
    if (logRow?.id) {
      const attempts = webhookAttempts + 1;
      const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await supabase
        .from("webhook_logs")
        .update({
          processed: false,
          processing_error: err.message || "Webhook processing failed",
          attempts,
          next_retry_at: attempts >= 5 ? null : nextRetryAt,
          dead_letter: attempts >= 5,
        })
        .eq("id", logRow.id);
    }
    throw err;
  }

  return { received: true, event: eventType };
};

const razorpayOrderIdFromPayload = (payload = {}) =>
  payload?.payload?.payment?.entity?.order_id ||
  payload?.payload?.order?.entity?.id ||
  payload?.payload?.transfer?.entity?.source ||
  null;

export const getMarketplaceAdminDashboard = async () => {
  const [dairiesRes, ordersRes, paymentsRes, logsRes, mismatchRes, fraudRes] = await Promise.all([
    supabase.from("dairies").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("webhook_logs").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("reconciliation_mismatches").select("*").eq("status", "OPEN").order("created_at", { ascending: false }).limit(50),
    supabase.from("fraud_alerts").select("*").neq("status", "CLOSED").order("created_at", { ascending: false }).limit(50),
  ]);

  if (dairiesRes.error) throw dairiesRes.error;
  if (ordersRes.error) throw ordersRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  if (logsRes.error) throw logsRes.error;
  if (mismatchRes.error && mismatchRes.error.code !== "42P01") throw mismatchRes.error;
  if (fraudRes.error && fraudRes.error.code !== "42P01") throw fraudRes.error;

  return {
    dairies: dairiesRes.data || [],
    orders: ordersRes.data || [],
    payments: paymentsRes.data || [],
    webhookLogs: logsRes.data || [],
    reconciliationMismatches: mismatchRes.data || [],
    fraudAlerts: fraudRes.data || [],
  };
};

export const getMarketplaceDairyDashboard = async (dairyId) => {
  const dairy = await getDairyById(dairyId);
  const [ordersRes, paymentsRes] = await Promise.all([
    supabase.from("orders").select("*").eq("dairy_id", dairy.id).order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("dairy_id", dairy.id).order("created_at", { ascending: false }),
  ]);

  if (ordersRes.error) throw ordersRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  return {
    dairy,
    orders: ordersRes.data || [],
    payments: paymentsRes.data || [],
  };
};
