import * as hierarchyService from "../../services/propertyHierarchy/propertyHierarchy.service.js";

export const getProperties = async (req, res) => {
  try {
    const { query = "", dairy_id = null } = req.query;
    const properties = await hierarchyService.searchProperties({
      query,
      dairyId: dairy_id || req.user?.dairy_id || null,
    });
    return res.status(200).json({ success: true, data: properties });
  } catch (error) {
    console.error("Error in getProperties controller:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch properties" });
  }
};

export const createProperty = async (req, res) => {
  try {
    const { name, dairy_id = null, address = null, city = null, pincode = null, latitude = null, longitude = null } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Property name is required" });
    }
    const property = await hierarchyService.getOrCreateProperty({
      name,
      dairyId: dairy_id || req.user?.dairy_id || null,
      address,
      city,
      pincode,
      latitude,
      longitude,
    });
    return res.status(201).json({ success: true, data: property });
  } catch (error) {
    console.error("Error in createProperty controller:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create property" });
  }
};

export const getBuildings = async (req, res) => {
  try {
    const { property_id } = req.query;
    if (!property_id) {
      return res.status(400).json({ success: false, message: "property_id is required" });
    }
    const buildings = await hierarchyService.getBuildingsForProperty(property_id);
    return res.status(200).json({ success: true, data: buildings });
  } catch (error) {
    console.error("Error in getBuildings controller:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch buildings" });
  }
};

export const createBuilding = async (req, res) => {
  try {
    const { property_id, name } = req.body;
    if (!property_id || !name || !name.trim()) {
      return res.status(400).json({ success: false, message: "property_id and building name are required" });
    }
    const building = await hierarchyService.getOrCreateBuilding({ propertyId: property_id, name });
    return res.status(201).json({ success: true, data: building });
  } catch (error) {
    console.error("Error in createBuilding controller:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create building" });
  }
};

export const getWings = async (req, res) => {
  try {
    const { building_id } = req.query;
    if (!building_id) {
      return res.status(400).json({ success: false, message: "building_id is required" });
    }
    const wings = await hierarchyService.getWingsForBuilding(building_id);
    return res.status(200).json({ success: true, data: wings });
  } catch (error) {
    console.error("Error in getWings controller:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch wings" });
  }
};

export const createWing = async (req, res) => {
  try {
    const { building_id, name } = req.body;
    if (!building_id || !name || !name.trim()) {
      return res.status(400).json({ success: false, message: "building_id and wing name are required" });
    }
    const wing = await hierarchyService.getOrCreateWing({ buildingId: building_id, name });
    return res.status(201).json({ success: true, data: wing });
  } catch (error) {
    console.error("Error in createWing controller:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create wing" });
  }
};

export const getFloors = async (req, res) => {
  try {
    const { building_id, wing_id = null } = req.query;
    if (!building_id) {
      return res.status(400).json({ success: false, message: "building_id is required" });
    }
    const floors = await hierarchyService.getFloorsForBuilding({
      buildingId: building_id,
      wingId: wing_id || null,
    });
    return res.status(200).json({ success: true, data: floors });
  } catch (error) {
    console.error("Error in getFloors controller:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch floors" });
  }
};

export const createFloor = async (req, res) => {
  try {
    const { building_id, wing_id = null, name, floor_number = null } = req.body;
    if (!building_id || !name || !name.trim()) {
      return res.status(400).json({ success: false, message: "building_id and floor name are required" });
    }
    const floor = await hierarchyService.getOrCreateFloor({
      buildingId: building_id,
      wingId: wing_id || null,
      name,
      floorNumber: floor_number,
    });
    return res.status(201).json({ success: true, data: floor });
  } catch (error) {
    console.error("Error in createFloor controller:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create floor" });
  }
};

export const getUnits = async (req, res) => {
  try {
    const { floor_id } = req.query;
    if (!floor_id) {
      return res.status(400).json({ success: false, message: "floor_id is required" });
    }
    const units = await hierarchyService.getUnitsForFloor(floor_id);
    return res.status(200).json({ success: true, data: units });
  } catch (error) {
    console.error("Error in getUnits controller:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch units" });
  }
};

export const createUnit = async (req, res) => {
  try {
    const { floor_id, unit_type = "Flat", unit_number } = req.body;
    if (!floor_id || !unit_number || !String(unit_number).trim()) {
      return res.status(400).json({ success: false, message: "floor_id and unit_number are required" });
    }
    const unit = await hierarchyService.getOrCreateUnit({
      floorId: floor_id,
      unitType: unit_type,
      unitNumber: unit_number,
    });
    return res.status(201).json({ success: true, data: unit });
  } catch (error) {
    console.error("Error in createUnit controller:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create unit" });
  }
};

export const resolveHierarchy = async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await hierarchyService.resolveOrCreateCustomerHierarchy({
      propertyId: payload.property_id || payload.propertyId || null,
      propertyName: payload.property_name || payload.propertyName || "",
      buildingId: payload.building_id || payload.buildingId || null,
      buildingName: payload.building_name || payload.buildingName || "",
      hasWing: Boolean(payload.has_wing ?? payload.hasWing),
      wingId: payload.wing_id || payload.wingId || null,
      wingName: payload.wing_name || payload.wingName || "",
      floorId: payload.floor_id || payload.floorId || null,
      floorName: payload.floor_name || payload.floorName || "",
      unitId: payload.unit_id || payload.unitId || null,
      unitType: payload.unit_type || payload.unitType || "Flat",
      unitNumber: payload.unit_number || payload.unitNumber || "",
      dairyId: payload.dairy_id || payload.dairyId || req.user?.dairy_id || null,
      address: payload.address || null,
      city: payload.city || null,
      pincode: payload.pincode || null,
      latitude: payload.latitude || null,
      longitude: payload.longitude || null,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error in resolveHierarchy controller:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to resolve hierarchy" });
  }
};
