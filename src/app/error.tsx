"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, LinkButton } from "@/components/Button";
import { Label } from "@/components/Label";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Spinner } from "@/components/Spinner";
import { WRAP } from "@/components/wrap";

/**
 * What any page shows when something it needs throws: a database that didn't answer, a server
 * action that failed, the home server timing out. Plain words and a way forward, never the
 * framework's "Application error". "Try again" re-runs the page on the server.
 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [trying, setTrying] = useState(false);
  useEffect(() => {
    console.error(error);
  }, [error]);
  const isPrivate = (usePathname() ?? "").startsWith("/private");
  return (
    <>
      <SiteHeader current={isPrivate ? "/private" : null} />
      <main id="main" className={`${WRAP} flex flex-1 items-center pb-24 pt-10 sm:pt-16`}>
        <div role="alert">
          <Label>Something went wrong</Label>
          <h1 className="mt-3 text-title font-normal">That didn’t load.</h1>
          <p className="mt-4 max-w-[52ch] text-lede text-ink-2">
            {isPrivate
              ? "Something this page needs didn’t answer: the database, the home server, or a service it talks to. Nothing you did was lost. Try again in a moment."
              : "Something went wrong on our side. Try again in a moment."}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button
              aria-busy={trying || undefined}
              onClick={() => {
                setTrying(true);
                retry();
              }}
            >
              {trying ? (
                <>
                  <Spinner />
                  Trying again…
                </>
              ) : (
                "Try again"
              )}
            </Button>
            <LinkButton href={isPrivate ? "/private" : "/"} variant="quiet">
              {isPrivate ? "Back to Private" : "Back home"}
            </LinkButton>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
