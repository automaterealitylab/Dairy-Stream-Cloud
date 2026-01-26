const bcrypt = require('bcryptjs');
const { supabase } = require('../config');
const verifyEmail = require('../utils/verifyEmail');

// Helper: map frontend fields (camelCase) to Supabase columns (snake_case)
const mapCustomerFields = (data) => ({
  email: data.email,
  password: data.password,
  customer_name: data.customerName,
  phone_number: data.phoneNumber,
  building_name: data.buildingName,
  wing: data.wing || null,
  room_no: data.roomNo,
  default_milk_quantity_liters: data.defaultMilkQuantityLiters || 1.0,
  default_extra_product: data.defaultExtraProduct || 'None',
  default_extra_product_quantity: data.defaultExtraProductQuantity || 0,
  billing_cycle: data.billingCycle || 'Monthly',
  date_joined: new Date().toISOString(),
});

exports.addCustomer = async (req, res) => {
  try {
    const data = req.body;
    const { email, password } = data;

    // Email verification (optional)
    const isEmailValid = await verifyEmail(email);
    if (!isEmailValid) {
      return res.status(400).json({ error: 'Invalid or undeliverable email address.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare record for Supabase (snake_case column names)
    const record = mapCustomerFields({ ...data, password: hashedPassword });

    const { data: inserted, error } = await supabase.from('customers').insert([record]).select();

    if (error) {
      console.error('Supabase insert error:', error);
      // Unique constraint error handling
      if (error.code === '23505' || (error.details && error.details.includes('unique'))) {
        return res.status(400).json({ error: 'Email or phone already exists.' });
      }
      return res.status(400).json({ error: error.message || 'Failed to create customer.' });
    }

    const created = inserted[0];

    res.status(201).json({
      message: '✅ Customer added successfully',
      data: {
        id: created.id,
        customerName: created.customer_name,
        email: created.email,
        phoneNumber: created.phone_number,
        buildingName: created.building_name,
        roomNo: created.room_no,
        billingCycle: created.billing_cycle,
      },
    });
  } catch (err) {
    console.error('addCustomer error:', err);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  }
};
