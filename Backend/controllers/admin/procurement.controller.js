import { supabase } from "../../config/supabase.js"; // Adjust this path to your supabase client

/**
 * @desc    Add a new procurement log (Purchase milk)
 * @route   POST /api/admin/procurement
 */
export const addProcurementLog = async (req, res) => {
  try {
    const { supplier_name, quantity, rate_per_liter, fat_percentage, snf_percentage } = req.body;
    const dairy_id = req.admin.dairyId; // From your verifyAdmin middleware

    if (!supplier_name || !quantity || !rate_per_liter) {
      return res.status(400).json({ error: "Supplier name, quantity, and rate are required." });
    }

    const { data, error } = await supabase
      .from('procurement_logs')
      .insert([
        { 
          dairy_id, 
          supplier_name, 
          quantity: parseFloat(quantity), 
          rate_per_liter: parseFloat(rate_per_liter), 
          fat_percentage: parseFloat(fat_percentage || 0), 
          snf_percentage: parseFloat(snf_percentage || 0) 
        }
      ])
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: "Procurement log recorded",
      data: data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc    Fetch all procurement logs for the dairy
 * @route   GET /api/admin/procurement
 */
export const fetchProcurementLogs = async (req, res) => {
  try {
    const dairy_id = req.admin.dairyId;

    const { data, error } = await supabase
      .from('procurement_logs')
      .select('*')
      .eq('dairy_id', dairy_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc    Helper function for Dashboard (Total Milk Procured Today)
 * @param   {BigInt} dairyId
 * @returns {Number} Total liters
 */
export const getTodayProcuredVolume = async (dairyId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('procurement_logs')
    .select('quantity')
    .eq('dairy_id', dairyId)
    .gte('created_at', startOfDay.toISOString());

  if (error || !data) return 0;

  return data.reduce((sum, log) => sum + parseFloat(log.quantity), 0);
};