// Shapes shared by the public API (apps/website) and the admin API
// (apps/admin). They describe the response wrapper only — the payload types
// differ per surface, so they stay in each app.
export interface Envelope<T> {
  code: number;
  message: string;
  data: T;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
