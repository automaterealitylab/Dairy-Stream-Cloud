import {
  getCustomerInvoiceDetail,
  getCustomerInvoiceHistory,
} from "../../services/customer/invoice.service.js";
import { generateInvoicePdfBuffer } from "../../services/customer/pdfInvoice.service.js";
import { enqueueWhatsAppNotification } from "../../services/shared/whatsapp.service.js";

export const fetchCustomerInvoices = async (req, res) => {
  try {
    const invoices = await getCustomerInvoiceHistory({
      customerId: req.customer.id,
      dairyId: req.customer?.dairyId ?? null,
      limit: Number(req.query?.limit || 24),
    });

    res.json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load invoices" });
  }
};

export const fetchCustomerInvoiceDetail = async (req, res) => {
  try {
    const invoice = await getCustomerInvoiceDetail({
      customerId: req.customer.id,
      dairyId: req.customer?.dairyId ?? null,
      invoiceId: Number(req.params.id),
    });

    res.json({ success: true, invoice });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || "Failed to load invoice" });
  }
};

export const downloadCustomerInvoicePdf = async (req, res) => {
  try {
    const invoice = await getCustomerInvoiceDetail({
      customerId: req.customer.id,
      dairyId: req.customer?.dairyId ?? null,
      invoiceId: Number(req.params.id),
    });

    const pdf = generateInvoicePdfBuffer(invoice);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${String(invoice.invoiceNumber || `invoice-${invoice.id}`).replace(/[^a-z0-9._-]/gi, "_")}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || "Failed to generate invoice PDF" });
  }
};

export const shareCustomerInvoiceOnWhatsApp = async (req, res) => {
  try {
    const invoice = await getCustomerInvoiceDetail({
      customerId: req.customer.id,
      dairyId: req.customer?.dairyId ?? null,
      invoiceId: Number(req.params.id),
    });

    const customer = invoice.customer || {};
    const event = await enqueueWhatsAppNotification({
      customerId: req.customer.id,
      dairyId: invoice.dairy_id,
      phone: req.body?.phone || customer.phone_number || customer.phone,
      templateKey: "INVOICE_SHARE",
      payload: {
        customerName: customer.customer_name || customer.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.total_amount,
        invoiceUrl: invoice.shareUrl,
      },
    });

    res.json({ success: true, notification: event });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || "Failed to queue invoice WhatsApp message" });
  }
};
