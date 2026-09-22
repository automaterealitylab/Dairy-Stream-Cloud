import { describe, test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";

const {
  calculateDeliveryAmount,
  resolveDeliveryAmountForPersistence,
  resolveDeliveryUnitPrice,
  withPersistedDeliveryAmount,
} = await import("../services/shared/deliveryCharge.service.js");

describe("Delivery Charge Persistence Foundation", () => {
  test("calculates 1.5L x Rs 57 as Rs 85.50", () => {
    assert.equal(
      calculateDeliveryAmount({ quantityLiters: 1.5, unitPrice: 57 }),
      85.5
    );
  });

  test("rounds decimal quantity and rate to exactly two money decimals", () => {
    const amount = calculateDeliveryAmount({ quantityLiters: 1.333, unitPrice: 57.777 });

    assert.equal(amount, 77.02);
    assert.equal(Number.isInteger(amount * 100), true);
  });

  test("uses delivery.notes unit_price when present", async () => {
    const amount = await resolveDeliveryAmountForPersistence(
      {
        quantity_liters: 2,
        notes: "payment=MONTHLY_BILL; unit_price=42.25",
      },
      {
        rateLookup: async () => {
          throw new Error("product rate lookup should not be used when notes unit_price exists");
        },
      }
    );

    assert.equal(amount, 84.5);
  });

  test("uses product rate fallback only when notes rate is absent", async () => {
    const unitPrice = await resolveDeliveryUnitPrice(
      {
        dairy_id: 101024,
        milk_type: "1 Milk",
        notes: "payment=MONTHLY_BILL",
      },
      {
        rateLookup: async ({ dairyId, milkType }) => {
          assert.equal(dairyId, 101024);
          assert.equal(milkType, "1 Milk");
          return 57;
        },
      }
    );

    assert.equal(unitPrice, 57);
  });

  test("does not allow a client-provided delivery amount to override server calculation", async () => {
    const payload = await withPersistedDeliveryAmount(
      {
        customer_id: 26,
        quantity_liters: 1.5,
        delivery_amount: 9999,
        notes: "unit_price=57",
      },
      {
        rateLookup: async () => 0,
      }
    );

    assert.equal(payload.delivery_amount, 85.5);
  });

  test("preserves existing delivery creation payload apart from adding calculated charge", async () => {
    const payload = await withPersistedDeliveryAmount(
      {
        customer_id: 26,
        dairy_id: 101024,
        delivery_date: "2026-09-21",
        milk_type: "1 Milk",
        quantity_liters: 1.5,
        status: "PENDING",
        notes: "unit_price=57",
      },
      {
        rateLookup: async () => {
          throw new Error("notes unit_price should be authoritative");
        },
      }
    );

    assert.equal(payload.status, "PENDING");
    assert.equal(payload.milk_type, "1 Milk");
    assert.equal(payload.delivery_amount, 85.5);
  });

  test("does not silently assign today's product rate when no authoritative rate is available", async () => {
    const payload = await withPersistedDeliveryAmount(
      {
        customer_id: 26,
        dairy_id: 101024,
        delivery_date: "2026-06-01",
        milk_type: "1 Milk",
        quantity_liters: 1.5,
        status: "COMPLETED",
        notes: "[LEGACY_DELIVERY]",
      },
      {
        rateLookup: async () => null,
      }
    );

    assert.equal(Object.hasOwn(payload, "delivery_amount"), false);
  });
});
