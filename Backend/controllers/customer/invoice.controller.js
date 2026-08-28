import {
  getCustomerInvoiceDetail,
  getCustomerInvoiceHistory,
} from "../../services/customer/invoice.service.js";
import { generateInvoicePdfBuffer, getBillPdfFilename } from "../../services/customer/pdfInvoice.service.js";
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

    const pdfBuffer = await generateInvoicePdfBuffer(invoice);
    const filename = getBillPdfFilename(invoice);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF GENERATION ERROR:", err);
    res.status(err.statusCode || 500).json({ message: "Unable to generate the bill right now. Please try again." });
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
