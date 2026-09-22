import { supabase } from "../../config/supabase.js";

const normalizeText = (value) => String(value || "").trim();

const isTableNotFoundError = (error) => {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("not found in the schema cache") ||
    msg.includes("relation")
  );
};

// ==========================================
// 1. PROPERTY OPERATIONS
// ==========================================
export const searchProperties = async ({ query = "", dairyId = null } = {}) => {
  try {
    let q = supabase
      .from("properties")
      .select("id, dairy_id, name, address, city, pincode, latitude, longitude")
      .order("name", { ascending: true })
      .limit(50);

    const cleanQuery = normalizeText(query);
    if (cleanQuery) {
      q = q.ilike("name", `%${cleanQuery}%`);
    }

    if (dairyId) {
      q = q.or(`dairy_id.eq.${dairyId},dairy_id.is.null`);
    }

    const { data, error } = await q;
    if (error) {
      if (isTableNotFoundError(error)) return [];
      throw error;
    }

    return data || [];
  } catch (err) {
    console.error("searchProperties error:", err?.message || err);
    return [];
  }
};

export const getOrCreateProperty = async ({
  name,
  dairyId = null,
  address = null,
  city = null,
  pincode = null,
  latitude = null,
  longitude = null,
} = {}) => {
  const cleanName = normalizeText(name);
  if (!cleanName) throw new Error("Property name is required");

  try {
    let lookupQuery = supabase
      .from("properties")
      .select("*")
      .ilike("name", cleanName);

    if (dairyId) {
      lookupQuery = lookupQuery.or(`dairy_id.eq.${dairyId},dairy_id.is.null`);
    }

    const { data: existing, error: findError } = await lookupQuery.limit(1).maybeSingle();
    if (findError && !isTableNotFoundError(findError)) throw findError;

    if (existing) return existing;

    const { data: created, error: insertError } = await supabase
      .from("properties")
      .insert([
        {
          name: cleanName,
          dairy_id: dairyId || null,
          address: address || null,
          city: city || null,
          pincode: pincode || null,
          latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
          longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;
    return created;
  } catch (err) {
    console.error("getOrCreateProperty error:", err?.message || err);
    throw err;
  }
};

// ==========================================
// 2. BUILDING OPERATIONS
// ==========================================
export const getBuildingsForProperty = async (propertyId) => {
  if (!propertyId) return [];
  try {
    const { data, error } = await supabase
      .from("buildings")
      .select("id, property_id, name, created_at")
      .eq("property_id", propertyId)
      .order("name", { ascending: true });

    if (error) {
      if (isTableNotFoundError(error)) return [];
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error("getBuildingsForProperty error:", err?.message || err);
    return [];
  }
};

export const getOrCreateBuilding = async ({ propertyId, name } = {}) => {
  if (!propertyId) throw new Error("Property ID is required for building");
  const cleanName = normalizeText(name);
  if (!cleanName) throw new Error("Building name is required");

  try {
    const { data: existing, error: findError } = await supabase
      .from("buildings")
      .select("*")
      .eq("property_id", propertyId)
      .ilike("name", cleanName)
      .limit(1)
      .maybeSingle();

    if (findError && !isTableNotFoundError(findError)) throw findError;
    if (existing) return existing;

    const { data: created, error: insertError } = await supabase
      .from("buildings")
      .insert([{ property_id: propertyId, name: cleanName }])
      .select()
      .single();

    if (insertError) throw insertError;
    return created;
  } catch (err) {
    console.error("getOrCreateBuilding error:", err?.message || err);
    throw err;
  }
};

// ==========================================
// 3. WING OPERATIONS
// ==========================================
export const getWingsForBuilding = async (buildingId) => {
  if (!buildingId) return [];
  try {
    const { data, error } = await supabase
      .from("wings")
      .select("id, building_id, name, created_at")
      .eq("building_id", buildingId)
      .order("name", { ascending: true });

    if (error) {
      if (isTableNotFoundError(error)) return [];
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error("getWingsForBuilding error:", err?.message || err);
    return [];
  }
};

export const getOrCreateWing = async ({ buildingId, name } = {}) => {
  if (!buildingId) throw new Error("Building ID is required for wing");
  const cleanName = normalizeText(name);
  if (!cleanName) return null; // Wing is strictly optional

  try {
    const { data: existing, error: findError } = await supabase
      .from("wings")
      .select("*")
      .eq("building_id", buildingId)
      .ilike("name", cleanName)
      .limit(1)
      .maybeSingle();

    if (findError && !isTableNotFoundError(findError)) throw findError;
    if (existing) return existing;

    const { data: created, error: insertError } = await supabase
      .from("wings")
      .insert([{ building_id: buildingId, name: cleanName }])
      .select()
      .single();

    if (insertError) throw insertError;
    return created;
  } catch (err) {
    console.error("getOrCreateWing error:", err?.message || err);
    throw err;
  }
};

// ==========================================
// 4. FLOOR OPERATIONS
// ==========================================
export const getFloorsForBuilding = async ({ buildingId, wingId = null } = {}) => {
  if (!buildingId) return [];
  try {
    let q = supabase
      .from("floors")
      .select("id, building_id, wing_id, name, floor_number, created_at")
      .eq("building_id", buildingId);

    if (wingId) {
      q = q.eq("wing_id", wingId);
    } else {
      q = q.is("wing_id", null);
    }

    q = q.order("floor_number", { ascending: true, nullsFirst: false }).order("name", { ascending: true });

    const { data, error } = await q;
    if (error) {
      if (isTableNotFoundError(error)) return [];
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error("getFloorsForBuilding error:", err?.message || err);
    return [];
  }
};

export const getOrCreateFloor = async ({
  buildingId,
  wingId = null,
  name,
  floorNumber = null,
} = {}) => {
  if (!buildingId) throw new Error("Building ID is required for floor");
  const cleanName = normalizeText(name);
  if (!cleanName) throw new Error("Floor name is required");

  let parsedNumber = Number.isFinite(Number(floorNumber)) ? Number(floorNumber) : null;
  if (parsedNumber === null) {
    const digits = cleanName.match(/-?\d+(\.\d+)?/)?.[0];
    if (digits) parsedNumber = Number(digits);
    else if (/ground|gf\b/i.test(cleanName)) parsedNumber = 0;
    else if (/basement|b1\b/i.test(cleanName)) parsedNumber = -1;
  }

  try {
    let q = supabase
      .from("floors")
      .select("*")
      .eq("building_id", buildingId)
      .ilike("name", cleanName);

    if (wingId) {
      q = q.eq("wing_id", wingId);
    } else {
      q = q.is("wing_id", null);
    }

    const { data: existing, error: findError } = await q.limit(1).maybeSingle();
    if (findError && !isTableNotFoundError(findError)) throw findError;
    if (existing) return existing;

    const { data: created, error: insertError } = await supabase
      .from("floors")
      .insert([
        {
          building_id: buildingId,
          wing_id: wingId || null,
          name: cleanName,
          floor_number: parsedNumber,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;
    return created;
  } catch (err) {
    console.error("getOrCreateFloor error:", err?.message || err);
    throw err;
  }
};

// ==========================================
// 5. UNIT OPERATIONS
// ==========================================
export const getUnitsForFloor = async (floorId) => {
  if (!floorId) return [];
  try {
    const { data, error } = await supabase
      .from("units")
      .select("id, floor_id, unit_type, unit_number, created_at")
      .eq("floor_id", floorId)
      .order("unit_number", { ascending: true });

    if (error) {
      if (isTableNotFoundError(error)) return [];
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error("getUnitsForFloor error:", err?.message || err);
    return [];
  }
};

export const getOrCreateUnit = async ({ floorId, unitType = "Flat", unitNumber } = {}) => {
  if (!floorId) throw new Error("Floor ID is required for unit");
  const cleanNumber = normalizeText(unitNumber);
  if (!cleanNumber) throw new Error("Unit number is required");
  const cleanType = normalizeText(unitType) || "Flat";

  try {
    const { data: existing, error: findError } = await supabase
      .from("units")
      .select("*")
      .eq("floor_id", floorId)
      .ilike("unit_type", cleanType)
      .ilike("unit_number", cleanNumber)
      .limit(1)
      .maybeSingle();

    if (findError && !isTableNotFoundError(findError)) throw findError;
    if (existing) return existing;

    const { data: created, error: insertError } = await supabase
      .from("units")
      .insert([
        {
          floor_id: floorId,
          unit_type: cleanType,
          unit_number: cleanNumber,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;
    return created;
  } catch (err) {
    console.error("getOrCreateUnit error:", err?.message || err);
    throw err;
  }
};

// ==========================================
// 6. RESOLVE COMPLETE HIERARCHY TREE
// ==========================================
export const resolveOrCreateCustomerHierarchy = async ({
  propertyId = null,
  propertyName = "",
  buildingId = null,
  buildingName = "",
  hasWing = false,
  wingId = null,
  wingName = "",
  floorId = null,
  floorName = "",
  unitId = null,
  unitType = "Flat",
  unitNumber = "",
  dairyId = null,
  address = null,
  city = null,
  pincode = null,
  latitude = null,
  longitude = null,
} = {}) => {
  // If no property or building provided, return empty
  const cleanPropName = normalizeText(propertyName);
  const cleanBuildingName = normalizeText(buildingName);
  const cleanFloorName = normalizeText(floorName);
  const cleanUnitNumber = normalizeText(unitNumber);

  if (!cleanPropName && !propertyId && !cleanBuildingName && !buildingId) {
    return null;
  }

  // 1. Property
  let property = null;
  if (propertyId) {
    const { data } = await supabase.from("properties").select("*").eq("id", propertyId).maybeSingle();
    property = data;
  }
  if (!property && cleanPropName) {
    property = await getOrCreateProperty({
      name: cleanPropName,
      dairyId,
      address,
      city,
      pincode,
      latitude,
      longitude,
    });
  }

  if (!property) return null;

  // 2. Building
  let building = null;
  if (buildingId) {
    const { data } = await supabase.from("buildings").select("*").eq("id", buildingId).maybeSingle();
    building = data;
  }
  if (!building && cleanBuildingName) {
    building = await getOrCreateBuilding({ propertyId: property.id, name: cleanBuildingName });
  }

  if (!building) {
    return {
      propertyId: property.id,
      propertyName: property.name,
      buildingId: null,
      buildingName: "",
      wingId: null,
      wingName: null,
      floorId: null,
      floorName: null,
      unitId: null,
      unitType: null,
      unitNumber: null,
    };
  }

  // 3. Wing (Optional)
  let wing = null;
  const cleanWingName = normalizeText(wingName);
  if (hasWing && (wingId || cleanWingName)) {
    if (wingId) {
      const { data } = await supabase.from("wings").select("*").eq("id", wingId).maybeSingle();
      wing = data;
    }
    if (!wing && cleanWingName) {
      wing = await getOrCreateWing({ buildingId: building.id, name: cleanWingName });
    }
  }

  // 4. Floor
  let floor = null;
  if (floorId) {
    const { data } = await supabase.from("floors").select("*").eq("id", floorId).maybeSingle();
    floor = data;
  }
  if (!floor && cleanFloorName) {
    floor = await getOrCreateFloor({
      buildingId: building.id,
      wingId: wing?.id || null,
      name: cleanFloorName,
    });
  }

  // 5. Unit
  let unit = null;
  if (unitId) {
    const { data } = await supabase.from("units").select("*").eq("id", unitId).maybeSingle();
    unit = data;
  }
  if (!unit && floor && cleanUnitNumber) {
    unit = await getOrCreateUnit({
      floorId: floor.id,
      unitType: normalizeText(unitType) || "Flat",
      unitNumber: cleanUnitNumber,
    });
  }

  return {
    propertyId: property.id,
    propertyName: property.name,
    buildingId: building.id,
    buildingName: building.name,
    wingId: wing?.id || null,
    wingName: wing?.name || null,
    floorId: floor?.id || null,
    floorName: floor?.name || null,
    unitId: unit?.id || null,
    unitType: unit?.unit_type || normalizeText(unitType) || "Flat",
    unitNumber: unit?.unit_number || cleanUnitNumber || "",
  };
};
