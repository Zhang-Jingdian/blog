// App-level error carrying an HTTP status. Thrown by route handlers. Void's
// global onError handler invokes `getResponse()` on thrown errors (the Hono
// HTTPException convention), so an AppError turns into its own envelope
// response without passing through the wrapping middleware.
export class AppError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }

  getResponse(): Response {
    return new Response(JSON.stringify({ code: this.status, message: this.message, data: null }), {
      status: this.status,
      headers: { "content-type": "application/json" },
    });
  }
}
