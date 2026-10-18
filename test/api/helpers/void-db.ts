// Test stand-in for Void's virtual `void/db` module.
//
// In production the Void plugin replaces `void/db` with a schema-aware D1
// instance bound to the `DB` binding. Tests alias `void/db` here so route
// handlers run against an in-memory SQLite database instead. `db` is a Proxy
// over a mutable `current` instance (the same technique Void itself uses), so
// each test can install a fresh database without re-loading the module graph.
import {
  and,
  asc,
  avg,
  between,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  max,
  min,
  ne,
  not,
  notBetween,
  notExists,
  notInArray,
  notLike,
  or,
  sql,
  sum,
} from "drizzle-orm";

let current: object | undefined = undefined;

export function __setTestDb(db: object): void {
  current = db;
}

export const db = new Proxy(
  {},
  {
    get(_target, prop: string | symbol) {
      if (current === undefined) {
        throw new Error("void/db: no test database installed — call createTestDb() first.");
      }
      return Reflect.get(current, prop);
    },
  },
);

export {
  and,
  asc,
  avg,
  between,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  max,
  min,
  ne,
  not,
  notBetween,
  notExists,
  notInArray,
  notLike,
  or,
  sql,
  sum,
};
