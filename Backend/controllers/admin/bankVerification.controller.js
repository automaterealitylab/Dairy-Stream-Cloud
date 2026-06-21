import {
  lookupIfscDetails,
  verifyBankAccount,
} from "../../services/admin/bankVerification.service.js";

export const lookupAdminBankIfsc = async (req, res) => {
  try {
    const ifsc = req.params.ifsc || req.query.ifsc;
    const data = await lookupIfscDetails({
      ifsc,
      adminId: req.admin?.id,
      dairyId: req.admin?.dairyId,
    });

    res.json({ success: true, ifsc: data });
  } catch (err) {
    res.status(err.statusCode || 400).json({
      success: false,
      error: err.message || "Failed to lookup IFSC",
    });
  }
};

export const verifyAdminBankAccount = async (req, res) => {
  try {
    const result = await verifyBankAccount({
      adminId: req.admin?.id,
      dairyId: req.admin?.dairyId,
      accountHolderName: req.body?.accountHolderName,
      accountNumber: req.body?.accountNumber,
      ifsc: req.body?.ifsc,
      ownerName: req.body?.ownerName,
      pan: req.body?.pan,
    });

    res.json({ success: true, verification: result });
  } catch (err) {
    res.status(err.statusCode || 400).json({
      success: false,
      error: err.message || "Failed to verify bank account",
    });
  }
};
