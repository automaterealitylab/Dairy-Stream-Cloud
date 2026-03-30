import {
  getAdminAgents,
  getAgentDetails,
  updateAgentById,
  deleteAgentById,
} from "../../services/admin/adminAgents.service.js";

export const fetchAdminAgents = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const search = req.query.search || "";
    const lite =
      String(req.query.lite || "")
        .trim()
        .toLowerCase() === "true";
    const dairyId = req.admin?.dairyId ?? null;

    const result = await getAdminAgents({ page, limit, search, dairyId, lite });

    res.json(result);
  } catch (err) {
    console.error("ADMIN AGENTS ERROR:", err.message);
    res.status(500).json({
      message: "Failed to fetch delivery agents",
    });
  }
};

export const fetchAdminAgentById = async (req, res) => {
  try {
    const { id } = req.params;
    const dairyId = req.admin?.dairyId ?? null;

    const data = await getAgentDetails(id, { dairyId });

    if (!data) {
        return res.status(404).json({ message: "Agent not found" });
    }

    res.json(data);
  } catch (err) {
    console.error("ADMIN AGENT DETAIL ERROR:", err.message);
    res.status(500).json({
      message: "Failed to load agent details",
    });
  }
};

export const updateAdminAgentById = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateAgentById(id, req.body);
    res.json({ success: true, agent: updated });
  } catch (err) {
    console.error("ADMIN AGENT UPDATE ERROR:", err.message);
    res.status(500).json({ message: "Failed to update agent" });
  }
};

export const deleteAdminAgentById = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteAgentById(id);
    res.json({ success: true });
  } catch (err) {
    console.error("ADMIN AGENT DELETE ERROR:", err.message);
    res.status(500).json({ message: "Failed to delete agent" });
  }
};
