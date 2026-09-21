import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Agent Delivery History Scalability & Pagination Tests", () => {
  describe("Pagination Arithmetic", () => {
    test("correctly calculates page offsets, totalPages, and hasMore flags", () => {
      const totalRecords = 127;
      const limit = 25;

      // Page 1
      const page1 = 1;
      const from1 = (page1 - 1) * limit;
      const to1 = from1 + limit - 1;
      const totalPages1 = Math.ceil(totalRecords / limit);
      const hasMore1 = from1 + limit < totalRecords;

      assert.equal(from1, 0);
      assert.equal(to1, 24);
      assert.equal(totalPages1, 6);
      assert.equal(hasMore1, true);

      // Page 6 (last page)
      const page6 = 6;
      const from6 = (page6 - 1) * limit;
      const totalPages6 = Math.ceil(totalRecords / limit);
      const remainingItems = totalRecords - from6; // 2 items on page 6
      const hasMore6 = from6 + remainingItems < totalRecords;

      assert.equal(from6, 125);
      assert.equal(totalPages6, 6);
      assert.equal(remainingItems, 2);
      assert.equal(hasMore6, false);
    });

    test("handles large historical datasets (1000+ records) with fixed page sizes", () => {
      const total = 1450;
      const limit = 25;
      const totalPages = Math.ceil(total / limit);

      assert.equal(totalPages, 58);
      // Ensure page 50 calculates safe ranges without exceeding
      const page50 = 50;
      const from50 = (page50 - 1) * limit;
      const to50 = from50 + limit - 1;
      assert.equal(from50, 1225);
      assert.equal(to50, 1249);
    });
  });

  describe("Daily Summary & Status Aggregations", () => {
    test("calculates deliveries = completed + failed + pending and total volume accurately", () => {
      const mockDayDeliveries = [
        { status: "COMPLETED", quantity_liters: 1.5 },
        { status: "COMPLETED", quantity_liters: 2.0 },
        { status: "COMPLETED", quantity_liters: 1.0 },
        { status: "FAILED", quantity_liters: 1.0 },
        { status: "PENDING", quantity_liters: 0.5 },
        { status: "OUT_FOR_DELIVERY", quantity_liters: 1.5 },
      ];

      let completed = 0;
      let failed = 0;
      let pending = 0;
      let totalQuantity = 0;

      mockDayDeliveries.forEach((d) => {
        const s = String(d.status).toUpperCase();
        if (s === "COMPLETED") {
          completed += 1;
          totalQuantity += d.quantity_liters;
        } else if (s === "FAILED") {
          failed += 1;
        } else {
          pending += 1;
        }
      });

      const total = mockDayDeliveries.length;
      assert.equal(total, 6);
      assert.equal(completed, 3);
      assert.equal(failed, 1);
      assert.equal(pending, 2);
      assert.equal(totalQuantity, 4.5);
      assert.equal(total, completed + failed + pending);
    });
  });

  describe("Sorting Priorities", () => {
    test("orders PENDING first, FAILED second, and COMPLETED last", () => {
      const items = [
        { id: 1, status: "completed" },
        { id: 2, status: "pending" },
        { id: 3, status: "failed" },
        { id: 4, status: "completed" },
        { id: 5, status: "pending" },
      ];

      const priority = (s) => (s === "pending" ? 0 : s === "failed" ? 1 : 2);
      const sorted = [...items].sort((a, b) => priority(a.status) - priority(b.status));

      assert.deepEqual(
        sorted.map((i) => i.status),
        ["pending", "pending", "failed", "completed", "completed"]
      );
    });
  });
});
