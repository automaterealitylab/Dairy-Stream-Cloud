import { describe, it, expect } from "vitest";
import {
  getQuantityValue,
  getProductLabel,
  formatQuantity,
  isMilkProduct,
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
});
