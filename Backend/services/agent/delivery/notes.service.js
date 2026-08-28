// Read/write helpers for the delivery `notes` field: proof, failure reason and
// payment-collection markers, plus order-payment meta parsing.

export const parseNotesField = (notes, field) => {
  const match = String(notes || "").match(new RegExp(`${field}=([^;\\n]+)`, "i"));
  return match?.[1]?.trim() || null;
};

export const getDeliveryTypeFromNotes = (notes) => {
  const text = String(notes || "");
  if (text.includes("[ONE_TIME_ORDER]")) {
    return "BUY ONCE";
  }
  if (text.includes("[SUBSCRIPTION_DAILY]")) {
    return "SUBSCRIPTION";
  }
  return "REGULAR";
};

export const parseOrderPaymentMeta = (notes, quantityLiters) => {
  const paymentMethod = String(parseNotesField(notes, "payment") || "").trim().toUpperCase() || null;
  const unitPrice = Number(parseNotesField(notes, "unit_price"));
  const quantity = Number(quantityLiters || 0);
  const amountDue =
    Number.isFinite(unitPrice) && unitPrice >= 0 && Number.isFinite(quantity) && quantity > 0
      ? Number((unitPrice * quantity).toFixed(2))
      : 0;

  return {
    paymentMethod,
    unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
    amountDue,
  };
};

export const parseFailedReason = (notes) => {
  const text = String(notes || "");
  const marker = "[FAILED_REASON]:";
  const index = text.indexOf(marker);
  if (index < 0) return null;
  const reason = text.slice(index + marker.length).trim();
  return reason || null;
};

export const parseDeliveryProof = (notes) => {
  const text = String(notes || "");
  const marker = "[DELIVERY_PROOF]:";
  const index = text.indexOf(marker);
  if (index < 0) return { proofType: null, proofValue: null };
  const raw = text.slice(index + marker.length).trim();
  if (!raw) return { proofType: null, proofValue: null };

  const [typePart, valuePart] = raw.split("|", 2);
  return {
    proofType: String(typePart || "").trim() || null,
    proofValue: String(valuePart || "").trim() || null,
  };
};

export const parsePaymentCollection = (notes) => {
  const text = String(notes || "");
  const marker = "[PAYMENT_COLLECTION]:";
  const index = text.indexOf(marker);
  if (index < 0) return { collectionMethod: null, paymentStatus: null };

  const raw = text.slice(index + marker.length).trim();
  const [methodPart, statusPart] = raw.split("|", 2);
  return {
    collectionMethod: String(methodPart || "").trim().toUpperCase() || null,
    paymentStatus: String(statusPart || "").trim().toUpperCase() || null,
  };
};

export const withDeliveryProof = (notes, proofType, proofValue = "") => {
  const safeType = String(proofType || "").trim().toUpperCase();
  const safeValue = String(proofValue || "").trim();
  const current = String(notes || "").trim();

  const lines = current
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("[DELIVERY_PROOF]:"));

  if (!safeType) {
    return lines.length ? lines.join("\n") : null;
  }

  lines.push(`[DELIVERY_PROOF]: ${safeType}${safeValue ? `|${safeValue}` : ""}`);
  return lines.join("\n");
};

export const withFailureReason = (notes, reason) => {
  const safeReason = String(reason || "").trim();
  const current = String(notes || "").trim();
  const lines = current
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("[FAILED_REASON]:"));

  if (!safeReason) return lines.length ? lines.join("\n") : null;
  lines.push(`[FAILED_REASON]: ${safeReason}`);
  return lines.join("\n");
};

export const withPaymentCollection = (notes, collectionMethod = "", paymentStatus = "") => {
  const current = String(notes || "").trim();
  const lines = current
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("[PAYMENT_COLLECTION]:"));

  const safeMethod = String(collectionMethod || "").trim().toUpperCase();
  const safeStatus = String(paymentStatus || "").trim().toUpperCase();
  if (!safeMethod && !safeStatus) {
    return lines.length ? lines.join("\n") : null;
  }

  lines.push(`[PAYMENT_COLLECTION]: ${safeMethod}${safeStatus ? `|${safeStatus}` : ""}`);
  return lines.join("\n");
};
