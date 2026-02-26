import {
  getAdminCustomers,
  getCustomerDetails,
  updateCustomerById,
  deleteCustomerById,
  upsertAdminCustomerSubscriptionById,
} from "../../services/admin/adminCustomers.service.js";

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

    const data = await getCustomerDetails(id);

    res.json(data);
  } catch (err) {
    console.error("ADMIN CUSTOMER DETAIL ERROR:", err.message);
    res.status(500).json({
      message: "Failed to load customer details",
    });
  }
};

export const updateAdminCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateCustomerById(id, req.body);
    res.json({ success: true, customer: updated });
  } catch (err) {
    console.error("ADMIN CUSTOMER UPDATE ERROR:", err.message);
    res.status(500).json({ message: "Failed to update customer" });
  }
};

export const deleteAdminCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteCustomerById(id);
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
