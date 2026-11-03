import Link from "next/link";
import { Arrow, buttonClasses } from "@/components/Button";
import { Card } from "@/components/Card";
import { State } from "@/components/State";
import { TryAgain } from "./TryAgain";

/** Shown when the server has no database connection string. Plain words first; the setting's name is for Tyler. */
export function NotConfigured() {
  return (
    <Card className="max-w-[640px]">
      <State kind="note">Money isn’t set up on this site yet.</State>
      <p className="mt-3 text-body text-ink-2">Tyler needs to finish setting it up.</p>
      <details className="group mt-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-small text-ink-2 hover:text-ink"><span aria-hidden="true" className="mr-1.5 inline-block transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none">›</span>For Tyler</summary>
        <p className="mt-1 text-small text-ink-2">
          The site needs <code className="font-mono">MONEY_DATABASE_URL</code> in Vercel. Setup steps are in{" "}
          <code className="font-mono">docs/MONEY.md</code>.
        </p>
      </details>
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
      <TryAgain className="mt-4" />
    </Card>
  );
}
