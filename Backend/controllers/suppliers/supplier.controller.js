import { supabase } from "../../config/supabase.js";

/**
 * @desc    Add a new supplier
 * @route   POST /api/admin/suppliers
 */
export const addSupplier = async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const dairy_id = req.admin.dairyId;

    const { data, error } = await supabase
      .from('suppliers')
      .insert([{ dairy_id, name, phone, address }])
      .select();

    if (error) throw error;
    res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc    Get all suppliers for the dropdown
 * @route   GET /api/admin/suppliers
 */
export const fetchSuppliers = async (req, res) => {
  try {
    const dairy_id = req.admin.dairyId;
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('dairy_id', dairy_id)
      .eq('status', 'ACTIVE');

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};