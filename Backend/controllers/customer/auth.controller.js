import {
  registerCustomerService,
  loginCustomerService,
} from "../../services/customer/auth.service.js";
console.log("🔥 AUTH CONTROLLER LOADED");

export const registerCustomer = async (req, res) => {
  console.log("📥 REGISTER REQUEST RECEIVED");

  try {
    const customer = await registerCustomerService(req.body);

    console.log("✅ REGISTER SUCCESS:", customer.id);

    res.status(201).json({
      message: "Customer registered successfully",
      customer: {
        id: customer.id,
        email: customer.email,
        customer_name: customer.customer_name,
      },
    });
  } catch (err) {
    console.error("❌ REGISTER ERROR:", err.message);
    res.status(400).json({ message: err.message });
  }
};


export const loginCustomer = async (req, res) => {
  console.log("📥 LOGIN REQUEST RECEIVED");

  try {
    const { email, password } = req.body;

    const { customer, token } = await loginCustomerService(email, password);

    console.log("✅ LOGIN SUCCESS:", customer.id);

    res.json({
      message: "Login successful",
      token,
      customer: {
        id: customer.id,
        email: customer.email,
        customer_name: customer.customer_name,
      },
    });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err.message);
    res.status(401).json({ message: err.message });
  }
};

