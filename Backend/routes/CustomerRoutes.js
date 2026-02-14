import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase.js";
import { ensureIdentityIsUnique } from "../services/authentication/identityUniqueness.service.js";

const router = express.Router();
const normalizeEmail = (value) => (value || "").trim().toLowerCase();

// ==================================================
// REGISTER NEW CUSTOMER
// POST /api/customer/addCustomer
// ==================================================
router.post("/addCustomer", async (req, res) => {
  try {
    const {
      customerName,
       email,
      phoneNumber,
      buildingName,
      wing,
      roomNo,
      password,
      defaultMilkQuantityLiters,
      billingCycle,
    } = req.body;

    // 🔎 Basic validation
    if (!customerName || !phoneNumber || !roomNo) {
      return res.status(400).json({
        message: "customerName, phoneNumber and roomNo are required",
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        message: "email and password are required",
      });
    }

    await ensureIdentityIsUnique({
      email,
      phone: phoneNumber,
    });

    // 🔐 Hash password if provided
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // 📦 Insert into Supabase
    const { data, error } = await supabase
      .from("customers")
      .insert([
        {
          customer_name: customerName,
          email: normalizeEmail(email),
          phone_number: phoneNumber,
          building_name: buildingName || null,
          wing: wing || null,
          room_no: roomNo,
          password: hashedPassword,
          default_milk_quantity_liters: defaultMilkQuantityLiters || 1,
          billing_cycle: billingCycle || "Monthly",
        },
      ])
      .select();

    if (error) {
      console.error("❌ Supabase insert error:", error);
      if (error.code === "23505" && error.constraint === "customers_email_key") {
        return res.status(409).json({ message: "Email is already used by an existing customer account" });
      }
      return res.status(400).json({ message: error.message });
    }

    res.status(201).json({
      message: "✅ Customer registered successfully",
      customer: data[0],
    });
  } catch (err) {
    console.error("❌ Register Error:", err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: statusCode === 409 ? err.message : "Internal Server Error",
      error: err.message,
    });
  }
});

// ==================================================
// LOGIN (EMAIL OR PHONE)
// POST /api/customer/login
// ==================================================
router.post("/login", async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    console.log("🟡 Login request for:", emailOrPhone);

    const filter = `email.eq.${emailOrPhone},phone_number.eq.${emailOrPhone}`;
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .or(filter)
      .limit(1);

    if (error) {
      console.error("Supabase select error:", error);
      return res.status(500).json({ message: "Server error" });
    }

    const existingCustomer = data?.[0];
    if (!existingCustomer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (!existingCustomer.password) {
      return res
        .status(400)
        .json({ message: "Password not set for this account" });
    }

    const isMatch = await bcrypt.compare(password, existingCustomer.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "JWT_SECRET missing in .env",
      });
    }

    const token = jwt.sign(
      { id: existingCustomer.id, email: existingCustomer.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      customer: {
        id: existingCustomer.id,
        name: existingCustomer.customer_name,
        email: existingCustomer.email,
        phone: existingCustomer.phone_number,
      },
    });
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

export default router;
