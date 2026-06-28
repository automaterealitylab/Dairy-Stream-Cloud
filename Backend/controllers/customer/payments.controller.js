import {
  createCustomerUpiPaymentIntent,
  getCustomerPaymentsData,
  submitCustomerUpiPaymentVerification,
  createCustomerPaymentOrder,
  verifyCustomerPayment,
  createCustomerWalletTopupOrder,
  verifyCustomerWalletTopup,
} from "../../services/customer/payments.service.js";
import { getScreenshotHash } from "../../services/customer/smartPaymentVerification.service.js";
import { runPaymentScreenshotOcr } from "../../services/customer/ocr.service.js";
import cloudinary from "../../config/cloudinary.js";
import streamifier from "streamifier";

const uploadFromBuffer = (fileBuffer) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "payment-verifications", resource_type: "image" },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });

export const getPayments = async (req, res) => {
  try {
    const data = await getCustomerPaymentsData(
      req.customer.id,
      req.customer?.dairyId ?? null
    );
    res.json(data);
  } catch (err) {
    console.error("CUSTOMER PAYMENTS ERROR:", err.message);
    res.status(500).json({
      message: "Failed to load payments",
      error: err.message,
    });
  }
};

export const createPaymentOrder = async (req, res) => {
  try {
    const { paymentId, payAll, includeRunningDue } = req.body || {};
    const data = await createCustomerPaymentOrder({
      customerId: req.customer.id,
      paymentId,
      payAll: Boolean(payAll),
      includeRunningDue: includeRunningDue === undefined ? true : Boolean(includeRunningDue),
      dairyId: req.customer?.dairyId ?? null,
    });
    res.json(data);
  } catch (err) {
    console.error("CREATE PAYMENT ORDER ERROR:", err.message);
    res.status(err.statusCode || 400).json({
      message: err.message || "Failed to create payment order",
    });
  }
};

export const createUpiPaymentIntent = async (req, res) => {
  try {
    const { paymentId, payAll, includeRunningDue, isWalletTopup, amount } = req.body || {};
    const data = await createCustomerUpiPaymentIntent({
      customerId: req.customer.id,
      paymentId,
      payAll: Boolean(payAll),
      includeRunningDue: includeRunningDue === undefined ? true : Boolean(includeRunningDue),
      dairyId: req.customer?.dairyId ?? null,
      isWalletTopup: String(isWalletTopup || "false") === "true" || isWalletTopup === true,
      amount: Number(amount || 0),
    });
    res.json(data);
  } catch (err) {
    console.error("CREATE UPI PAYMENT INTENT ERROR:", err.message);
    res.status(err.statusCode || 400).json({
      message: err.message || "Failed to create UPI payment intent",
    });
  }
};

export const submitUpiPaymentVerification = async (req, res) => {
  try {
    let screenshotUrl = null;
    let screenshotHash = null;
    let originalFilename = "";
    let ocrResult = null;
    if (req.file) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Upload a JPG, PNG, or WebP screenshot" });
      }
      screenshotHash = getScreenshotHash(req.file.buffer);
      originalFilename = req.file.originalname || "";
      ocrResult = await runPaymentScreenshotOcr({
        imageBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
        dairyId: req.customer?.dairyId ?? null,
        customerId: req.customer.id,
        screenshotHash,
      });
      const uploaded = await uploadFromBuffer(req.file.buffer);
      screenshotUrl = uploaded.secure_url;
    }

    const data = await submitCustomerUpiPaymentVerification({
      customerId: req.customer.id,
      paymentId: req.body?.paymentId || null,
      payAll: String(req.body?.payAll || "false") === "true" || req.body?.payAll === true,
      includeRunningDue:
        req.body?.includeRunningDue === undefined
          ? true
          : String(req.body.includeRunningDue) === "true" || req.body.includeRunningDue === true,
      isWalletTopup: String(req.body?.isWalletTopup || "false") === "true" || req.body?.isWalletTopup === true,
      dairyId: req.customer?.dairyId ?? null,
      amount: req.body?.amount,
      utrNumber: req.body?.utrNumber,
      payerUpiId: req.body?.payerUpiId,
      screenshotUrl,
      screenshotHash,
      originalFilename,
      ocrResult,
    });

    res.json(data);
  } catch (err) {
    console.error("SUBMIT UPI VERIFICATION ERROR:", err.message);
    res.status(err.statusCode || 400).json({
      message: err.message || "Failed to submit payment verification",
    });
  }
};

export const previewUpiPaymentScreenshotOcr = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Upload a payment screenshot" });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Upload a JPG, PNG, or WebP screenshot" });
    }

    const screenshotHash = getScreenshotHash(req.file.buffer);
    const ocr = await runPaymentScreenshotOcr({
      imageBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      dairyId: req.customer?.dairyId ?? null,
      customerId: req.customer.id,
      screenshotHash,
    });

    res.json({
      success: true,
      screenshotHash,
      ocr,
      extracted: ocr.extracted || {},
    });
  } catch (err) {
    console.error("PREVIEW UPI OCR ERROR:", err.message);
    res.status(err.statusCode || 400).json({
      message: err.message || "Failed to run OCR on screenshot",
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { paymentId, payAll, includeRunningDue, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
    const data = await verifyCustomerPayment({
      customerId: req.customer.id,
      paymentId,
      payAll: Boolean(payAll),
      includeRunningDue: includeRunningDue === undefined ? true : Boolean(includeRunningDue),
      dairyId: req.customer?.dairyId ?? null,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    res.json(data);
  } catch (err) {
    console.error("VERIFY PAYMENT ERROR:", err.message);
    res.status(400).json({
      message: err.message || "Payment verification failed",
    });
  }
};

export const createWalletTopupOrder = async (req, res) => {
  try {
    const { amount } = req.body || {};
    const data = await createCustomerWalletTopupOrder({
      customerId: req.customer.id,
      dairyId: req.customer?.dairyId ?? null,
      amount,
    });
    res.json(data);
  } catch (err) {
    console.error("CREATE WALLET TOPUP ORDER ERROR:", err.message);
    res.status(err.statusCode || 400).json({
      message: err.message || "Failed to create wallet top-up order",
    });
  }
};

export const verifyWalletTopup = async (req, res) => {
  try {
    const { amount, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
    const data = await verifyCustomerWalletTopup({
      customerId: req.customer.id,
      dairyId: req.customer?.dairyId ?? null,
      amount,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    res.json(data);
  } catch (err) {
    console.error("VERIFY WALLET TOPUP ERROR:", err.message);
    res.status(400).json({
      message: err.message || "Wallet top-up verification failed",
    });
  }
};
