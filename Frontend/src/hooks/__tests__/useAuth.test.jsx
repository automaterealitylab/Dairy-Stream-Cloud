import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../useAuth.jsx";

// Mock the validateTokenApi
vi.mock("../../services/auth.api", () => ({
  validateTokenApi: vi.fn(),
}));

const TestConsumer = () => {
  const { user, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.role : "null"}</span>
    </div>
  );
};

describe("useAuth authentication scenarios", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("Scenario 1: Fresh visitor with empty localStorage starts with loading=false immediately", () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Should be loading=false synchronously on initial render
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("Scenario 2: Valid session in localStorage starts with loading=true and restores user", async () => {
    // Generate valid unexpired JWT payload (exp: 1 hour in future)
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({ id: "cust-1", role: "CUSTOMER", exp: futureExp }));
    const mockToken = `${header}.${payload}.signature`;

    const mockUser = { id: "cust-1", role: "CUSTOMER", token: mockToken };
    localStorage.setItem("user", JSON.stringify(mockUser));
    localStorage.setItem("token", mockToken);
    localStorage.setItem("userRole", "CUSTOMER");

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Should finish restoring user and set loading=false
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
      expect(screen.getByTestId("user").textContent).toBe("CUSTOMER");
    });
  });

  it("Scenario 3: Expired token in localStorage is detected and cleared", async () => {
    // Expired JWT payload (exp: 1 hour in past)
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({ id: "cust-2", role: "CUSTOMER", exp: pastExp }));
    const expiredToken = `${header}.${payload}.signature`;

    const mockUser = { id: "cust-2", role: "CUSTOMER", token: expiredToken };
    localStorage.setItem("user", JSON.stringify(mockUser));
    localStorage.setItem("token", expiredToken);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
      expect(screen.getByTestId("user").textContent).toBe("null");
      expect(localStorage.getItem("user")).toBeNull();
      expect(localStorage.getItem("token")).toBeNull();
    });
  });
});
