import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./api-client";

describe("apiRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves meta when the API returns a data envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [{ id: "listing-1" }],
        meta: {
          total: 1,
          listingIds: ["listing-1"]
        }
      })
    } as Response);

    const result = await apiRequest<{
      data: Array<{ id: string }>;
      meta: {
        total: number;
        listingIds: string[];
      };
    }>("/favorites");

    expect(result.meta.listingIds).toEqual(["listing-1"]);
    expect(result.data).toHaveLength(1);
  });

  it("unwraps direct data payloads when no extra envelope fields are present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: "listing-1",
          title: "Creator asset"
        }
      })
    } as Response);

    const result = await apiRequest<{ id: string; title: string }>("/listings/creator-asset");

    expect(result).toEqual({
      id: "listing-1",
      title: "Creator asset"
    });
  });
});
