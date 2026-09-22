import client from "./client.js";

/**
 * Property Hierarchy API Service
 * Manages explicit Society/Property -> Building -> Wing (optional) -> Floor -> Unit hierarchy.
 */

export const fetchProperties = async ({ query = "", dairyId = null } = {}) => {
  const params = {};
  if (query) params.query = query;
  if (dairyId) params.dairy_id = dairyId;
  const response = await client.get("/property-hierarchy/properties", { params });
  return response.data?.data || [];
};

export const createProperty = async (data) => {
  const response = await client.post("/property-hierarchy/properties", data);
  return response.data?.data || null;
};

export const fetchBuildings = async (propertyId) => {
  if (!propertyId) return [];
  const response = await client.get("/property-hierarchy/buildings", {
    params: { property_id: propertyId },
  });
  return response.data?.data || [];
};

export const createBuilding = async ({ propertyId, name }) => {
  const response = await client.post("/property-hierarchy/buildings", {
    property_id: propertyId,
    name,
  });
  return response.data?.data || null;
};

export const fetchWings = async (buildingId) => {
  if (!buildingId) return [];
  const response = await client.get("/property-hierarchy/wings", {
    params: { building_id: buildingId },
  });
  return response.data?.data || [];
};

export const createWing = async ({ buildingId, name }) => {
  const response = await client.post("/property-hierarchy/wings", {
    building_id: buildingId,
    name,
  });
  return response.data?.data || null;
};

export const fetchFloors = async ({ buildingId, wingId = null }) => {
  if (!buildingId) return [];
  const params = { building_id: buildingId };
  if (wingId) params.wing_id = wingId;
  const response = await client.get("/property-hierarchy/floors", { params });
  return response.data?.data || [];
};

export const createFloor = async ({ buildingId, wingId = null, name, floorNumber = null }) => {
  const response = await client.post("/property-hierarchy/floors", {
    building_id: buildingId,
    wing_id: wingId || null,
    name,
    floor_number: floorNumber,
  });
  return response.data?.data || null;
};

export const fetchUnits = async (floorId) => {
  if (!floorId) return [];
  const response = await client.get("/property-hierarchy/units", {
    params: { floor_id: floorId },
  });
  return response.data?.data || [];
};

export const createUnit = async ({ floorId, unitType = "Flat", unitNumber }) => {
  const response = await client.post("/property-hierarchy/units", {
    floor_id: floorId,
    unit_type: unitType,
    unit_number: unitNumber,
  });
  return response.data?.data || null;
};

export const resolveHierarchy = async (payload) => {
  const response = await client.post("/property-hierarchy/resolve", payload);
  return response.data?.data || null;
};
