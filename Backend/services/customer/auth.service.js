import bcrypt from "bcryptjs";
import { createCustomer, findCustomerByEmail } from "../../models/customer.db.js";
import { generateToken } from "../../utils/jwt.js";
import { ensureIdentityIsUnique } from "../authentication/identityUniqueness.service.js";

import { createEmailVerificationToken } from "./email.service.js";


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

  await ensureIdentityIsUnique({
    email,
    phone: phone_number,
  });

  const hashedPassword = await bcrypt.hash(password, 10);

  const { data: customer, error } = await createCustomer({
    email,
    password: hashedPassword,
    customer_name,
    phone_number,
    building_name,
    wing,
    room_no,
    is_active: false,
  });

  if (error) throw new Error(error.message);

 console.log("🧪 ABOUT TO CREATE EMAIL TOKEN FOR:", customer.id);

await createEmailVerificationToken(customer);

console.log("🧪 EMAIL TOKEN FUNCTION COMPLETED");


  return customer;
};


export const loginCustomerService = async (email, password) => {
  const { data: customer } = await findCustomerByEmail(email);
  if (!customer) {
    throw new Error("Invalid credentials");
  }
  console.log("LOGIN CHECK is_active =", customer?.is_active);


  if (!customer.is_active) {
    throw new Error("Please verify your email before logging in");
  }

  const isMatch = await bcrypt.compare(password, customer.password);
  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  const token = generateToken(customer);

  return { customer, token };
};
