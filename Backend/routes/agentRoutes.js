const express = require('express');
const router = express.Router();
const { supabase } = require('../config');
const AgentController = require('../controller/AgentController');       

// Endpoint: http://localhost:4000/api/buildings
router.get('/buildings', async (req, res) => {
  try {
    const { data, error } = await supabase.from('customers').select('building_name');
    if (error) {
      console.error('Supabase select error:', error);
      return res.status(500).json({ error: 'Server failed to fetch customer buildings.' });
    }
    const buildingNameArray = data.map(c => c.building_name);
    const uniqueBuildingNames = [...new Set(buildingNameArray)].filter(Boolean);
    res.json(uniqueBuildingNames);
  } catch (error) {
    console.error('Error fetching unique building names:', error);
    res.status(500).json({ error: 'Server failed to fetch customer buildings.' });
  }
});
// Endpoint: http://localhost:4000/api/addAgent
router.post('/addAgent', async (req, res) => {
  return AgentController.addAgent(req, res);
});

module.exports = router;