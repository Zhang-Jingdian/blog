// Return a copy of `response` with extra headers merged in. Used where a response
// is rebuilt (the CORS middleware, error responses) and the original headers must
// survive: `new Response(body, init)` silently drops them otherwise.
export function withHeaders(response: Response, headers: Record<string, string>): Response {
  const merged = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) merged.set(key, value);
  return new Response(response.body, { status: response.status, headers: merged });
}
