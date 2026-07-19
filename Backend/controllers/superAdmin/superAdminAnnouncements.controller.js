import { supabase } from "../../config/supabase.js";
import { sendEmail } from "../../utils/email.js";

// Fetch platform announcements
export const fetchAnnouncements = async (req, res) => {
  try {
    const { data: announcements, error } = await supabase
      .from("platform_announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ success: true, announcements });
  } catch (err) {
    console.error("Fetch Announcements Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Create and broadcast announcement
export const createAnnouncement = async (req, res) => {
  try {
    const { title, message, announcementType, targetType, targetValue } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({ success: false, error: "Title and message are required" });
    }

    const { data: announcement, error } = await supabase
      .from("platform_announcements")
      .insert({
        title,
        message,
        announcement_type: announcementType || "NOTIFICATION",
        target_type: targetType || "ALL",
        target_value: targetValue ? JSON.stringify(targetValue) : null,
        created_by: req.superAdmin.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Send background emails to targeted dairies
    let dairiesQuery = supabase.from("dairies").select("id, dairy_name, owner_name, dairy_email, selected_plan, city");

    if (targetType === "PLAN" && targetValue) {
      dairiesQuery = dairiesQuery.eq("selected_plan", targetValue);
    } else if (targetType === "AREA" && targetValue) {
      dairiesQuery = dairiesQuery.eq("city", targetValue);
    } else if (targetType === "SPECIFIC_DAIRIES" && targetValue) {
      dairiesQuery = dairiesQuery.in("id", Array.isArray(targetValue) ? targetValue : [targetValue]);
    }

    const { data: targetedDairies } = await dairiesQuery;

    if (targetedDairies && targetedDairies.length > 0) {
      // Fire-and-forget background email broadcasts to prevent request block
      targetedDairies.forEach(async (dairy) => {
        if (!dairy.dairy_email) return;
        try {
          await sendEmail({
            to: dairy.dairy_email,
            subject: `[DairyStream Cloud] ${title}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #2563eb;">Platform Update: ${title}</h2>
                <p>Hello ${dairy.owner_name || "Dairy Owner"},</p>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0; font-size: 15px; color: #1f2937;">
                  ${message.replace(/\n/g, "<br/>")}
                </div>
                <p style="font-size: 12px; color: #6b7280; margin-top: 25px;">
                  You received this email because your dairy <strong>${dairy.dairy_name}</strong> is registered on DairyStream Cloud.
                </p>
              </div>
            `,
          });
        } catch (emailErr) {
          console.error(`Announcement email failed for ${dairy.dairy_email}:`, emailErr.message);
        }
      });
    }

    // Log audit
    await supabase.from("super_admin_audit_logs").insert({
      super_admin_id: req.superAdmin.id,
      action: "BROADCAST_ANNOUNCEMENT",
      entity_type: "announcement",
      entity_id: String(announcement.id),
      details: { title, targetType },
    });

    res.json({ success: true, announcement });
  } catch (err) {
    console.error("Create Announcement Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
