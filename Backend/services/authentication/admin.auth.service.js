import { supabase } from "../../config.js"
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const adminLoginService = async (email, password) => {
  // 1. Find Admin
  const { data: admin, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (!admin || error) {
    throw new Error("Admin not found.");
  }

  // 2. Check Password
  const isMatch = await bcrypt.compare(password, admin.password_hash);
  if (!isMatch) {
    throw new Error("Incorrect Password");
  }

  // 3. Find Dairy Context
  const { data: dairy } = await supabase
    .from('dairies')
    .select('id')
    .eq('owner_id', admin.id)
    .maybeSingle();

  // 4. Generate Token
  const token = jwt.sign(
    { 
      id: admin.id, 
      role: 'ADMIN', 
      dairyId: dairy ? dairy.id : null 
    },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '1d' }
  );

  return { 
    token, 
    user: { name: admin.full_name, role: 'ADMIN' } 
  };
};