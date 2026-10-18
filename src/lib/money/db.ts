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
  // Supabase's transaction pooler doesn't support prepared statements; one connection per
  // serverless instance is plenty for a household.
  g.__moneySql ??= postgres(url, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
    types: { numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) } },
  });
  return g.__moneySql;
}

export const isConfigured = () => Boolean(process.env.MONEY_DATABASE_URL);
