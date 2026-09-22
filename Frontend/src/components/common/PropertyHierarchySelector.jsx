import React, { useEffect, useState } from "react";
import {
  Building2,
  ChevronDown,
  Layers,
  Home,
  Plus,
  Check,
  X,
  Loader2,
} from "lucide-react";
import {
  fetchProperties,
  fetchBuildings,
  fetchWings,
  fetchFloors,
} from "../../api/propertyHierarchy.api";

const UNIT_TYPES = [
  "Flat",
  "Room",
  "House",
  "Shop",
  "Office",
  "Cabin",
  "Other",
];

const PRESET_FLOORS = [
  "Ground Floor",
  "1st Floor",
  "2nd Floor",
  "3rd Floor",
  "4th Floor",
  "5th Floor",
  "6th Floor",
  "7th Floor",
  "8th Floor",
  "9th Floor",
  "10th Floor",
  "Basement",
];

export default function PropertyHierarchySelector({
  value = {},
  onChange,
  dairyId = null,
  isDark = false,
  disabled = false,
}) {
  // Primary state derived from value prop
  const propertyId = value.property_id || value.propertyId || null;
  const propertyName = value.property_name || value.propertyName || "";
  const buildingId = value.building_id || value.buildingId || null;
  const buildingName = value.building_name || value.buildingName || "";
  const hasWing = Boolean(
    value.has_wing ?? value.hasWing ?? (value.wing || value.wing_name || value.wingName)
  );
  const wingId = value.wing_id || value.wingId || null;
  const wingName = value.wing_name || value.wingName || value.wing || "";
  const floorId = value.floor_id || value.floorId || null;
  const floorName = value.floor_name || value.floorName || "";
  const unitId = value.unit_id || value.unitId || null;
  const unitType = value.unit_type || value.unitType || "Flat";
  const unitNumber = value.unit_number || value.unitNumber || value.room_no || value.roomNo || "";

  // Dropdown lists
  const [propertiesList, setPropertiesList] = useState([]);
  const [buildingsList, setBuildingsList] = useState([]);
  const [wingsList, setWingsList] = useState([]);
  const [floorsList, setFloorsList] = useState([]);

  // Loading states
  const [loadingProps, setLoadingProps] = useState(false);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [loadingWings, setLoadingWings] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);

  // Custom creation toggles
  const [isCustomProperty, setIsCustomProperty] = useState(false);
  const [isCustomBuilding, setIsCustomBuilding] = useState(false);
  const [isCustomWing, setIsCustomWing] = useState(false);
  const [isCustomFloor, setIsCustomFloor] = useState(false);

  // Notify parent with dual-write payload
  const emitChange = (updates) => {
    if (!onChange) return;
    const next = {
      property_id: updates.property_id !== undefined ? updates.property_id : propertyId,
      property_name: updates.property_name !== undefined ? updates.property_name : propertyName,
      building_id: updates.building_id !== undefined ? updates.building_id : buildingId,
      building_name: updates.building_name !== undefined ? updates.building_name : buildingName,
      has_wing: updates.has_wing !== undefined ? updates.has_wing : hasWing,
      wing_id: updates.wing_id !== undefined ? updates.wing_id : wingId,
      wing_name: updates.wing_name !== undefined ? updates.wing_name : wingName,
      floor_id: updates.floor_id !== undefined ? updates.floor_id : floorId,
      floor_name: updates.floor_name !== undefined ? updates.floor_name : floorName,
      unit_id: updates.unit_id !== undefined ? updates.unit_id : unitId,
      unit_type: updates.unit_type !== undefined ? updates.unit_type : unitType,
      unit_number: updates.unit_number !== undefined ? updates.unit_number : unitNumber,
    };

    // Legacy dual-write compatibility
    next.buildingName = next.building_name;
    next.wing = next.has_wing ? next.wing_name : null;
    next.roomNo = next.unit_number;
    next.room_no = next.unit_number;

    onChange(next);
  };

  // 1. Fetch properties on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingProps(true);
    fetchProperties({ dairyId })
      .then((data) => {
        if (!cancelled) setPropertiesList(data);
      })
      .catch((err) => console.warn("Failed to load properties:", err?.message))
      .finally(() => {
        if (!cancelled) setLoadingProps(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dairyId]);

  // 2. Fetch buildings when propertyId changes
  useEffect(() => {
    if (!propertyId) {
      setBuildingsList([]);
      return;
    }
    let cancelled = false;
    setLoadingBuildings(true);
    fetchBuildings(propertyId)
      .then((data) => {
        if (!cancelled) setBuildingsList(data);
      })
      .catch((err) => console.warn("Failed to load buildings:", err?.message))
      .finally(() => {
        if (!cancelled) setLoadingBuildings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  // 3. Fetch wings when buildingId changes and hasWing is true
  useEffect(() => {
    if (!buildingId || !hasWing) {
      setWingsList([]);
      return;
    }
    let cancelled = false;
    setLoadingWings(true);
    fetchWings(buildingId)
      .then((data) => {
        if (!cancelled) setWingsList(data);
      })
      .catch((err) => console.warn("Failed to load wings:", err?.message))
      .finally(() => {
        if (!cancelled) setLoadingWings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buildingId, hasWing]);

  // 4. Fetch floors when buildingId or wingId changes
  useEffect(() => {
    if (!buildingId) {
      setFloorsList([]);
      return;
    }
    let cancelled = false;
    setLoadingFloors(true);
    fetchFloors({ buildingId, wingId: hasWing ? wingId : null })
      .then((data) => {
        if (!cancelled) setFloorsList(data);
      })
      .catch((err) => console.warn("Failed to load floors:", err?.message))
      .finally(() => {
        if (!cancelled) setLoadingFloors(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buildingId, wingId, hasWing]);

  // Styling tokens
  const containerClass = `space-y-4 rounded-2xl p-4 border transition-all ${
    isDark
      ? "bg-[#161C2C]/70 border-[#222B40] text-white"
      : "bg-[#FCFBF8] border-[#EDE8DF] text-[#2C1A0E]"
  }`;

  const labelClass = `block text-xs font-bold tracking-wide uppercase mb-1.5 ${
    isDark ? "text-[#C4A882]" : "text-[#8B7355]"
  }`;

  const inputClass = `w-full rounded-xl px-3.5 py-2.5 text-sm font-medium border outline-none transition-all ${
    isDark
      ? "bg-[#0B0F19] border-[#222B40] text-white placeholder-slate-500 focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706]"
      : "bg-white border-[#E8E2D9] text-[#2C1A0E] placeholder-[#A88763]/60 focus:border-[#B8641A] focus:ring-1 focus:ring-[#B8641A]"
  } disabled:opacity-60 disabled:cursor-not-allowed`;

  const selectClass = `${inputClass} appearance-none pr-8 cursor-pointer`;

  const pillActionClass = `text-xs font-semibold px-2 py-1 rounded-md transition inline-flex items-center gap-1 ${
    isDark
      ? "text-[#fbbf24] hover:bg-[#d97706]/10"
      : "text-[#B8641A] hover:bg-[#F5E6D2]/60"
  }`;

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between pb-1 border-b border-inherit">
        <div className="flex items-center gap-2">
          <Building2 size={16} className={isDark ? "text-[#fbbf24]" : "text-[#B8641A]"} />
          <span className="text-xs font-bold uppercase tracking-wider">
            Property & Delivery Location
          </span>
        </div>
        <span className={`text-[11px] font-medium ${isDark ? "text-slate-400" : "text-[#8B7355]"}`}>
          Required for delivery routing
        </span>
      </div>

      {/* LEVEL 1: SOCIETY / PROPERTY */}
      <div>
        <div className="flex items-center justify-between">
          <label className={labelClass}>Society / Property / Colony</label>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsCustomProperty(!isCustomProperty);
              if (!isCustomProperty) {
                emitChange({ property_id: null, property_name: "" });
              }
            }}
            className={pillActionClass}
          >
            {isCustomProperty ? <X size={13} /> : <Plus size={13} />}
            {isCustomProperty ? "Select from list" : "+ Add New Society"}
          </button>
        </div>

        {isCustomProperty ? (
          <input
            type="text"
            disabled={disabled}
            placeholder="Enter Society / Property Name (e.g. Green Valley)"
            value={propertyName}
            onChange={(e) => emitChange({ property_id: null, property_name: e.target.value })}
            className={inputClass}
            autoFocus
          />
        ) : (
          <div className="relative">
            <select
              disabled={disabled || loadingProps}
              value={propertyId || ""}
              onChange={(e) => {
                const selected = propertiesList.find((p) => String(p.id) === e.target.value);
                emitChange({
                  property_id: selected?.id || null,
                  property_name: selected?.name || "",
                  building_id: null,
                  building_name: "",
                  wing_id: null,
                  wing_name: "",
                  floor_id: null,
                  floor_name: "",
                });
              }}
              className={selectClass}
            >
              <option value="">-- Select Society / Property --</option>
              {propertiesList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.city ? `(${p.city})` : ""}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              {loadingProps ? (
                <Loader2 size={15} className="animate-spin text-gray-400" />
              ) : (
                <ChevronDown size={16} className="text-gray-400" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* LEVEL 2: BUILDING / TOWER */}
      <div>
        <div className="flex items-center justify-between">
          <label className={labelClass}>Building / Tower</label>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsCustomBuilding(!isCustomBuilding);
              if (!isCustomBuilding) {
                emitChange({ building_id: null, building_name: "" });
              }
            }}
            className={pillActionClass}
          >
            {isCustomBuilding ? <X size={13} /> : <Plus size={13} />}
            {isCustomBuilding ? "Select from list" : "+ Add New Building"}
          </button>
        </div>

        {isCustomBuilding || (!propertyId && propertyName) || buildingsList.length === 0 ? (
          <input
            type="text"
            disabled={disabled}
            placeholder="e.g. Tower A, Building 1, Jasmine Block"
            value={buildingName}
            onChange={(e) => emitChange({ building_id: null, building_name: e.target.value })}
            className={inputClass}
          />
        ) : (
          <div className="relative">
            <select
              disabled={disabled || loadingBuildings || !propertyId}
              value={buildingId || ""}
              onChange={(e) => {
                const selected = buildingsList.find((b) => String(b.id) === e.target.value);
                emitChange({
                  building_id: selected?.id || null,
                  building_name: selected?.name || "",
                  wing_id: null,
                  wing_name: "",
                  floor_id: null,
                  floor_name: "",
                });
              }}
              className={selectClass}
            >
              <option value="">-- Select Building / Tower --</option>
              {buildingsList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              {loadingBuildings ? (
                <Loader2 size={15} className="animate-spin text-gray-400" />
              ) : (
                <ChevronDown size={16} className="text-gray-400" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* LEVEL 3: WING / BLOCK (OPTIONAL WITH CLEAN TOGGLE) */}
      <div className="pt-1">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            disabled={disabled}
            checked={hasWing}
            onChange={(e) => {
              const checked = e.target.checked;
              emitChange({
                has_wing: checked,
                wing_id: checked ? wingId : null,
                wing_name: checked ? wingName : null,
              });
            }}
            className="w-4 h-4 rounded border-gray-300 text-[#B8641A] focus:ring-[#B8641A] dark:border-gray-600 dark:bg-gray-800"
          />
          <span className="text-xs font-semibold">
            This building has Wings / Blocks / Sections
          </span>
        </label>

        {hasWing && (
          <div className="mt-2.5 pl-6 border-l-2 border-[#E8E2D9] dark:border-[#222B40] space-y-2">
            <div className="flex items-center justify-between">
              <span className={labelClass}>Wing / Block Name</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setIsCustomWing(!isCustomWing);
                  if (!isCustomWing) {
                    emitChange({ wing_id: null, wing_name: "" });
                  }
                }}
                className={pillActionClass}
              >
                {isCustomWing ? <X size={12} /> : <Plus size={12} />}
                {isCustomWing ? "Choose list" : "+ Add New"}
              </button>
            </div>

            {isCustomWing || (!buildingId && buildingName) || wingsList.length === 0 ? (
              <input
                type="text"
                disabled={disabled}
                placeholder="e.g. A, B, East Wing, North Block"
                value={wingName}
                onChange={(e) => emitChange({ wing_id: null, wing_name: e.target.value })}
                className={inputClass}
              />
            ) : (
              <div className="relative">
                <select
                  disabled={disabled || loadingWings}
                  value={wingId || ""}
                  onChange={(e) => {
                    const selected = wingsList.find((w) => String(w.id) === e.target.value);
                    emitChange({
                      wing_id: selected?.id || null,
                      wing_name: selected?.name || "",
                      floor_id: null,
                      floor_name: "",
                    });
                  }}
                  className={selectClass}
                >
                  <option value="">-- Select Wing / Block --</option>
                  {wingsList.map((w) => (
                    <option key={w.id} value={w.id}>
                      Wing {w.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <ChevronDown size={16} className="text-gray-400" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LEVEL 4: FLOOR (EXPLICIT SELECTION) */}
      <div>
        <div className="flex items-center justify-between">
          <label className={labelClass}>
            Floor <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsCustomFloor(!isCustomFloor);
              if (!isCustomFloor) {
                emitChange({ floor_id: null, floor_name: "" });
              }
            }}
            className={pillActionClass}
          >
            {isCustomFloor ? <X size={13} /> : <Plus size={13} />}
            {isCustomFloor ? "Preset floors" : "+ Custom Floor"}
          </button>
        </div>

        {isCustomFloor ? (
          <input
            type="text"
            disabled={disabled}
            placeholder="e.g. 1st Floor, Ground Floor, Terrace"
            value={floorName}
            onChange={(e) => emitChange({ floor_id: null, floor_name: e.target.value })}
            className={inputClass}
          />
        ) : (
          <div className="relative">
            <select
              disabled={disabled || loadingFloors}
              value={floorName || ""}
              onChange={(e) => {
                const val = e.target.value;
                const matchedExisting = floorsList.find((f) => f.name.toLowerCase() === val.toLowerCase());
                emitChange({
                  floor_id: matchedExisting?.id || null,
                  floor_name: val,
                });
              }}
              className={selectClass}
            >
              <option value="">-- Select Floor --</option>
              {/* Combine existing DB floors and common presets */}
              {Array.from(new Set([
                ...floorsList.map((f) => f.name),
                ...PRESET_FLOORS,
              ])).map((floor) => (
                <option key={floor} value={floor}>
                  {floor}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <ChevronDown size={16} className="text-gray-400" />
            </div>
          </div>
        )}
      </div>

      {/* LEVEL 5: UNIT (UNIT TYPE + NUMBER) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <label className={labelClass}>Unit Type</label>
          <div className="relative">
            <select
              disabled={disabled}
              value={unitType}
              onChange={(e) => emitChange({ unit_type: e.target.value })}
              className={selectClass}
            >
              {UNIT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <ChevronDown size={16} className="text-gray-400" />
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass}>
            {unitType} Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            disabled={disabled}
            placeholder={
              unitType === "Flat"
                ? "e.g. 204"
                : unitType === "Shop"
                ? "e.g. Shop 4"
                : "e.g. 101, B-302, 12A"
            }
            value={unitNumber}
            onChange={(e) => emitChange({ unit_number: e.target.value, room_no: e.target.value, roomNo: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
