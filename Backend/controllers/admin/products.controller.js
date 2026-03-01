import {
  createAdminProduct,
  deleteAdminProduct,
  getAdminProducts,
  updateAdminProduct,
} from "../../services/admin/products.service.js";

const isValidationMessage = (message = "") =>
  /required|must|valid|already exists|not found|greater than|zero/i.test(message);

export const fetchAdminProducts = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId;
    const search = String(req.query.search || "");
    const includeInactive = String(req.query.includeInactive || "true")
      .trim()
      .toLowerCase() !== "false";

    const payload = await getAdminProducts({
      dairyId,
      search,
      includeInactive,
    });

    res.json(payload);
  } catch (err) {
    const message = err?.message || "Failed to fetch products";
    const status = isValidationMessage(message) ? 400 : 500;
    res.status(status).json({ message });
  }
};

export const addAdminProduct = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId;
    const product = await createAdminProduct({
      dairyId,
      payload: req.body || {},
    });

    res.status(201).json({ product });
  } catch (err) {
    const message = err?.message || "Failed to add product";
    const status = isValidationMessage(message) ? 400 : 500;
    res.status(status).json({ message });
  }
};

export const editAdminProduct = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId;
    const { id } = req.params;

    const product = await updateAdminProduct({
      dairyId,
      productId: id,
      payload: req.body || {},
    });

    res.json({ product });
  } catch (err) {
    const message = err?.message || "Failed to update product";
    const status = isValidationMessage(message) ? 400 : 500;
    res.status(status).json({ message });
  }
};

export const removeAdminProduct = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId;
    const { id } = req.params;

    const payload = await deleteAdminProduct({
      dairyId,
      productId: id,
    });

    res.json(payload);
  } catch (err) {
    const message = err?.message || "Failed to delete product";
    const status = isValidationMessage(message) ? 400 : 500;
    res.status(status).json({ message });
  }
};
