import {
  getAdminCustomers,
  getCustomerBillDetails,
  getCustomerDetails,
  updateCustomerById,
  deleteCustomerById,
  approveCustomerSubscriptionById,
  assignPermanentDeliveryPartnerByCustomerId,
  upsertAdminCustomerSubscriptionById,
  pauseCustomerSubscriptionById,
  resumeCustomerSubscriptionById,
  cancelCustomerSubscriptionById,
} from "../../services/admin/adminCustomers.service.js";
import { getCustomerInvoiceDetail } from "../../services/customer/invoice.service.js";
import { generateInvoicePdfBuffer, getBillPdfFilename } from "../../services/customer/pdfInvoice.service.js";

export const fetchAdminCustomers = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const search = req.query.search || "";
    const dairyId = req.admin?.dairyId ?? null;

    const result = await getAdminCustomers({ page, limit, search, dairyId });

    res.json(result);
  } catch (err) {
    console.error("ADMIN CUSTOMERS ERROR:", err.message);
    res.status(500).json({
      message: "Failed to fetch customers",
    });
  }
};

export const fetchAdminCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const dairyId = req.admin?.dairyId ?? null;
    const data = await getCustomerDetails(id, { dairyId });

    res.json(data);
  } catch (err) {
    console.error("ADMIN CUSTOMER DETAIL ERROR:", err.message);
    res.status(500).json({
      message: "Failed to load customer details",
    });
  }
};

export const fetchAdminCustomerBillDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const dairyId = req.admin?.dairyId ?? null;
    const data = await getCustomerBillDetails({ customerId: id, dairyId });
    res.json(data);
  } catch (err) {
    console.error("ADMIN CUSTOMER BILL DETAIL ERROR:", err.message);
    res.status(500).json({
      message: err?.message || "Failed to load customer bill details",
    });
  }
};

export const updateAdminCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const dairyId = req.admin?.dairyId ?? null;
    const updated = await updateCustomerById(id, req.body, { dairyId });
    res.json({ success: true, customer: updated });
  } catch (err) {
    console.error("ADMIN CUSTOMER UPDATE ERROR:", err.message);
    res.status(500).json({ message: "Failed to update customer" });
  }
};

export const deleteAdminCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const dairyId = req.admin?.dairyId ?? null;
    await deleteCustomerById(id, { dairyId });
    res.json({ success: true });
  } catch (err) {
    console.error("ADMIN CUSTOMER DELETE ERROR:", err.message);
    res.status(500).json({ message: "Failed to delete customer" });
  }
};

export const upsertAdminCustomerSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const dairyId = req.admin?.dairyId ?? null;

    if (!dairyId) {
      return res.status(403).json({
        message: "Admin is not linked to any dairy",
      });
    }

    const subscription = await upsertAdminCustomerSubscriptionById({
      customerId: id,
      dairyId,
      ...req.body,
    });

    res.json({ success: true, subscription });
  } catch (err) {
    console.error("ADMIN CUSTOMER SUBSCRIPTION ERROR:", err.message);
    res.status(500).json({
      message: err?.message || "Failed to save customer subscription",
    });
  }
};

export const approveAdminCustomerSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const dairyId = req.admin?.dairyId ?? null;
    if (!dairyId) {
      return res.status(403).json({ message: "Admin is not linked to any dairy" });
    }

    const subscription = await approveCustomerSubscriptionById({
      customerId: id,
      dairyId,
    });
    res.json({ success: true, subscription });
  } catch (err) {
    console.error("ADMIN CUSTOMER SUBSCRIPTION APPROVE ERROR:", err.message);
    res.status(500).json({
      message: err?.message || "Failed to approve customer subscription",
    });
  }
};

export const assignAdminCustomerPermanentPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const dairyId = req.admin?.dairyId ?? null;
    const { agentId } = req.body || {};
    if (!dairyId) {
      return res.status(403).json({ message: "Admin is not linked to any dairy" });
    }

    const subscription = await assignPermanentDeliveryPartnerByCustomerId({
      customerId: id,
      dairyId,
      agentId,
    });
    res.json({ success: true, subscription });
  } catch (err) {
    console.error("ADMIN CUSTOMER SUBSCRIPTION ASSIGN PARTNER ERROR:", err.message);
    res.status(500).json({
      message: err?.message || "Failed to assign permanent delivery partner",
    });
  }
};

export const pauseAdminCustomerSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const dairyId = req.admin?.dairyId ?? null;
    const { pausedFrom, pausedUntil } = req.body || {};
    if (!dairyId) {
      return res.status(403).json({ message: "Admin is not linked to any dairy" });
    }

    const subscription = await pauseCustomerSubscriptionById({
      customerId: id,
      dairyId,
      pausedFrom,
      pausedUntil,
    });
    res.json({ success: true, subscription });
  } catch (err) {
    console.error("ADMIN CUSTOMER SUBSCRIPTION PAUSE ERROR:", err.message);
    res.status(500).json({
      message: err?.message || "Failed to pause customer subscription",
    });
  }
};

export const resumeAdminCustomerSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const dairyId = req.admin?.dairyId ?? null;
    if (!dairyId) {
      return res.status(403).json({ message: "Admin is not linked to any dairy" });
    }

    const subscription = await resumeCustomerSubscriptionById({
      customerId: id,
      dairyId,
    });
    res.json({ success: true, subscription });
  } catch (err) {
    console.error("ADMIN CUSTOMER SUBSCRIPTION RESUME ERROR:", err.message);
    res.status(500).json({
      message: err?.message || "Failed to resume customer subscription",
    });
  }
};

export const cancelAdminCustomerSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const dairyId = req.admin?.dairyId ?? null;
    const { cancelReason } = req.body || {};
    if (!dairyId) {
      return res.status(403).json({ message: "Admin is not linked to any dairy" });
    }

    const subscription = await cancelCustomerSubscriptionById({
      customerId: id,
      dairyId,
      cancelReason,
    });
    res.json({ success: true, subscription });
  } catch (err) {
    console.error("ADMIN CUSTOMER SUBSCRIPTION CANCEL ERROR:", err.message);
    res.status(500).json({
      message: err?.message || "Failed to cancel customer subscription",
    });
  }
};

export const downloadAdminCustomerBillPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const dairyId = req.admin?.dairyId ?? null;
    const invoiceId = req.params.billId || req.query.billId || id;

    const invoice = await getCustomerInvoiceDetail({
      customerId: req.params.billId ? Number(id) : null,
      invoiceId: Number(invoiceId),
      dairyId,
    });

    const pdfBuffer = await generateInvoicePdfBuffer(invoice);
    const filename = getBillPdfFilename(invoice);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("ADMIN PDF GENERATION ERROR:", err.message);
    res.status(err.statusCode || 500).json({
      message: "Unable to generate the bill right now. Please try again.",
    });
  }
};
