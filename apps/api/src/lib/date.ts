// Serialize a millisecond timestamp column (Drizzle `timestamp_ms`, read back
// as a Date) into the ISO 8601 UTC string the API contract requires.
export function iso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}
