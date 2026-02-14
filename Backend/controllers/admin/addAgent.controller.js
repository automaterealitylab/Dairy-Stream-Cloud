import { createAgentService } from "../../services/admin/addAgent.service.js"

export const addAgent = async (req, res) => {
  try {
    // Call the Service
    const newAgent = await createAgentService(req.body);

    res.status(201).json({
      success: true,
      message: 'Agent added successfully',
      data: newAgent
    });

  } catch (err) {
    console.error('Agent creation error:', err.message);
    
    // Determine status code based on error message
    const statusCode = err.message.includes("Invalid") || err.message.includes("Failed") ? 400 : 500;
    
    res.status(statusCode).json({ 
      success: false,
      error: err.message 
    });
  }
};