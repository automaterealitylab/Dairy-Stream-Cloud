import { getAdminAgents, getAgentDetails } from "../../services/admin/adminAgents.service.js";

// 1. Fetch All Agents (with Pagination & Search)
export const fetchAdminAgents = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const search = req.query.search || "";

    const result = await getAdminAgents({ page, limit, search });

    res.json(result);
  } catch (err) {
    console.error("ADMIN AGENTS ERROR:", err.message);
    res.status(500).json({
      message: "Failed to fetch delivery agents",
    });
  }
};

// 2. Fetch Single Agent by ID
export const fetchAdminAgentById = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await getAgentDetails(id);

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