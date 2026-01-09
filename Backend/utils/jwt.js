import jwt from "jsonwebtoken";

export const generateToken = (customer) => {
  return jwt.sign(
    {
      id: customer.id,
      email: customer.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};
