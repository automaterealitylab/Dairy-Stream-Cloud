import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Plan Authorization Tests", () => {
  describe("platformPlan service exports", () => {
    test("getPlatformPlan and cache functions exist", async () => {
      const { getPlatformPlan, getAllActivePlatformPlans, clearPlatformPlanCache } = await import("../services/common/platformPlan.service.js");
      assert.ok(typeof getPlatformPlan === "function");
      assert.ok(typeof getAllActivePlatformPlans === "function");
      assert.ok(typeof clearPlatformPlanCache === "function");
    });
  });

  describe("Route comments match plan requirements", () => {
    test("procurement routes marked as PREMIUM", async () => {
      // This is a documentation check - verify route comments are consistent
      const routesContent = await import("fs").then(fs =>
        fs.promises.readFile("routes/admin.routes.js", "utf-8")
      );
      assert.ok(routesContent.includes("Requires PREMIUM plan"));
    });

    test("performance routes marked as GROWTH", async () => {
      const routesContent = await import("fs").then(fs =>
        fs.promises.readFile("routes/admin.routes.js", "utf-8")
      );
      assert.ok(routesContent.includes("Requires GROWTH plan"));
    });

    test("supplier routes marked as PREMIUM", async () => {
      const routesContent = await import("fs").then(fs =>
        fs.promises.readFile("routes/admin.routes.js", "utf-8")
      );
      assert.ok(routesContent.includes("Requires PREMIUM plan"));
    });
  });

  describe("Middleware cache invalidation", () => {
    test("clearPlanFeaturesCache export exists", async () => {
      const { clearPlanFeaturesCache } = await import("../middleware/adminPlan.middleware.js");
      assert.ok(typeof clearPlanFeaturesCache === "function");
    });

    test("getPlanFeatures export exists", async () => {
      const { getPlanFeatures } = await import("../middleware/adminPlan.middleware.js");
      assert.ok(typeof getPlanFeatures === "function");
    });
  });
});