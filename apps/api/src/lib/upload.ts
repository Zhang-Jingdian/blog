import { AppError } from "./error.ts";

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

// Validate an uploaded image from its declared content type and raw bytes,
// returning the normalized content type and file extension. Throws AppError on
// an unsupported type, empty body, oversized body, or mismatched signature.
export function parseUploadedImage(
  rawContentType: string,
  bytes: Uint8Array,
): { contentType: string; ext: string } {
  const contentType = rawContentType.split(";")[0]?.trim().toLowerCase() ?? "";
  const ext = IMAGE_EXT[contentType];
  if (!ext) throw new AppError(415, "Unsupported image type");
  if (bytes.byteLength === 0) throw new AppError(400, "Empty file");
  if (bytes.byteLength > MAX_SIZE) throw new AppError(413, "Image too large");
  if (!matchesImageMagic(contentType, bytes)) {
    throw new AppError(415, "File content does not match its declared image type");
  }
  return { contentType, ext };
}

// Read a request body while enforcing the size cap, so an oversized upload is
// aborted as soon as it crosses the limit instead of being buffered first. A
// Worker only has 128 MB of memory, so a 200 MB body would OOM long before the
// size check in parseUploadedImage() could reject it.
export async function readBodyLimited(
  body: ReadableStream<Uint8Array> | null,
  limit: number = MAX_SIZE,
): Promise<Uint8Array> {
  if (!body) return new Uint8Array();

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new AppError(413, "Image too large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

// Read an image upload without ever buffering more than MAX_SIZE. The declared
// Content-Length is checked first because it costs nothing; readBodyLimited()
// then enforces the same cap for chunked bodies that have no length header.
export async function readImageBody(req: {
  header(name: string): string | undefined;
  raw: { body: ReadableStream<Uint8Array> | null };
}): Promise<Uint8Array> {
  const declared = Number(req.header("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_SIZE) {
    throw new AppError(413, "Image too large");
  }
  return readBodyLimited(req.raw.body);
}

export interface UploadItem {
  key: string;
  size: number;
  uploaded: string;
  contentType: string | null;
  postId: number | null;
}

// Map a DB row (from the `upload` table) to the shape returned by the API.
export function toUploadItem(row: {
  key: string;
  size: number;
  contentType: string;
  postId: number | null;
  createdAt: Date;
}): UploadItem {
  return {
    key: row.key,
    size: row.size,
    uploaded: row.createdAt.toISOString(),
    contentType: row.contentType,
    postId: row.postId,
  };
}
