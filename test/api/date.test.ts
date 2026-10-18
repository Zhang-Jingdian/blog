import { describe, expect, it } from "vite-plus/test";
import { iso } from "../../apps/api/src/lib/date.ts";

describe("iso", () => {
  it("serializes a Date to an ISO UTC string", () => {
    expect(iso(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01T00:00:00.000Z");
  });

  it("passes null through", () => {
    expect(iso(null)).toBeNull();
  });
});
