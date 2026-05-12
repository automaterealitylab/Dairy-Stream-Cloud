import crypto from "crypto";
import { supabase } from "../../config/supabase.js";

const isMissingTableOrColumn = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("column") && message.includes("does not exist"))
  );
};

const normalizeUtr = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

const toMoney = (value) => {
  const next = Number(value);
  return Number.isFinite(next) ? Number(next.toFixed(2)) : 0;
};

export const getScreenshotHash = (fileBuffer) => {
  if (!fileBuffer) return null;
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
};

const extractLikelyUtrFromText = (value) => {
  const text = String(value || "").toUpperCase();
  const labelled = text.match(/(?:UTR|UPI\s*REF|REFERENCE|REF(?:ERENCE)?\s*NO)[^A-Z0-9]{0,12}([A-Z0-9]{8,30})/i);
  if (labelled?.[1]) return normalizeUtr(labelled[1]);

  const generic = text.match(/\b[A-Z0-9]{12,30}\b/);
  return generic?.[0] ? normalizeUtr(generic[0]) : null;
};

const findDuplicateScreenshot = async ({ dairyId, screenshotHash }) => {
  if (!screenshotHash) return null;

  const { data, error } = await supabase
    .from("payment_verifications")
    .select("id, status, customer_id, amount, utr_number")
    .eq("dairy_id", dairyId)
    .eq("screenshot_sha256", screenshotHash)
    .neq("status", "REJECTED")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableOrColumn(error)) return null;
    throw error;
  }

  return data || null;
};

const findDuplicateUtr = async ({ dairyId, utrNumber }) => {
  const normalizedUtr = normalizeUtr(utrNumber);
  if (!normalizedUtr) return null;

  const { data, error } = await supabase
    .from("payment_verifications")
    .select("id, status, customer_id, amount, screenshot_sha256")
    .eq("dairy_id", dairyId)
    .ilike("utr_number", normalizedUtr)
    .neq("status", "REJECTED")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableOrColumn(error)) return null;
    throw error;
  }

  return data || null;
};

const getRecentRejectedVerificationCount = async ({ dairyId, customerId }) => {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("payment_verifications")
    .select("id", { count: "exact", head: true })
    .eq("dairy_id", dairyId)
    .eq("customer_id", customerId)
    .eq("status", "REJECTED")
    .gte("submitted_at", sinceIso);

  if (error) {
    if (isMissingTableOrColumn(error)) return 0;
    throw error;
  }

  return count || 0;
};

