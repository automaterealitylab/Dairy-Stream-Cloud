import { supabase } from "../../config.js";
import jwt from 'jsonwebtoken';

const FIXED_OTP = "123456"; // DEV ONLY

export const verifyLoginService = async (mobile, otp) => {
  if (otp !== FIXED_OTP) {
    throw new Error("Invalid OTP");
  }

  // 1. Get User
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('mobile', mobile)
    .single();

  if (!user || error) {
    throw new Error("User not found. Please Register.");
  }

  // 2. Generate Token
  const token = jwt.sign(
    { id: user.id, role: 'CUSTOMER', mobile: user.mobile },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '30d' }
  );

  return { 
    token, 
    user: { name: user.full_name, role: 'CUSTOMER' } 
  };
};

export const registerCustomerService = async (data) => {
  const { 
    customerName, phoneNumber, buildingName, 
    roomNo, defaultMilkQuantityLiters, billingCycle 
  } = data;

  // 1. Create User Identity
  const { data: newUser, error: userError } = await supabase
    .from('users')
    .insert([{ 
      mobile: phoneNumber, 
      full_name: customerName, 
      role: 'CUSTOMER' 
    }])
    .select()
    .single();

  if (userError) throw new Error("Registration failed: " + userError.message);

  // 2. Create Membership
  const { error: memberError } = await supabase
    .from('memberships')
    .insert([{
      user_id: newUser.id,
      building_name: buildingName,
      room_no: roomNo,
      default_milk_qty: defaultMilkQuantityLiters,
      billing_cycle: billingCycle,
      role: 'CUSTOMER',
      status: 'ACTIVE'
    }]);

  if (memberError) {
    // Rollback: Delete user if membership fails
    await supabase.from('users').delete().eq('id', newUser.id);
    throw new Error("Membership creation failed: " + memberError.message);
  }

  // 3. Generate Token
  const token = jwt.sign(
    { id: newUser.id, role: 'CUSTOMER', mobile: newUser.mobile },
    process.env.JWT_SECRET || 'secret'
  );

  return { token };
};