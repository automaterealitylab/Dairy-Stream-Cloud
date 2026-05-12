import { getDairyAccountingReport } from "../../services/admin/reports.service.js";

export const fetchDairyAccountingReport = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId || req.query?.dairyId || null;
    if (!dairyId) {
      return res.status(400).json({ error: "Dairy context is required" });
    }

    const report = await getDairyAccountingReport({
      dairyId,
      from: req.query?.from,
      to: req.query?.to,
    });

    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to build accounting report" });
  }
};
