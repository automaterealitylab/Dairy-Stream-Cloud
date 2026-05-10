import { z } from "zod";

/* ---------- BASIC VALIDATORS ---------- */

const phoneRegex = /^[6-9]\d{9}$/;
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;
const pincodeRegex = /^[1-9][0-9]{5}$/;

/* ---------- STEP 1 : BRAND ---------- */

export const brandSchema = z.object({
  dairy_name: z.string().min(2, "Dairy name required"),
  dairy_phone: z.string().regex(phoneRegex, "Invalid phone number"),
  dairy_email: z.string().email("Invalid email"),
  gstin: z.string().regex(gstRegex, "Invalid GSTIN").optional().or(z.literal(""))
});

/* ---------- STEP 2 : LOCATION ---------- */

export const locationSchema = z.object({
  address: z.string().min(3, "Address required"),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(pincodeRegex, "Invalid pincode"),
  service_type: z.enum(["RADIUS","PINCODE"]),
  service_radius: z.string().optional(),
  service_pincodes: z.string().optional()
});

/* ---------- STEP 3 : OWNER / BANK ---------- */

export const ownerSchema = z.object({
  owner_name: z.string().min(2,"Owner name required"),
  admin_email: z.string().email("Invalid email"),
  password: z.string().min(6,"Password must be 6+ characters"),
  confirmPassword: z.string().min(6,"Confirm password")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

/* ---------- STEP 4 : PRODUCTS ---------- */

export const productSchema = z.object({
  products: z.record(z.any()).refine(
    (val) => Object.keys(val).length > 0,
    "Add at least one product"
  )
});
