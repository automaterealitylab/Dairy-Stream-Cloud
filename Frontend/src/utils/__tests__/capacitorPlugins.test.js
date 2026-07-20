import { describe, it, expect, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

// Mock Capacitor Native Geolocation plugin
vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    getCurrentPosition: vi.fn().mockResolvedValue({
      coords: {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 1700000000000,
    }),
    requestPermissions: vi.fn().mockResolvedValue({
      location: "granted",
    }),
  },
}));

describe("Capacitor Android Native Plugins & Platform Unit Tests", () => {
  describe("Capacitor Platform Utility Checks", () => {
    it("reports correct native platform state", () => {
      // By default in Vitest / jsdom environment, it runs in web mode
      const platform = Capacitor.getPlatform();
      expect(typeof platform).toBe("string");
      expect(["web", "android", "ios"]).toContain(platform);
    });

    it("verifies isNativePlatform helper returns boolean", () => {
      const isNative = Capacitor.isNativePlatform();
      expect(typeof isNative).toBe("boolean");
    });
  });

  describe("@capacitor/geolocation Android GPS Plugin Mocks", () => {
    it("successfully fetches mock GPS coordinates for delivery agent tracking", async () => {
      const position = await Geolocation.getCurrentPosition();
      expect(position).toBeDefined();
      expect(position.coords.latitude).toBe(12.9716);
      expect(position.coords.longitude).toBe(77.5946);
    });

    it("requests location permissions cleanly on Android device startup", async () => {
      const permission = await Geolocation.requestPermissions();
      expect(permission).toBeDefined();
      expect(permission.location).toBe("granted");
    });
  });
});
