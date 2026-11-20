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

    test("normalizes PREMIUM plan key to PRIME alias", async () => {
      const { normalizePlatformPlanKey, getPlatformPlan } = await import("../services/common/platformPlan.service.js");
      assert.equal(normalizePlatformPlanKey("PREMIUM"), "PRIME");
      assert.equal(normalizePlatformPlanKey("premium"), "PRIME");
      assert.equal(normalizePlatformPlanKey("GROWTH"), "GROWTH");
      assert.equal(normalizePlatformPlanKey("STARTER"), "STARTER");

      const premiumPlan = await getPlatformPlan("PREMIUM");
      assert.ok(premiumPlan, "PREMIUM plan should resolve");
      assert.ok(premiumPlan.features.includes("procurement"), "PREMIUM plan must include procurement");
      assert.ok(premiumPlan.features.includes("suppliers"), "PREMIUM plan must include suppliers");
    });

    test("getPlanFeatures resolves features for PREMIUM tier", async () => {
      const { getPlanFeatures } = await import("../middleware/adminPlan.middleware.js");
      const features = await getPlanFeatures("PREMIUM");
      assert.ok(Array.isArray(features));
      assert.ok(features.includes("procurement"));
      assert.ok(features.includes("suppliers"));
      assert.ok(features.includes("performance"));
    });
  });
});