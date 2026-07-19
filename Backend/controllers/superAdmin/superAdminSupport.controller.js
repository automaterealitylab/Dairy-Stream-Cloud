import { supabase } from "../../config/supabase.js";

// Fetch all support tickets
export const fetchTickets = async (req, res) => {
  try {
    const { status, category, priority } = req.query || {};

    let query = supabase
      .from("support_tickets")
      .select(`
        id,
        subject,
        description,
        category,
        status,
        priority,
        created_at,
        updated_at,
        dairy_id,
        dairies (
          dairy_name,
          owner_name,
          dairy_email,
          dairy_phone
        )
      `);

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }
    if (category && category !== "ALL") {
      query = query.eq("category", category);
    }
    if (priority && priority !== "ALL") {
      query = query.eq("priority", priority);
    }

    const { data: tickets, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    res.json({ success: true, tickets });
  } catch (err) {
    console.error("Fetch Tickets Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Create a support ticket (typically called by dairy dashboard, but added here for complete coverage)
export const createTicket = async (req, res) => {
  try {
    const { dairyId, subject, description, category, priority } = req.body || {};

    if (!dairyId || !subject || !description || !category) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        dairy_id: dairyId,
        subject,
        description,
        category,
        priority: priority || "MEDIUM",
        status: "OPEN",
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, ticket });
  } catch (err) {
    console.error("Create Ticket Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Update Ticket Status/Priority
export const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority } = req.body || {};

    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .update({
        status,
        priority,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("super_admin_audit_logs").insert({
      super_admin_id: req.superAdmin.id,
      action: "UPDATE_SUPPORT_TICKET",
      entity_type: "support_ticket",
      entity_id: String(id),
      details: { status, priority },
    });

    res.json({ success: true, ticket });
  } catch (err) {
    console.error("Update Ticket Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
