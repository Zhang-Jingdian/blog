import { describe, expect, it } from "vite-plus/test";
import { matchesImageMagic } from "../../apps/api/src/lib/upload.ts";

function bytes(...nums: number[]): Uint8Array {
  return new Uint8Array(nums);
}

function asciiBytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
  return out;
}

describe("matchesImageMagic", () => {
  it("accepts a PNG signature", () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);
    expect(matchesImageMagic("image/png", png)).toBe(true);
  });

  it("accepts a JPEG signature", () => {
    expect(matchesImageMagic("image/jpeg", bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(true);
  });

  it("accepts a WEBP signature", () => {
    const webp = bytes(...asciiBytes("RIFF"), 0, 0, 0, 0, ...asciiBytes("WEBP"));
    expect(matchesImageMagic("image/webp", webp)).toBe(true);
  });

  it("accepts a GIF signature", () => {
    expect(matchesImageMagic("image/gif", bytes(...asciiBytes("GIF89a")))).toBe(true);
  });

  it("accepts an AVIF signature", () => {
    const avif = bytes(0, 0, 0, 0, ...asciiBytes("ftypavif"));
    expect(matchesImageMagic("image/avif", avif)).toBe(true);
  });

  it("accepts an SVG root element", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(matchesImageMagic("image/svg+xml", svg)).toBe(true);
  });

  it("rejects content that does not match the declared type", () => {
    expect(matchesImageMagic("image/png", bytes(0xff, 0xd8, 0xff))).toBe(false);
    expect(matchesImageMagic("image/jpeg", bytes(0x89, 0x50))).toBe(false);
  });

  it("rejects unknown content types", () => {
    expect(matchesImageMagic("text/html", bytes(...asciiBytes("<html>")))).toBe(false);
  });
});
