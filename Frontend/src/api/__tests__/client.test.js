import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { fetchCsrfToken, clearCsrfTokenCache } from "../client.js";

describe("CSRF In-Memory Caching & Latency Optimization", () => {
  beforeEach(() => {
    clearCsrfTokenCache();
    vi.restoreAllMocks();
  });

  it("fetches CSRF token over network on first call and caches it in memory", async () => {
    const getSpy = vi.spyOn(axios, "get").mockResolvedValueOnce({
      data: { csrfToken: "mock-csrf-token-123" },
    });

    const token1 = await fetchCsrfToken();
    expect(token1).toBe("mock-csrf-token-123");
    expect(getSpy).toHaveBeenCalledTimes(1);

    // Second call should return cached token immediately without network call
    const token2 = await fetchCsrfToken();
    expect(token2).toBe("mock-csrf-token-123");
    expect(getSpy).toHaveBeenCalledTimes(1); // Still 1, 0 network overhead
  });

  it("forces network refresh when forceRefresh=true", async () => {
    const getSpy = vi
      .spyOn(axios, "get")
      .mockResolvedValueOnce({
        data: { csrfToken: "initial-token" },
      })
      .mockResolvedValueOnce({
        data: { csrfToken: "refreshed-token" },
      });

    const token1 = await fetchCsrfToken();
    expect(token1).toBe("initial-token");
    expect(getSpy).toHaveBeenCalledTimes(1);

    const token2 = await fetchCsrfToken(true);
    expect(token2).toBe("refreshed-token");
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it("clears cached token with clearCsrfTokenCache()", async () => {
    const getSpy = vi
      .spyOn(axios, "get")
      .mockResolvedValueOnce({
        data: { csrfToken: "token-1" },
      })
      .mockResolvedValueOnce({
        data: { csrfToken: "token-2" },
      });

    await fetchCsrfToken();
    expect(getSpy).toHaveBeenCalledTimes(1);

    clearCsrfTokenCache();

    const token2 = await fetchCsrfToken();
    expect(token2).toBe("token-2");
    expect(getSpy).toHaveBeenCalledTimes(2);
  });
});

