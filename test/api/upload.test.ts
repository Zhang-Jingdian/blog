import { describe, expect, it } from "vite-plus/test";
import { AppError } from "../../apps/api/src/lib/error.ts";
import {
  matchesImageMagic,
  parseUploadedImage,
  toUploadItem,
} from "../../apps/api/src/lib/upload.ts";

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

describe("toUploadItem", () => {
  it("maps a DB row to the API shape", () => {
    const row = {
      key: "file-abc.png",
      size: 42,
      contentType: "image/png",
      postId: 7,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };
    expect(toUploadItem(row)).toEqual({
      key: "file-abc.png",
      size: 42,
      uploaded: "2026-01-01T00:00:00.000Z",
      contentType: "image/png",
      postId: 7,
    });
  });

  it("keeps null postId for unassigned files", () => {
    const row = {
      key: "file-abc.png",
      size: 42,
      contentType: "image/png",
      postId: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };
    expect(toUploadItem(row).postId).toBe(null);
  });
});

describe("parseUploadedImage", () => {
  function expectAppError(fn: () => unknown, status: number, message: string) {
    let caught: unknown;
    try {
      fn();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).status).toBe(status);
    expect((caught as AppError).message).toBe(message);
  }

  it("parses a valid image and returns its normalized type and extension", () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    expect(parseUploadedImage("image/png", png.buffer)).toEqual({
      contentType: "image/png",
      ext: "png",
    });
  });

  it("strips charset and parameters from the content type", () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    expect(parseUploadedImage("image/png; charset=utf-8", png.buffer).contentType).toBe(
      "image/png",
    );
  });

  it("rejects an unsupported content type", () => {
    expectAppError(
      () => parseUploadedImage("text/html", new ArrayBuffer(4)),
      415,
      "Unsupported image type",
    );
  });

  it("rejects an empty body", () => {
    expectAppError(() => parseUploadedImage("image/png", new ArrayBuffer(0)), 400, "Empty file");
  });

  it("rejects a body larger than 5 MB", () => {
    expectAppError(
      () => parseUploadedImage("image/png", new ArrayBuffer(5 * 1024 * 1024 + 1)),
      413,
      "Image too large",
    );
  });

  it("rejects content that does not match its declared type", () => {
    const notPng = bytes(0xff, 0xd8, 0xff);
    expectAppError(
      () => parseUploadedImage("image/png", notPng.buffer),
      415,
      "File content does not match its declared image type",
    );
  });
});
