"use client";

import { buttonClasses } from "../../ui";
import { LabBar } from "../../LabBar";
import { LabSelect } from "../AppParts";
import { ROUTES } from "../gates";
import { GhFooter, ScreenLinks } from "../GhChrome";
import { useUrlState, useVisitor, withVisitor } from "../labState";

// CampHawk's not-found, error and global-error screens (campsite-finder src/app/not-found.tsx,
// error.tsx, global-error.tsx), in the Golden hour look. The lab's catch-all route shows the
// not-found one for any unknown lab address.
// Lab changes, from CampHawk's own rules: words lead, not "404" (never show a user our
// internals); the badge and forest stand in for the off-palette cream page; "Try again" and
// "Back to home" are neutral buttons, not action green (they don't get you a site); the error
// screen names the support address its "please reach out" pointed nowhere.

type Kind = "not-found" | "error" | "global";

function Badge() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/private/camphawk/round2/badge-golden-120.webp" alt="CampHawk" width={72} height={72} className="size-[72px]" />
  );
}

export function ErrorScreen({ kind }: { kind: Kind }) {
  const [visitor] = useVisitor();
  if (kind === "global") {
    // The global error replaces the whole document: no app fonts or chrome may be available, so
    // CampHawk draws it in system type. The lab keeps that plainness, in its tokens.
    return (
      <div className="grid h-full min-h-[70vh] place-items-center bg-ch-paper px-5 py-16 text-center font-sans">
        <div className="max-w-[24rem]">
          <h1 className="text-[24px] font-extrabold text-ch-ink">CampHawk hit an error</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-ch-ink-2">Something went wrong loading the app. Please try again.</p>
          <button type="button" onClick={() => window.location.reload()} className={buttonClasses({ variant: "quiet", className: "mt-6 px-6" })}>Try again</button>
        </div>
      </div>
    );
  }
  const notFound = kind === "not-found";
  return (
    <div className="grid h-full min-h-[70vh] place-items-center bg-ch-forest px-5 py-16 text-center">
      <div className="max-w-[34rem]">
        <div className="flex justify-center"><Badge /></div>
        <h1 className="mt-6 text-balance font-ch-display text-[clamp(32px,5vw,48px)] font-extrabold leading-tight tracking-[-.02em] text-ch-paper">
          {notFound ? "This trail doesn’t lead anywhere" : "Something went wrong"}
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed text-ch-line">
          {notFound
            ? "The page you’re looking for may have moved or never existed."
            : <>We hit an unexpected error. Try again — if it keeps happening, email <a href="mailto:alerts@camphawk.app" className="font-bold text-ch-paper underline underline-offset-[3px]">alerts@camphawk.app</a>.</>}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {/* A way back into the product, not just home (the lab bar's "All screens" covers the lab). */}
          {notFound && <a href={withVisitor(ROUTES.explore, visitor)} className={buttonClasses({ className: "px-6" })}>Search campgrounds</a>}
          {!notFound && <button type="button" onClick={() => window.location.reload()} className={buttonClasses({ variant: "quiet", className: "px-6" })}>Try again</button>}
          {/* A hard navigation on purpose: when the client has failed, the router may be what broke. */}
          <a href={withVisitor(ROUTES.home, visitor)} className={buttonClasses({ variant: "quiet", className: "px-6" })}>{notFound ? "Back to home" : "Home"}</a>
        </div>
      </div>
    </div>
  );
}

/** The lab page that shows each error screen, with a switch. */
export function ErrorStates({ fixed }: { fixed?: Kind }) {
  const [visitor, setVisitor] = useVisitor();
  const [kind, setKind] = useUrlState<Kind>("state", "not-found", ["not-found", "error", "global"]);
  const shown = fixed ?? kind;
  return (
    <div className="gh flex min-h-dvh flex-col">
      <LabBar page={fixed ? "Not found" : "Errors"} visitor={visitor} onVisitor={setVisitor}>
        <ScreenLinks visitor={visitor} current="other" />
        {!fixed && <LabSelect label="Error screen" short="Screen" value={kind} onChange={setKind} options={[["not-found", "Not found"], ["error", "Something went wrong"], ["global", "Whole app failed"]]} />}
      </LabBar>
      <main id="main" className="grid flex-1 bg-ch-forest"><ErrorScreen kind={shown} /></main>
      {shown !== "global" && <GhFooter visitor={visitor} />}
    </div>
  );
}

export function NotFoundScreen() {
  return <ErrorStates fixed="not-found" />;
}
