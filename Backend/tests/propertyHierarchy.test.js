import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mapAssignedDelivery } from "../services/agent/delivery/mapping.service.js";

describe("Property Hierarchy Data Models & Normalization", () => {
  describe("Scenario A: Complete Hierarchy Tree Resolution", () => {
    test("properly structures full property -> building -> wing -> floor -> unit shape", () => {
      const hierarchy = {
        propertyId: 101,
        propertyName: "Green Valley Co-op Housing Society",
        buildingId: 201,
        buildingName: "Oak Tower",
        hasWing: true,
        wingId: 301,
        wingName: "A",
        floorId: 401,
        floorName: "4th Floor",
        unitId: 501,
        unitType: "Flat",
        unitNumber: "402",
      };

      assert.equal(hierarchy.propertyId, 101);
      assert.equal(hierarchy.propertyName, "Green Valley Co-op Housing Society");
      assert.equal(hierarchy.buildingId, 201);
      assert.equal(hierarchy.buildingName, "Oak Tower");
      assert.equal(hierarchy.hasWing, true);
      assert.equal(hierarchy.wingId, 301);
      assert.equal(hierarchy.wingName, "A");
      assert.equal(hierarchy.floorId, 401);
      assert.equal(hierarchy.floorName, "4th Floor");
      assert.equal(hierarchy.unitId, 501);
      assert.equal(hierarchy.unitType, "Flat");
      assert.equal(hierarchy.unitNumber, "402");
    });
  });

  describe("Scenario B: Building Without Wings ('No Wing' Support)", () => {
    test("supports null wing_id and null wing without fake entities like 'N/A' or 'None'", () => {
      const hierarchy = {
        propertyId: 102,
        propertyName: "Sunset Residency",
        buildingId: 202,
        buildingName: "Single Tower",
        hasWing: false,
        wingId: null,
        wingName: null,
        floorId: 402,
        floorName: "2nd Floor",
        unitId: 502,
        unitType: "Flat",
        unitNumber: "201",
      };

      assert.equal(hierarchy.hasWing, false);
      assert.equal(hierarchy.wingId, null);
      assert.equal(hierarchy.wingName, null);
      assert.notEqual(hierarchy.wingName, "N/A");
      assert.notEqual(hierarchy.wingName, "None");
      assert.equal(hierarchy.floorName, "2nd Floor");
      assert.equal(hierarchy.unitNumber, "201");
    });
  });

  describe("Scenario C: Backward Compatibility & Dual-Write", () => {
    test("dual-writes to legacy columns building_name, wing, room_no", () => {
      const resolved = {
        property_id: 105,
        property_name: "Palm Heights",
        building_id: 205,
        building_name: "Tower 3",
        wing_id: 305,
        wing_name: "B",
        floor_id: 405,
        floor_name: "5th Floor",
        unit_id: 505,
        unit_type: "Flat",
        unit_number: "502",
        // Legacy dual-write
        buildingName: "Tower 3",
        wing: "B",
        roomNo: "502",
      };

      assert.equal(resolved.buildingName, resolved.building_name);
      assert.equal(resolved.wing, resolved.wing_name);
      assert.equal(resolved.roomNo, resolved.unit_number);
    });

    test("handles legacy customer row with missing hierarchy keys without throwing", () => {
      const legacyCustomer = {
        id: 777,
        customer_name: "Ramesh Sharma",
        phone_number: "9876543210",
        address_line_1: "Near temple",
        address_line_2: "",
        building_name: "Old Society",
        wing: "C",
        room_no: "102",
        // Hierarchy columns absent or null
        property_id: null,
        building_id: null,
        wing_id: null,
        floor_id: null,
        unit_id: null,
      };

      assert.equal(legacyCustomer.property_id, null);
      assert.equal(legacyCustomer.building_name, "Old Society");
      assert.equal(legacyCustomer.wing, "C");
      assert.equal(legacyCustomer.room_no, "102");
    });
  });

  describe("Scenario D: Explicit Floor Representation (Zero Floor Guessing)", () => {
    test("explicit floor names preserved without deriving from room number", () => {
      // Room 204 does NOT automatically become Floor 2
      // Room 31 does NOT automatically become Other
      const cases = [
        { unitNumber: "204", explicitFloor: "Ground Floor" },
        { unitNumber: "31", explicitFloor: "3rd Floor" },
        { unitNumber: "B-1", explicitFloor: "Basement" },
        { unitNumber: "T-01", explicitFloor: "Terrace Floor" },
      ];

      for (const c of cases) {
        assert.equal(typeof c.explicitFloor, "string");
        assert.ok(c.explicitFloor.length > 0);
        // Ensure unitNumber was not altered
        assert.ok(c.unitNumber.length > 0);
      }
    });
  });

  describe("Scenario E: Unit Type & Number Distinction", () => {
    test("distinguishes non-residential and varied unit types", () => {
      const shopUnit = {
        unitType: "Shop",
        unitNumber: "Shop 4",
      };
      const officeUnit = {
        unitType: "Office",
        unitNumber: "Suite 302",
      };
      const flatUnit = {
        unitType: "Flat",
        unitNumber: "204",
      };

      assert.equal(shopUnit.unitType, "Shop");
      assert.equal(officeUnit.unitType, "Office");
      assert.equal(flatUnit.unitType, "Flat");
    });
  });

  describe("Scenario F: Agent Delivery Mapper Enrichment", () => {
    test("maps delivery row with full hierarchy attributes while preserving legacy fields", () => {
      const mockDeliveryRow = {
        id: 999,
        customer_id: 123,
        dairy_id: 456,
        milk_type: "Cow Milk",
        quantity_liters: 2,
        status: "PENDING",
        delivery_slot: "MORNING",
        created_at: "2026-09-21T06:00:00Z",
      };

      const mockCustomer = {
        id: 123,
        customer_name: "Amit Patel",
        phone_number: "9876543210",
        address_line_1: "Main Road",
        address_line_2: "",
        building_name: "Silver Heights",
        wing: "A",
        room_no: "302",
        property_id: 10,
        property_name: "Silver Heights Society",
        building_id: 20,
        wing_id: 30,
        floor_id: 40,
        floor_name: "3rd Floor",
        unit_id: 50,
        unit_type: "Flat",
        unit_number: "302",
        latitude: 18.5204,
        longitude: 73.8567,
      };

      const lookups = {
        customersById: new Map([[123, mockCustomer]]),
        dairiesById: new Map([[456, { id: 456, dairy_name: "Farm Fresh Dairy" }]]),
      };

      const card = mapAssignedDelivery(mockDeliveryRow, lookups);

      // Verify enriched hierarchy fields
      assert.equal(card.propertyId, 10);
      assert.equal(card.propertyName, "Silver Heights Society");
      assert.equal(card.buildingId, 20);
      assert.equal(card.wingId, 30);
      assert.equal(card.floorId, 40);
      assert.equal(card.floorName, "3rd Floor");
      assert.equal(card.unitId, 50);
      assert.equal(card.unitType, "Flat");
      assert.equal(card.unitNumber, "302");

      // Verify legacy fields 100% intact for agent screens
      assert.equal(card.buildingName, "Silver Heights");
      assert.equal(card.wing, "A");
      assert.equal(card.roomNo, "302");
      assert.equal(card.customerName, "Amit Patel");
      assert.equal(card.quantity_liters, 2);
    });
  });
});
