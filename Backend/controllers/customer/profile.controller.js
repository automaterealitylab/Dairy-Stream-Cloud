import {
  findCustomerById,
  updateCustomer,
} from "../../models/customer.db.js";

/**
 * GET CUSTOMER PROFILE
 * GET /api/customer/profile
 */
export const getProfile = async (req, res) => {
  console.log("🧪 AUTH CUSTOMER OBJECT:", req.customer);

  try {
    if (!req.customer || !req.customer.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const customerId = req.customer.id; // ✅ MISSING LINE (FIX)

    const { data, error } = await findCustomerById(customerId);

    if (error || !data) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Never send password back
    delete data.password;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 * UPDATE CUSTOMER PROFILE
 * PUT /api/customer/profile
 */
export const updateProfile = async (req, res) => {
  try {
    const customerId = req.customer.id;

    // Prevent password update here
    if (req.body.password) {
      return res.status(400).json({
        message: "Password cannot be updated from profile",
      });
    }

    const { data, error } = await updateCustomer(customerId, req.body);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    delete data.password;

    res.json({
      message: "Profile updated successfully",
      data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
