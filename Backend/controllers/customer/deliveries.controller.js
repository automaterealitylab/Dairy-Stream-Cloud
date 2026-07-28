import {
  cancelPendingOneTimeDeliveryOrder,
  createOneTimeDeliveryOrder,
  getCustomerDeliveries,
  reportCustomerDeliveryIssue,
} from "../../services/customer/deliveries.service.js";
import cloudinary from "../../config/cloudinary.js";
import streamifier from "streamifier";

const uploadFromBuffer = (fileBuffer) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "one-time-order-proof", resource_type: "image" },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });

export const getDeliveries = async (req, res) => {
  try {
    const payload = await getCustomerDeliveries(req.customer.id);
    res.json(payload);
  } catch (err) {
    console.error("CUSTOMER DELIVERIES ERROR:", err.message);
    res.status(500).json({
      message: err?.message || "Failed to load deliveries",
    });
  }
};

export const createOneTimeOrder = async (req, res) => {
  try {
    let screenshotUrl = null;
    if (req.file) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Upload a JPG, PNG, or WebP screenshot" });
      }

      const uploaded = await uploadFromBuffer(req.file.buffer);
      screenshotUrl = uploaded.secure_url;
    }

    const payload = await createOneTimeDeliveryOrder(req.customer.id, {
      ...(req.body || {}),
      screenshotUrl,
    });
    res.status(201).json(payload);
  } catch (err) {
    const message = err?.message || "Failed to place one-time order";
    const isValidationError = /required|must|cannot|not found|already exists|past date|slot|address|subscription|stock|available|utr|verification/i.test(
      message
    );
    const status = isValidationError ? 400 : 500;
    res.status(status).json({ message });
  }
};

export const cancelOneTimeOrder = async (req, res) => {
  try {
    const payload = await cancelPendingOneTimeDeliveryOrder(req.customer.id, req.body || {});
    res.json(payload);
  } catch (err) {
    const message = err?.message || "Failed to cancel one-time order";
    const isValidationError = /required|not found|only|already/i.test(message);
    const status = isValidationError ? 400 : 500;
    res.status(status).json({ message });
  }
};

export const reportIssue = async (req, res) => {
  try {
    const payload = await reportCustomerDeliveryIssue(req.customer.id, {
      deliveryId: req.params?.id,
      issue: req.body?.issue,
    });
    res.json(payload);
  } catch (err) {
    const message = err?.message || "Failed to report issue";
    const isValidationError = /required|must|not found|characters/i.test(message);
    const status = isValidationError ? 400 : 500;
    res.status(status).json({ message });
  }
};

