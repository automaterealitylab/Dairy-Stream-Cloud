const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const CustomerController = require('../controller/CustomerController');
const { supabase } = require('../config');

// Register new customer
router.post("/addCustomer", CustomerController.addCustomer);

// Login (email or phone)
router.post("/login", async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    console.log("🟡 Login request for:", emailOrPhone);
    // Query Supabase for user by email or phone
    const filter = `email.eq.${emailOrPhone},phone_number.eq.${emailOrPhone}`;
    const { data, error } = await supabase.from('customers').select('*').or(filter).limit(1);

    if (error) {
      console.error('Supabase select error:', error);
      return res.status(500).json({ message: 'Server error' });
    }

    const existingCustomer = data && data.length ? data[0] : null;
    if (!existingCustomer) return res.status(404).json({ message: 'Customer not found' });

    if (!existingCustomer.password) return res.status(400).json({ message: 'Password not set for this account' });

    const isMatch = await bcrypt.compare(password, existingCustomer.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('❌ JWT_SECRET is not set in .env');
      return res.status(500).json({ message: 'Server misconfiguration: JWT secret missing' });
    }

    const token = jwt.sign({ id: existingCustomer.id, email: existingCustomer.email }, secret, { expiresIn: '7d' });

    res.status(200).json({
      message: 'Login successful',
      token,
      customer: {
        id: existingCustomer.id,
        name: existingCustomer.customer_name,
        email: existingCustomer.email,
        phone: existingCustomer.phone_number,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});


module.exports = router;
