import { z } from "zod";

/* ---------- BASIC VALIDATORS ---------- */

const phoneRegex = /^[6-9]\d{9}$/;
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const upiRegex = /^[\w.-]+@[\w]+$/;
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

  bank_account_holder_name: z.string().min(2),
  bank_account_number: z.string().min(6),
  bank_ifsc_code: z.string().regex(ifscRegex,"Invalid IFSC"),

  bank_name: z.string().optional(),
  bank_branch: z.string().optional(),

  upi_id: z.string().regex(upiRegex,"Invalid UPI ID").optional().or(z.literal("")),
  razorpay_linked_account_id: z.string().optional().or(z.literal("")),

  one_time_payment_method: z.enum(["DIRECT_UPI", "RAZORPAY"], {
    message: "Select payment method for one-time orders"
  }),
  subscription_payment_method: z.enum(["DIRECT_UPI", "RAZORPAY"], {
    message: "Select payment method for monthly subscription"
  })
}).superRefine((data, ctx) => {
  const acceptsDirectUpi =
    data.one_time_payment_method === "DIRECT_UPI" ||
    data.subscription_payment_method === "DIRECT_UPI";
  const acceptsRazorpay =
    data.one_time_payment_method === "RAZORPAY" ||
    data.subscription_payment_method === "RAZORPAY";

  if (acceptsDirectUpi && !data.upi_id) {
    ctx.addIssue({
      code: "custom",
      path: ["upi_id"],
      message: "UPI ID is required when Direct UPI QR is enabled"
    });
  }

  if (acceptsRazorpay && !String(data.razorpay_linked_account_id || "").trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["razorpay_linked_account_id"],
      message: "Razorpay linked account id is required when Razorpay is enabled"
    });
  }
});

/* ---------- STEP 4 : PRODUCTS ---------- */

export const productSchema = z.object({
  products: z.record(z.any()).refine(
    (val) => Object.keys(val).length > 0,
    "Add at least one product"
  )
});
