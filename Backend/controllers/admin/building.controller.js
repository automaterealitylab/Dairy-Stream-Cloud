import { supabase } from "../../../config.js";

export const getUniqueBuildings = async (req, res) => {
  try {
    // We query 'memberships' now, as that's where building_name lives in the new schema
    const { data, error } = await supabase
      .from('memberships') 
      .select('building_name');

    if (error) {
      console.error('Supabase select error:', error);
      return res.status(500).json({ error: 'Server failed to fetch buildings.' });
    }

    // Filter out nulls and duplicates
    const buildingNameArray = data.map(c => c.building_name);
    const uniqueBuildingNames = [...new Set(buildingNameArray)].filter(Boolean);

    res.json(uniqueBuildingNames);

  } catch (error) {
    console.error('Error fetching unique building names:', error);
    res.status(500).json({ error: 'Server failed to fetch buildings.' });
  }
};