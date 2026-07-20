import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LoadingIndicator from "../LoadingIndicator";

describe("LoadingIndicator component", () => {
  it("renders inline skeleton layout by default", () => {
    const { container } = render(<LoadingIndicator />);
    expect(container.firstChild).toBeDefined();
    expect(container.firstChild.className).toContain("animate-pulse");
  });

  it("renders fullScreen layout when fullScreen prop is true", () => {
    const { container } = render(<LoadingIndicator fullScreen={true} />);
    expect(container.firstChild.className).toContain("min-h-screen");
  });
});
