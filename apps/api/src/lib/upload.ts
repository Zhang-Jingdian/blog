// Upload validation: allowed types verified by magic bytes, not just the Content-Type header.
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

export function matchesImageMagic(contentType: string, bytes: Uint8Array): boolean {
  const check = MAGIC[contentType];
  return check ? check(bytes) : false;
}

export interface UploadObject {
  key: string;
  size: number;
  uploaded: Date;
  contentType?: string | null;
}

export interface UploadItem {
  key: string;
  size: number;
  uploaded: string;
  contentType: string | null;
}

// Sort newest-first and paginate (R2 lists keys lexicographically, not by upload order).
export function paginateUploads(
  objects: UploadObject[],
  page: number,
  pageSize: number,
): { items: UploadItem[]; page: number; pageSize: number; total: number; totalPages: number } {
  const sorted = [...objects].sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime());
  const total = sorted.length;
  const start = (page - 1) * pageSize;
  const items = sorted.slice(start, start + pageSize).map((o) => ({
    key: o.key,
    size: o.size,
    uploaded: o.uploaded.toISOString(),
    contentType: o.contentType ?? null,
  }));
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
