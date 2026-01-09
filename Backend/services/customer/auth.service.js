import bcrypt from "bcryptjs";
import { createCustomer, findCustomerByEmail } from "../../models/customer.db.js";
import { generateToken } from "../../utils/jwt.js";

export const registerCustomerService = async (payload) => {
  const {
    email,
    password,
    customer_name,
    phone_number,
    building_name,
    wing,
    room_no,
  } = payload;

  const { data: existing } = await findCustomerByEmail(email);
  if (existing) {
    throw new Error("Customer already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { data, error } = await createCustomer({
    email,
    password: hashedPassword,
    customer_name,
    phone_number,
    building_name,
    wing,
    room_no,
  });

  if (error) throw new Error(error.message);

  return data;
};

export const loginCustomerService = async (email, password) => {
  const { data: customer } = await findCustomerByEmail(email);
  if (!customer) {
    throw new Error("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, customer.password);
  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  const token = generateToken(customer);

  return { customer, token };
};
