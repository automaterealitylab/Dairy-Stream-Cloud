import { describe, it, expect } from "vitest";
import {
  getQuantityValue,
  getProductLabel,
  formatQuantity,
  isMilkProduct,
  getWingName,
  getUnitLabel,
  formatFloorName,
  buildBuildingTaskGroups,
  separateBuildingTaskGroups,
  calculateDetailedDeliverySummary,
  getCompactDeliverySummary,
  buildDynamicPropertyHierarchy,
} from "../agentTaskGrouping";


describe("agentTaskGrouping utilities", () => {
  describe("getQuantityValue", () => {
    it("parses numeric values correctly", () => {
      expect(getQuantityValue(5)).toBe(5);
      expect(getQuantityValue("2.5")).toBe(2.5);
      expect(getQuantityValue(" 1.5 Liters ")).toBe(1.5);
    });

    it("returns 0 for invalid or empty inputs", () => {
      expect(getQuantityValue(null)).toBe(0);
      expect(getQuantityValue(undefined)).toBe(0);
      expect(getQuantityValue("abc")).toBe(0);
    });
  });

  describe("getProductLabel", () => {
    it("extracts product name from supported property shapes", () => {
      expect(getProductLabel({ productName: "Buffalo Milk" })).toBe("Buffalo Milk");
      expect(getProductLabel({ milkType: "Cow Milk" })).toBe("Cow Milk");
      expect(getProductLabel({ product: "Paneer" })).toBe("Paneer");
      expect(getProductLabel({ itemName: "Ghee" })).toBe("Ghee");
    });

    it("returns empty string when unknown", () => {
      expect(getProductLabel({})).toBe("");
    });
  });

  describe("formatQuantity", () => {
    it("formats quantity integers and decimals cleanly", () => {
      expect(formatQuantity(2)).toBe("2");
      expect(formatQuantity(1.5)).toBe("1.5");
      expect(formatQuantity(0)).toBe("0");
    });
  });

  describe("isMilkProduct", () => {
    it("detects milk products accurately", () => {
      expect(isMilkProduct({ productName: "Buffalo Milk" })).toBe(true);
      expect(isMilkProduct({ milkType: "Fresh Cow Milk" })).toBe(true);
      expect(isMilkProduct({ product: "Paneer 250g" })).toBe(false);
    });
  });

  describe("buildBuildingTaskGroups & separateBuildingTaskGroups", () => {
    it("correctly identifies active vs completed buildings", () => {
      const deliveries = [
        {
          id: "1",
          buildingName: "Sunrise Heights",
          status: "COMPLETED",
          lat: 18.52,
          lng: 73.85,
        },
        {
          id: "2",
          buildingName: "Sunrise Heights",
          status: "COMPLETED",
          lat: 18.52,
          lng: 73.85,
        },
        {
          id: "3",
          buildingName: "Galaxy Towers",
          status: "COMPLETED",
          lat: 18.53,
          lng: 73.86,
        },
        {
          id: "4",
          buildingName: "Galaxy Towers",
          status: "PENDING",
          lat: 18.53,
          lng: 73.86,
        },
      ];

      const groups = buildBuildingTaskGroups(deliveries);
      expect(groups.length).toBe(2);

      const galaxy = groups.find((g) => g.buildingName === "Galaxy Towers");
      const sunrise = groups.find((g) => g.buildingName === "Sunrise Heights");

      // Galaxy has 1 completed, 1 pending => active (not completed)
      expect(galaxy.isCompleted).toBe(false);
      expect(galaxy.pendingCount).toBe(1);
      expect(galaxy.completedCount).toBe(1);
      expect(galaxy.coordinates).toEqual([18.53, 73.86]);

      // Sunrise has both completed => completed
      expect(sunrise.isCompleted).toBe(true);
      expect(sunrise.pendingCount).toBe(0);
      expect(sunrise.completedCount).toBe(2);

      const { active, completed } = separateBuildingTaskGroups(groups);
      expect(active.length).toBe(1);
      expect(active[0].buildingName).toBe("Galaxy Towers");
      expect(completed.length).toBe(1);
      expect(completed[0].buildingName).toBe("Sunrise Heights");
    });
  });

  describe("parsePacketInfo & calculateDetailedDeliverySummary", () => {
    it("decomposes 1 L milk delivery into 1 L × 1 Packet", () => {
      const delivery = {
        id: "101",
        milkType: "Cow Milk",
        quantity_liters: 1,
      };
      const summary = calculateDetailedDeliverySummary([delivery]);
      expect(summary.totalMilkLiters).toBe(1);
      expect(summary.totalMilkPackets).toBe(1);
      expect(summary.milkTypes.length).toBe(1);
      expect(summary.milkTypes[0].name).toBe("Cow Milk");
      expect(summary.milkTypes[0].breakdown).toEqual([
        { sizeLabel: "1 L", packets: 1, label: "1 L × 1 Packet" },
      ]);
    });

    it("decomposes 4.5 L buffalo milk delivery into 4 packets of 1 L and 1 packet of 500 ml", () => {
      const delivery = {
        id: "102",
        milkType: "Buffalo Milk",
        quantity_liters: 4.5,
      };
      const summary = calculateDetailedDeliverySummary([delivery]);
      expect(summary.totalMilkLiters).toBe(4.5);
      expect(summary.totalMilkPackets).toBe(5);
      expect(summary.milkTypes.length).toBe(1);
      expect(summary.milkTypes[0].name).toBe("Buffalo Milk");
      expect(summary.milkTypes[0].breakdown).toEqual([
        { sizeLabel: "1 L", packets: 4, label: "1 L × 4 Packets" },
        { sizeLabel: "500 ml", packets: 1, label: "500 ml × 1 Packet" },
      ]);
    });

    it("handles multiple customers with different products in the same building independently", () => {
      const deliveries = [
        { id: "c1", customerName: "Abhijeet", flatLabel: "31", milkType: "Cow Milk", quantity_liters: 1, status: "PENDING" },
        { id: "c2", customerName: "Ramesh", flatLabel: "32", milkType: "Buffalo Milk", quantity_liters: 2, status: "PENDING" },
        { id: "c3", customerName: "Pooja", flatLabel: "33", milkType: "Buffalo Milk", quantity_liters: 4.5, status: "PENDING" },
      ];

      const c1Summary = calculateDetailedDeliverySummary([deliveries[0]]);
      const c2Summary = calculateDetailedDeliverySummary([deliveries[1]]);
      const c3Summary = calculateDetailedDeliverySummary([deliveries[2]]);

      expect(c1Summary.totalItemsToCarry).toBe(1);
      expect(c1Summary.milkTypes[0].breakdown[0].label).toBe("1 L × 1 Packet");

      expect(c2Summary.totalItemsToCarry).toBe(2);
      expect(c2Summary.milkTypes[0].breakdown[0].label).toBe("1 L × 2 Packets");

      expect(c3Summary.totalItemsToCarry).toBe(5);
      expect(c3Summary.totalMilkLiters).toBe(4.5);
    });
  });

  describe("buildDynamicPropertyHierarchy", () => {
    it("handles building with NO wings configured (bypasses wing level directly to floors)", () => {
      const deliveries = [
        {
          id: "d1",
          buildingName: "Rajvardan Hostel",
          wing: "",
          roomNo: "Room B01",
          wingOrFloor: "Ground Floor",
          customerName: "Sanjay",
          status: "PENDING",
        },
        {
          id: "d2",
          buildingName: "Rajvardan Hostel",
          wing: null,
          roomNo: "Room 101",
          wingOrFloor: "1st Floor",
          customerName: "Vikas",
          status: "PENDING",
        },
      ];

      const hierarchy = buildDynamicPropertyHierarchy(deliveries);
      expect(hierarchy.hasWings).toBe(false);
      expect(hierarchy.wings).toHaveLength(0);
      expect(hierarchy.floors).toHaveLength(2);
      expect(hierarchy.floors[0].floorLabel).toBe("Ground Floor");
      expect(hierarchy.floors[1].floorLabel).toBe("1st Floor");
      expect(hierarchy.floors[0].units[0].unitLabel).toBe("Room B01");
    });

    it("handles building with custom wing names (Krishna Wing, Shiv Wing)", () => {
      const deliveries = [
        {
          id: "d1",
          buildingName: "Green Valley",
          wing: "Krishna Wing",
          roomNo: "101",
          wingOrFloor: "1",
          customerName: "Abhijeet",
          status: "PENDING",
        },
        {
          id: "d2",
          buildingName: "Green Valley",
          wing: "Shiv Wing",
          roomNo: "201",
          wingOrFloor: "2",
          customerName: "Rahul",
          status: "PENDING",
        },
      ];

      const hierarchy = buildDynamicPropertyHierarchy(deliveries);
      expect(hierarchy.hasWings).toBe(true);
      expect(hierarchy.wings).toHaveLength(2);
      expect(hierarchy.wings.map((w) => w.wingName)).toEqual(["Krishna Wing", "Shiv Wing"]);
    });

    it("propagates completion upward strictly only when all child deliveries complete", () => {
      const deliveries = [
        {
          id: "d1",
          buildingName: "Tower Alpha",
          wing: "Krishna Wing",
          roomNo: "101",
          wingOrFloor: "1",
          customerName: "Abhijeet",
          status: "COMPLETED",
        },
        {
          id: "d2",
          buildingName: "Tower Alpha",
          wing: "Krishna Wing",
          roomNo: "102",
          wingOrFloor: "1",
          customerName: "Karan",
          status: "PENDING",
        },
        {
          id: "d3",
          buildingName: "Tower Alpha",
          wing: "Shiv Wing",
          roomNo: "201",
          wingOrFloor: "2",
          customerName: "Sunil",
          status: "PENDING",
        },
      ];

      const hierarchy = buildDynamicPropertyHierarchy(deliveries);

      // Building is NOT completed
      expect(hierarchy.isCompleted).toBe(false);
      expect(hierarchy.totalCount).toBe(3);
      expect(hierarchy.pendingCount).toBe(2);
      expect(hierarchy.completedCount).toBe(1);

      const krishnaWing = hierarchy.wings.find((w) => w.wingName === "Krishna Wing");
      // Krishna Wing has 1 completed, 1 pending -> NOT completed!
      expect(krishnaWing.isCompleted).toBe(false);
      expect(krishnaWing.pendingCount).toBe(1);

      const floor1 = krishnaWing.floors[0];
      // Floor 1 is NOT completed
      expect(floor1.isCompleted).toBe(false);
      expect(floor1.pendingCount).toBe(1);

      // Unit 101 is COMPLETED
      const unit101 = floor1.units.find((u) => u.unitLabel === "Flat 101");
      expect(unit101.isCompleted).toBe(true);

      // Unit 102 is PENDING
      const unit102 = floor1.units.find((u) => u.unitLabel === "Flat 102");
      expect(unit102.isCompleted).toBe(false);
    });

    it("automatically sorts pending items first and completed items last at unit, floor, and wing levels", () => {
      const deliveries = [
        // Krishna Wing: fully completed
        {
          id: "d1",
          buildingName: "Tower Alpha",
          wing: "Krishna Wing",
          roomNo: "101",
          wingOrFloor: "1",
          customerName: "Abhijeet",
          status: "COMPLETED",
        },
        // Shiv Wing: Floor 1 completed, Floor 2 pending
        {
          id: "d2",
          buildingName: "Tower Alpha",
          wing: "Shiv Wing",
          roomNo: "101",
          wingOrFloor: "1",
          customerName: "Rohan",
          status: "COMPLETED",
        },
        {
          id: "d3",
          buildingName: "Tower Alpha",
          wing: "Shiv Wing",
          roomNo: "201",
          wingOrFloor: "2",
          customerName: "Sunil",
          status: "PENDING",
        },
        // In Shiv Wing Floor 2: Flat 201 is pending, Flat 202 is completed
        {
          id: "d4",
          buildingName: "Tower Alpha",
          wing: "Shiv Wing",
          roomNo: "202",
          wingOrFloor: "2",
          customerName: "Amit",
          status: "COMPLETED",
        },
      ];

      const hierarchy = buildDynamicPropertyHierarchy(deliveries);

      // Wing level sorting: Shiv Wing (has pending) MUST be index 0, Krishna Wing (completed) MUST be index 1
      expect(hierarchy.wings[0].wingName).toBe("Shiv Wing");
      expect(hierarchy.wings[0].isCompleted).toBe(false);
      expect(hierarchy.wings[1].wingName).toBe("Krishna Wing");
      expect(hierarchy.wings[1].isCompleted).toBe(true);

      // Inside Shiv Wing: Floor 2 (pending) MUST be index 0, Floor 1 (completed) MUST be index 1
      const shivFloors = hierarchy.wings[0].floors;
      expect(shivFloors[0].floorLabel).toBe("Floor 2");
      expect(shivFloors[0].isCompleted).toBe(false);
      expect(shivFloors[1].floorLabel).toBe("Floor 1");
      expect(shivFloors[1].isCompleted).toBe(true);

      // Inside Floor 2: Flat 201 (pending) MUST be index 0, Flat 202 (completed) MUST be index 1
      const floor2Units = shivFloors[0].units;
      expect(floor2Units[0].unitLabel).toBe("Flat 201");
      expect(floor2Units[0].isCompleted).toBe(false);
      expect(floor2Units[1].unitLabel).toBe("Flat 202");
      expect(floor2Units[1].isCompleted).toBe(true);
    });
  });

  describe("getCompactDeliverySummary", () => {
    it("formats single milk packet requirement concisely", () => {
      const summary = getCompactDeliverySummary([
        { milkType: "Cow Milk", quantity_liters: 1 },
      ]);
      expect(summary).toBe("Cow Milk • 1 L × 1");
    });

    it("formats multi-liter milk requirement cleanly", () => {
      const summary = getCompactDeliverySummary([
        { milkType: "Buffalo Milk", quantity_liters: 2 },
      ]);
      expect(summary).toBe("Buffalo Milk • 1 L × 2");
    });

    it("formats milk with fractional remainder into packet breakdown", () => {
      const summary = getCompactDeliverySummary([
        { milkType: "Buffalo Milk", quantity_liters: 4.5 },
      ]);
      expect(summary).toBe("Buffalo Milk • 1 L × 4, 500 ml × 1");
    });

    it("formats milk and additional products together cleanly", () => {
      const summary = getCompactDeliverySummary([
        { milkType: "Cow Milk", quantity_liters: 1 },
        { product: "Paneer", sizeLabel: "250g", quantity: 1 },
      ]);
      expect(summary).toBe("Cow Milk • 1 L × 1 • Paneer (250g) × 1");
    });
  });

  describe("Final Acceptance Test (Section 19): 1 Building, 1 Wing, 3 Floors, 30 Customers", () => {
    it("correctly models 30 customers across 3 floors in 1 wing with upward completion and dynamic sorting", () => {
      // 1 Building -> 1 Wing -> 3 Floors (1, 2, 3) -> 10 customers per floor = 30 total
      const deliveries = [];
      for (let floor = 1; floor <= 3; floor++) {
        for (let unit = 1; unit <= 10; unit++) {
          const flatNum = `${floor}0${unit}`;
          deliveries.push({
            id: `del-f${floor}-u${unit}`,
            buildingName: "Galaxy Heights",
            wing: "Wing C",
            wingOrFloor: String(floor),
            roomNo: flatNum,
            customerName: `Customer ${flatNum}`,
            milkType: unit % 2 === 0 ? "Buffalo Milk" : "Cow Milk",
            quantity_liters: unit % 2 === 0 ? 2 : 1,
            status: "PENDING",
          });
        }
      }

      expect(deliveries.length).toBe(30);

      // Initial hierarchy verification
      const hierarchy = buildDynamicPropertyHierarchy(deliveries);

      // 1. Building appears once
      expect(hierarchy.buildingName).toBe("Galaxy Heights");
      expect(hierarchy.totalCount).toBe(30);
      expect(hierarchy.pendingCount).toBe(30);
      expect(hierarchy.completedCount).toBe(0);
      expect(hierarchy.isCompleted).toBe(false);

      // 2. Wing appears once
      expect(hierarchy.hasWings).toBe(true);
      expect(hierarchy.wings.length).toBe(1);
      const wingC = hierarchy.wings[0];
      expect(wingC.wingName).toBe("Wing C");
      expect(wingC.totalCount).toBe(30);
      expect(wingC.pendingCount).toBe(30);
      expect(wingC.isCompleted).toBe(false);

      // 3. 3 Floors appear as sections
      expect(wingC.floors.length).toBe(3);
      wingC.floors.forEach((fl) => {
        expect(fl.units.length).toBe(10);
        expect(fl.pendingCount).toBe(10);
        expect(fl.isCompleted).toBe(false);
      });

      // 4. Verify compact delivery summary on cards
      const cowSummary = getCompactDeliverySummary([deliveries[0]]); // unit 1: Cow Milk, 1L
      expect(cowSummary).toBe("Cow Milk • 1 L × 1");
      const buffaloSummary = getCompactDeliverySummary([deliveries[1]]); // unit 2: Buffalo Milk, 2L
      expect(buffaloSummary).toBe("Buffalo Milk • 1 L × 2");

      // 5. Complete Flat 101: Pending count decreases to 29, completed item moves to the end of Floor 1
      deliveries[0].status = "COMPLETED";
      const step1Hierarchy = buildDynamicPropertyHierarchy(deliveries);
      expect(step1Hierarchy.pendingCount).toBe(29);
      expect(step1Hierarchy.completedCount).toBe(1);
      expect(step1Hierarchy.isCompleted).toBe(false);

      const floor1Units = step1Hierarchy.wings[0].floors[0].units;
      // Flat 101 (now completed) moved to the end of Floor 1's units
      expect(floor1Units[floor1Units.length - 1].unitLabel).toBe("Flat 101");
      expect(floor1Units[floor1Units.length - 1].isCompleted).toBe(true);
      // Parent floor, wing, and building remain NOT complete
      expect(step1Hierarchy.wings[0].floors[0].isCompleted).toBe(false);
      expect(step1Hierarchy.wings[0].isCompleted).toBe(false);
      expect(step1Hierarchy.isCompleted).toBe(false);

      // 6. Complete entire Floor 1 (all 10 customers on Floor 1)
      for (let i = 0; i < 10; i++) {
        deliveries[i].status = "COMPLETED";
      }
      const step2Hierarchy = buildDynamicPropertyHierarchy(deliveries);
      expect(step2Hierarchy.pendingCount).toBe(20);
      expect(step2Hierarchy.completedCount).toBe(10);

      // Floor 1 is now complete and moves to the end of the floors list
      const sortedFloors = step2Hierarchy.wings[0].floors;
      expect(sortedFloors[sortedFloors.length - 1].floorLabel).toBe("Floor 1");
      expect(sortedFloors[sortedFloors.length - 1].isCompleted).toBe(true);

      // Floor 2 and Floor 3 remain pending at top
      expect(sortedFloors[0].floorLabel).toBe("Floor 2");
      expect(sortedFloors[0].isCompleted).toBe(false);
      expect(sortedFloors[1].floorLabel).toBe("Floor 3");
      expect(sortedFloors[1].isCompleted).toBe(false);

      // Wing C and Building still remain NOT complete
      expect(step2Hierarchy.wings[0].isCompleted).toBe(false);
      expect(step2Hierarchy.isCompleted).toBe(false);

      // 7. Complete all 30 deliveries
      deliveries.forEach((d) => {
        d.status = "COMPLETED";
      });
      const finalHierarchy = buildDynamicPropertyHierarchy(deliveries);
      expect(finalHierarchy.pendingCount).toBe(0);
      expect(finalHierarchy.completedCount).toBe(30);
      expect(finalHierarchy.isCompleted).toBe(true);
      expect(finalHierarchy.wings[0].isCompleted).toBe(true);
      finalHierarchy.wings[0].floors.forEach((fl) => {
        expect(fl.isCompleted).toBe(true);
      });
    });
  });
});