export const analyzeUpiVerificationSubmission = async ({
  dairyId,
  customerId,
  expectedAmount,
  submittedAmount,
  utrNumber,
  payerUpiId,
  screenshotHash,
  originalFilename,
  ocrResult = null,
}) => {
  const normalizedUtr = normalizeUtr(utrNumber);
  const amountDelta = Math.abs(toMoney(submittedAmount) - toMoney(expectedAmount));
  const extractedUtr =
    normalizeUtr(ocrResult?.extracted?.utrNumber) ||
    extractLikelyUtrFromText(`${ocrResult?.text || ""} ${originalFilename || ""} ${normalizedUtr}`);
  const ocrAmount = toMoney(ocrResult?.extracted?.amount);
  const ocrAmountDelta = ocrAmount > 0 ? Math.abs(ocrAmount - toMoney(expectedAmount)) : 0;
  const [duplicateUtr, duplicateScreenshot] = await Promise.all([
    findDuplicateUtr({ dairyId, utrNumber: normalizedUtr }),
    findDuplicateScreenshot({ dairyId, screenshotHash }),
  ]);
  const recentRejectedCount = await getRecentRejectedVerificationCount({ dairyId, customerId });

  const flags = [];
  if (amountDelta > 1) flags.push("AMOUNT_MISMATCH");
  if (duplicateUtr?.id) flags.push("DUPLICATE_UTR");
  if (duplicateScreenshot?.id) flags.push("DUPLICATE_SCREENSHOT");
  if (!screenshotHash) flags.push("NO_SCREENSHOT");
  if (!payerUpiId) flags.push("PAYER_UPI_MISSING");
  if (extractedUtr && extractedUtr !== normalizedUtr) flags.push("UTR_TEXT_MISMATCH");
  if (ocrAmount > 0 && ocrAmountDelta > 1) flags.push("OCR_AMOUNT_MISMATCH");
  if (ocrResult?.status === "FAILED") flags.push("OCR_FAILED");
  if (ocrResult?.status === "NOT_CONFIGURED") flags.push("OCR_NOT_CONFIGURED");
  if (recentRejectedCount >= 3) flags.push("REPEATED_FAILED_ATTEMPTS");

  let confidenceScore = 95;
  const ocrConfidence = Number(ocrResult?.confidence || 0);
  if (amountDelta > 0 && amountDelta <= 1) confidenceScore -= 5;
  if (amountDelta > 1) confidenceScore -= 35;
  if (ocrAmountDelta > 1) confidenceScore -= 25;
  if (duplicateUtr?.id) confidenceScore -= 45;
  if (duplicateScreenshot?.id) confidenceScore -= 45;
  if (!screenshotHash) confidenceScore -= 20;
  if (!payerUpiId) confidenceScore -= 5;
  if (extractedUtr && extractedUtr !== normalizedUtr) confidenceScore -= 25;
  if (ocrResult?.status === "FAILED") confidenceScore -= 20;
  if (recentRejectedCount >= 3) confidenceScore -= 20;
  if (ocrConfidence > 0 && ocrConfidence < 60) confidenceScore -= 15;
  if (ocrConfidence >= 85 && extractedUtr === normalizedUtr && (!ocrAmount || ocrAmountDelta <= 1)) {
    confidenceScore += 5;
  }
  confidenceScore = Math.max(0, Math.min(100, confidenceScore));

  const severity =
    flags.includes("DUPLICATE_UTR") || flags.includes("DUPLICATE_SCREENSHOT")
      ? "HIGH"
      : flags.includes("AMOUNT_MISMATCH") ||
        flags.includes("OCR_AMOUNT_MISMATCH") ||
        flags.includes("UTR_TEXT_MISMATCH")
      ? "MEDIUM"
      : flags.length
      ? "LOW"
      : "NONE";

  return {
    confidenceScore,
    reviewRecommendation: confidenceScore >= 90 && !flags.length ? "AUTO_APPROVE_CANDIDATE" : "MANUAL_REVIEW",
    flags,
    severity,
    screenshotHash,
    ocr: {
      provider: ocrResult?.provider || process.env.PAYMENT_OCR_PROVIDER || "heuristic",
      status: ocrResult?.status || "COMPLETED",
      extractedUtr,
      extractedAmount: ocrAmount || toMoney(submittedAmount),
      extractedTimestamp: ocrResult?.extracted?.timestamp || null,
      payerName: ocrResult?.extracted?.payerName || null,
      appName: ocrResult?.extracted?.appName || null,
      confidence: ocrConfidence,
      extractedAt: new Date().toISOString(),
      note: ocrResult?.status === "COMPLETED"
        ? "OCR text extraction completed."
        : "OCR provider was unavailable or did not extract text; manual review remains available.",
    },
    duplicateCheck: {
      duplicateUtrId: duplicateUtr?.id || null,
      duplicateScreenshotId: duplicateScreenshot?.id || null,
      sameCustomerDuplicate:
        duplicateUtr?.customer_id === customerId || duplicateScreenshot?.customer_id === customerId,
      recentRejectedCount,
    },
  };
};

export const writeFraudAlertsForVerification = async ({
  verificationId,
  dairyId,
  customerId,
  paymentId,
  analysis,
}) => {
  if (!analysis?.flags?.length) return [];

  const alerts = analysis.flags
    .filter((flag) => flag !== "NO_SCREENSHOT" && flag !== "PAYER_UPI_MISSING")
    .map((flag) => ({
      payment_id: paymentId || null,
      dairy_id: dairyId,
      customer_id: customerId,
      alert_type: flag,
      severity: analysis.severity === "NONE" ? "LOW" : analysis.severity,
      status: "OPEN",
      signal: {
        verificationId,
        confidenceScore: analysis.confidenceScore,
        duplicateCheck: analysis.duplicateCheck,
        ocr: analysis.ocr,
      },
    }));

  if (!alerts.length) return [];

  const { data, error } = await supabase.from("fraud_alerts").insert(alerts).select("*");
  if (error) {
    if (isMissingTableOrColumn(error)) return [];
    throw error;
  }

  return data || [];
};
