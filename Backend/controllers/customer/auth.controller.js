import {
  registerCustomerService,
  loginCustomerService,
} from "../../services/customer/auth.service.js";

export const registerCustomer = async (req, res) => {
  try {
    const customer = await registerCustomerService(req.body);

    res.status(201).json({
      message: "Customer registered successfully",
      customer: {
        id: customer.id,
        email: customer.email,
        customer_name: customer.customer_name,
      },
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const loginCustomer = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { customer, token } = await loginCustomerService(email, password);

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
    res.status(401).json({ message: err.message });
  }
};
