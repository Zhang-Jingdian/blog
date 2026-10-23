// Image upload validation: allowed content types and their magic-number checks.
// The magic bytes verify the body actually matches the declared content type,
// so a spoofed `Content-Type` header alone cannot store arbitrary bytes.

export const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

function hasPrefix(bytes: Uint8Array, start: number, text: string): boolean {
  if (bytes.length < start + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[start + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

// Signature checks over the leading bytes of each format.
const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  "image/png": (b) => hasPrefix(b, 0, "\x89PNG\r\n\x1a\n"),
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => hasPrefix(b, 0, "RIFF") && hasPrefix(b, 8, "WEBP"),
  "image/gif": (b) => hasPrefix(b, 0, "GIF87a") || hasPrefix(b, 0, "GIF89a"),
  "image/avif": (b) => hasPrefix(b, 4, "ftypavif"),
  // SVG is XML text, not a binary format: accept a leading XML declaration or
  // the `<svg` root element (after an optional BOM/whitespace).
  "image/svg+xml": (b) => {
    const text = new TextDecoder().decode(b.slice(0, 128));
    const trimmed = text.replace(/^\uFEFF/, "").trimStart();
    return trimmed.startsWith("<svg") || trimmed.startsWith("<?xml");
  },
};

// Returns true when the body's leading bytes match the declared content type.
export function matchesImageMagic(contentType: string, bytes: Uint8Array): boolean {
  const check = MAGIC[contentType];
  return check ? check(bytes) : false;
}
