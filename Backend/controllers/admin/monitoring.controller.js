import { getOperationalMonitoring } from "../../services/admin/monitoring.service.js";
import { processQueuedWhatsAppNotifications } from "../../services/shared/whatsapp.service.js";

export const fetchOperationalMonitoring = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId || req.query?.dairyId || null;
    if (!dairyId) return res.status(400).json({ error: "Dairy context is required" });

    const data = await getOperationalMonitoring({ dairyId });
    res.json({ success: true, monitoring: data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load operational monitoring" });
  }
};

export const processWhatsAppQueue = async (req, res) => {
  try {
    const result = await processQueuedWhatsAppNotifications({
      limit: Number(req.body?.limit || 25),
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to process WhatsApp queue" });
  }
};
