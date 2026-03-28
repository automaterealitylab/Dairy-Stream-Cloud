import { supabase } from "../../config/supabase.js"; // Adjust this path to your supabase client

/**
 * @desc    Add a new procurement log
 * @route   POST /api/admin/procurement
 */
export const addProcurementLog = async (req, res) => {
  try {
    const {
      supplier_id,
      supplier_name,
      item_name,
      item_category,
      unit,
      quantity,
      rate_per_unit,
      rate_per_liter,
      fat_percentage,
      snf_percentage,
    } = req.body;
    const dairy_id = req.admin.dairyId; // From your verifyAdmin middleware
    const resolvedRate = rate_per_unit ?? rate_per_liter;
    const resolvedItemName = item_name || "Milk";
    const resolvedItemCategory = item_category || "MILK";
    const resolvedUnit = unit || "LITER";

    if (!supplier_name || !resolvedItemName || !quantity || !resolvedRate) {
      return res.status(400).json({ error: "Supplier, item, quantity, and rate are required." });
    }

    const { data, error } = await supabase
      .from('procurement_logs')
      .insert([
        { 
          dairy_id,
          supplier_id: supplier_id || null,
          supplier_name,
          item_name: resolvedItemName,
          item_category: resolvedItemCategory,
          unit: resolvedUnit,
          quantity: parseFloat(quantity),
          rate_per_unit: parseFloat(resolvedRate),
          rate_per_liter: parseFloat(resolvedRate),
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
 * @desc    Update an existing procurement log
 * @route   PUT /api/admin/procurement/:id
 */
export const updateProcurementLog = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      supplier_id,
      supplier_name,
      item_name,
      item_category,
      unit,
      quantity,
      rate_per_unit,
      rate_per_liter,
      fat_percentage,
      snf_percentage,
    } = req.body;

    const dairy_id = req.admin.dairyId;
    const resolvedRate = rate_per_unit ?? rate_per_liter;
    const resolvedItemName = item_name || "Milk";
    const resolvedItemCategory = item_category || "MILK";
    const resolvedUnit = unit || "LITER";

    if (!supplier_name || !resolvedItemName || !quantity || !resolvedRate) {
      return res.status(400).json({ error: "Supplier, item, quantity, and rate are required." });
    }

    const payload = {
      supplier_id: supplier_id || null,
      supplier_name,
      item_name: resolvedItemName,
      item_category: resolvedItemCategory,
      unit: resolvedUnit,
      quantity: parseFloat(quantity),
      rate_per_unit: parseFloat(resolvedRate),
      rate_per_liter: parseFloat(resolvedRate),
      fat_percentage: parseFloat(fat_percentage || 0),
      snf_percentage: parseFloat(snf_percentage || 0),
    };

    const { data, error } = await supabase
      .from("procurement_logs")
      .update(payload)
      .eq("id", id)
      .eq("dairy_id", dairy_id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: "Procurement log updated",
      data,
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
    .select('quantity, item_category')
    .eq('dairy_id', dairyId)
    .gte('created_at', startOfDay.toISOString());

  if (error || !data) return 0;

  return data.reduce((sum, log) => {
    const category = String(log.item_category || "MILK").toUpperCase();
    return category === "MILK" ? sum + parseFloat(log.quantity || 0) : sum;
  }, 0);
};
