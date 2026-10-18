import Link from "next/link";
import { Arrow, buttonClasses } from "@/components/Button";
import { Card } from "@/components/Card";
import { State } from "@/components/State";

/** Shown when the server has no database connection string. */
export function NotConfigured() {
  return (
    <Card className="max-w-[640px]">
      <State kind="note">The money database isn’t connected to this site yet.</State>
      <p className="mt-3 text-body text-ink-2">
        The site needs <code className="font-mono text-small">MONEY_DATABASE_URL</code> in Vercel. Setup steps are in{" "}
        <code className="font-mono text-small">docs/MONEY.md</code>.
      </p>
    </Card>
  );
}

/** Shown when the database works but no bank connection is saved. */
export function NotConnected() {
  return (
    <Card className="max-w-[640px]">
      <h2 className="text-h3 font-medium">Connect your banks</h2>
      <p className="mt-2 text-body text-ink-2">
        Link Chase and U.S. Bank at SimpleFIN Bridge, then paste the setup token here. Transactions arrive once a day after that.
      </p>
      <Link href="/private/money/settings" className={buttonClasses("primary", "mt-5")}>
        Connect <Arrow />
      </Link>
    </Card>
  );
}

/** Shown when the database didn't answer. No details: they'd be internals. */
export function Unreachable() {
  return (
    <Card className="max-w-[640px]">
      <State kind="wrong">Couldn’t reach the money database. Try again in a minute.</State>
    </Card>
  );
}
