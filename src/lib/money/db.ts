import "server-only";
import postgres from "postgres";

/**
 * The money tracker's database: the `money` schema in the Supabase project, reached as the
 * `money_app` role (the only role with access; CampHawk's keys can't read it). The connection
 * string is MONEY_DATABASE_URL, set in Vercel as Sensitive. Never logged, never shown.
 */

export class MoneyNotConfigured extends Error {
  constructor() {
    super("MONEY_DATABASE_URL is not set");
  }
}

type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __moneySql?: Sql };

export function sql(): Sql {
  const url = process.env.MONEY_DATABASE_URL;
  if (!url) throw new MoneyNotConfigured();
  // Supabase's transaction pooler (Supavisor) supports neither prepared statements nor
  // PIPELINING: two queries sent on one connection before the first answers stall there for ever
  // (measured 2026-10-18: Promise.all of three reads on max:1 hung every page for 300 s while a
  // single read answered at once). postgres.js only pipelines when every connection is busy, so
  // allow several connections, and callers still read one query at a time where they can.
  g.__moneySql ??= postgres(url, {
    prepare: false,
    max: 8,
    idle_timeout: 20,
    connect_timeout: 10,
    // Supabase requires TLS. `sslmode=disable` is only for the local test database (scripts/).
    ssl: /[?&]sslmode=disable\b/.test(url) ? false : "require",
    types: { numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) } },
  });
  return g.__moneySql;
}

export const isConfigured = () => Boolean(process.env.MONEY_DATABASE_URL);
