import { supabase } from "../../config/supabase.js";
import { logger, logError } from "../../utils/logger.js";
import { metrics } from "../../utils/metrics.js";

const isMissingTableOrColumn = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("column") && message.includes("does not exist"))
  );
};

const normalizeWhitespace = (value) => String(value || "").replace(/\s+/g, " ").trim();

export const extractPaymentFieldsFromOcrText = (textValue = "") => {
  const text = normalizeWhitespace(textValue);
  const upper = text.toUpperCase();

  const utr =
    upper.match(/(?:UTR|UPI\s*(?:REF|REFERENCE)|REFERENCE|REF(?:ERENCE)?\s*(?:NO|ID)?)[^A-Z0-9]{0,18}([A-Z0-9]{8,30})/)?.[1] ||
    upper.match(/\b(?:[0-9]{12}|[A-Z0-9]{14,30})\b/)?.[0] ||
    null;

  const amountMatch =
    text.match(/(?:₹|Rs\.?|INR)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i) ||
    text.match(/(?:amount|paid|sent)\D{0,12}([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);

  const timestamp =
    text.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}(?:[, ]+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?)\b/i)?.[1] ||
    text.match(/\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}(?:[, ]+\d{1,2}:\d{2}\s*(?:AM|PM)?)?)\b/i)?.[1] ||
    null;

  const payerName =
    text.match(/(?:paid by|from|payer|debited from)\s+([A-Za-z][A-Za-z .]{2,60}?)(?=\s+(?:amount|upi|utr|ref|reference|₹|rs\.?|inr)|$)/i)?.[1]?.trim() ||
    null;

  const appName = upper.includes("PHONEPE")
    ? "PhonePe"
    : upper.includes("GOOGLE PAY") || upper.includes("GPAY")
    ? "Google Pay"
    : upper.includes("PAYTM")
    ? "Paytm"
    : upper.includes("BHIM")
    ? "BHIM"
    : null;

  const amount = amountMatch?.[1] ? Number(String(amountMatch[1]).replace(/,/g, "")) : null;

  return {
    utrNumber: utr,
    amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : null,
    timestamp,
    payerName,
    appName,
  };
};

const getGoogleVisionConfidence = (annotation = {}) => {
  const confidences = [];
  for (const page of annotation?.fullTextAnnotation?.pages || []) {
    for (const block of page.blocks || []) {
      if (Number.isFinite(block.confidence)) confidences.push(block.confidence);
      for (const paragraph of block.paragraphs || []) {
        if (Number.isFinite(paragraph.confidence)) confidences.push(paragraph.confidence);
        for (const word of paragraph.words || []) {
          if (Number.isFinite(word.confidence)) confidences.push(word.confidence);
        }
      }
    }
  }

  if (!confidences.length) return 0;
  const average = confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
  return Math.round(Math.max(0, Math.min(1, average)) * 100);
};

const callGoogleVisionOcr = async ({ imageBuffer }) => {
  const apiKey = String(process.env.GOOGLE_VISION_API_KEY || "").trim();
  if (!apiKey) {
    return {
      provider: "google-vision",
      status: "NOT_CONFIGURED",
      text: "",
      confidence: 0,
      raw: null,
    };
  }

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBuffer.toString("base64") },
            features: [{ type: "TEXT_DETECTION", maxResults: 1 }],
          },
        ],
      }),
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Google Vision OCR failed");
    error.statusCode = response.status;
    throw error;
  }

  const annotation = payload?.responses?.[0] || {};
  const text = annotation.fullTextAnnotation?.text || annotation.textAnnotations?.[0]?.description || "";

  return {
    provider: "google-vision",
    status: text ? "COMPLETED" : "NO_TEXT",
    text,
    confidence: getGoogleVisionConfidence(annotation),
    raw: {
      textAnnotationsCount: annotation.textAnnotations?.length || 0,
      error: annotation.error || null,
    },
  };
};

export const runPaymentScreenshotOcr = async ({
  imageBuffer,
  mimeType,
  dairyId = null,
  customerId = null,
  paymentId = null,
  screenshotHash = null,
  attempt = 1,
}) => {
  const started = Date.now();
  let result;

  try {
    result = await callGoogleVisionOcr({ imageBuffer, mimeType });
    const extracted = extractPaymentFieldsFromOcrText(result.text);
    const finalResult = {
      ...result,
      extracted,
      durationMs: Date.now() - started,
      attemptedAt: new Date().toISOString(),
      attempt,
    };

    metrics.increment("payment_ocr_runs", { status: finalResult.status, provider: finalResult.provider });
    metrics.observe("payment_ocr_duration_ms", { provider: finalResult.provider }, finalResult.durationMs);
    await logOcrResult({ dairyId, customerId, paymentId, screenshotHash, result: finalResult });
    return finalResult;
  } catch (err) {
    const failedResult = {
      provider: "google-vision",
      status: "FAILED",
      text: "",
      confidence: 0,
      extracted: {},
      error: err.message,
      durationMs: Date.now() - started,
      attemptedAt: new Date().toISOString(),
      attempt,
    };
    metrics.increment("payment_ocr_runs", { status: "FAILED", provider: "google-vision" });
    logError("payment_ocr_failed", err, { dairyId, customerId, paymentId, screenshotHash });
    await logOcrResult({ dairyId, customerId, paymentId, screenshotHash, result: failedResult });
    return failedResult;
  }
};

const logOcrResult = async ({ dairyId, customerId, paymentId, screenshotHash, result }) => {
  const { error } = await supabase.from("ocr_processing_logs").insert({
    dairy_id: dairyId,
    customer_id: customerId,
    payment_id: paymentId,
    screenshot_sha256: screenshotHash,
    provider: result.provider,
    status: result.status,
    confidence_score: result.confidence,
    extracted_payload: result.extracted || {},
    raw_payload: {
      raw: result.raw || null,
      durationMs: result.durationMs,
      attempt: result.attempt,
      error: result.error || null,
    },
  });

  if (error && !isMissingTableOrColumn(error)) {
    logger.warn("ocr_log_write_failed", { error: error.message });
  }
};
