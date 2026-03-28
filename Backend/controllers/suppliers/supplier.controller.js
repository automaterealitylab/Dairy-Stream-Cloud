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
      .select('id, name, phone, address, status')
      .eq('dairy_id', dairy_id)
      .eq('status', 'ACTIVE');

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc    Update supplier details
 * @route   PUT /api/admin/suppliers/:id
 */
export const updateSupplier = async (req, res) => {
  try {
    const dairy_id = req.admin.dairyId;
    const supplierId = Number(req.params.id);
    const { name, phone, address } = req.body;

    if (!Number.isFinite(supplierId)) {
      return res.status(400).json({ error: "Valid supplier id is required." });
    }

    if (!String(name || "").trim()) {
      return res.status(400).json({ error: "Supplier name is required." });
    }

    const { data, error } = await supabase
      .from("suppliers")
      .update({
        name: String(name).trim(),
        phone: String(phone || "").trim() || null,
        address: String(address || "").trim() || null,
      })
      .eq("id", supplierId)
      .eq("dairy_id", dairy_id)
      .eq("status", "ACTIVE")
      .select("id, name, phone, address, status")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Supplier not found." });
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc    Deactivate a supplier so it no longer appears in active procurement lists
 * @route   DELETE /api/admin/suppliers/:id
 */
export const deactivateSupplier = async (req, res) => {
  try {
    const dairy_id = req.admin.dairyId;
    const supplierId = Number(req.params.id);

    if (!Number.isFinite(supplierId)) {
      return res.status(400).json({ error: "Valid supplier id is required." });
    }

    const { data, error } = await supabase
      .from("suppliers")
      .update({ status: "INACTIVE" })
      .eq("id", supplierId)
      .eq("dairy_id", dairy_id)
      .select("id, name, status")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Supplier not found." });
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
