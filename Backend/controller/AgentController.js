const { supabase } = require('../config');
const verifyEmail = require('../utils/verifyEmail');
const bcrypt = require('bcryptjs');

exports.addAgent = async (req, res) => {
  try {
    const data = req.body;
    const { email, password, agentName, phoneNumber, building } = data;

    const isEmailValid = await verifyEmail(email);
    if (!isEmailValid) {
      return res.status(400).json({
        error: 'The provided email is invalid'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Map field names to snake_case for Supabase
    const agentRecord = {
      email,
      password: hashedPassword,
      agent_name: agentName,
      phone_number: phoneNumber,
      building
    };

    const { data: result, error } = await supabase.from('agents').insert([agentRecord]).select();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(400).json({
        error: error.message || 'Failed to add agent'
      });
    }

    res.status(201).json({
      message: 'Agent added successfully',
      data: result[0]
    });
  } catch (err) {
    console.error('Agent creation error:', err);
    const statusCode = 500;
    const errorMessage = 'An unexpected server error occurred.';
    res.status(statusCode).json({ error: errorMessage });
  }
};