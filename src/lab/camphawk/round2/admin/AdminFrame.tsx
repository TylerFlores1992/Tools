"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, ArrowLeft, BookOpen, HeartPulse, LayoutDashboard, Map, UsersRound, type LucideIcon } from "lucide-react";
import { cx } from "@/components/cx";
import { LabBar } from "../../LabBar";

// CampHawk's admin frame (campsite-finder src/components/admin/AdminShell.tsx), as a lab mock with
// one new section, Site maps. A forest sidebar on the left from lg; on a phone, a slim forest
// header with a row of tabs. The current item is marked by a bar, bold text and aria-current,
// never by colour alone. Only Site maps exists in the lab, so the other sections are shown as
// CampHawk lists them, as plain text rather than links that would lead nowhere.

const SECTIONS: { label: string; Icon: LucideIcon }[] = [
  { label: "Overview", Icon: LayoutDashboard },
  { label: "Users & revenue", Icon: UsersRound },
  { label: "Engagement", Icon: Activity },
  { label: "System health", Icon: HeartPulse },
  { label: "Books", Icon: BookOpen },
];
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ch-white";

export function AdminFrame({ page, home, children }: { page: string; home: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-ch-paper">
      <LabBar page={page} />
      <div className="lg:flex">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto overscroll-contain bg-ch-forest text-ch-white lg:flex">
          <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
            <Badge size={30} />
            <span className="leading-tight">
              <span className="block font-ch-display text-[18px] font-extrabold tracking-[-.02em]">CampHawk</span>
              <span className="block text-ch-label font-bold uppercase tracking-[.14em] text-ch-white/70">Admin</span>
            </span>
          </div>
          <nav aria-label="Admin" className="flex-1 space-y-0.5 px-3 py-2">
            {SECTIONS.slice(0, 4).map((s) => <Item key={s.label} {...s} />)}
            <div className="my-2 border-t border-ch-white/10" />
            <Item {...SECTIONS[4]} />
            <Link href={home} aria-current="page" className={cx("relative flex items-center gap-3 rounded-ch-input bg-ch-forest-3 px-3 py-2.5 text-[14px] font-bold text-ch-white", focusRing)}>
              <span aria-hidden="true" className="absolute bottom-2 left-0 top-2 w-1 rounded-full bg-ch-white" />
              <Map aria-hidden="true" className="size-[18px] shrink-0" />
              <span className="flex-1">Site maps</span>
            </Link>
          </nav>
          <div className="border-t border-ch-white/10 px-3 py-3">
            <Link href="/private/camphawk" className={cx("flex items-center gap-2 rounded-ch-input px-3 py-2 text-ch-body text-ch-white/80 hover:bg-ch-forest-2 hover:text-ch-white", focusRing)}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to the lab
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-ch-white/10 bg-ch-forest pt-2 text-ch-white lg:hidden">
            <div className="flex items-center gap-2 px-4 pb-2">
              <Badge size={26} />
              <span className="truncate font-ch-display text-[17px] font-extrabold tracking-[-.02em]">
                CampHawk <span className="font-ch-body text-ch-label font-bold uppercase tracking-[.14em] text-ch-white/70">Admin</span>
              </span>
            </div>
            <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
              <Link href={home} aria-current="page" className={cx("flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-ch-chip bg-ch-white px-3 py-2 text-ch-meta font-bold text-ch-ink", focusRing)}>
                <Map aria-hidden="true" className="size-4" />Site maps
              </Link>
              {SECTIONS.map((s) => (
                <span key={s.label} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-ch-chip px-3 py-2 text-ch-meta text-ch-white/70">
                  <s.Icon aria-hidden="true" className="size-4" />{s.label}
                </span>
              ))}
            </nav>
          </header>
          <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-5 sm:px-6 sm:pt-7">{children}</main>
        </div>
      </div>
    </div>
  );
}

function Item({ label, Icon }: { label: string; Icon: LucideIcon }) {
  return (
    <span className="flex items-center gap-3 rounded-ch-input px-3 py-2.5 text-[14px] text-ch-white/70">
      <Icon aria-hidden="true" className="size-[18px] shrink-0" />
      {label}
    </span>
  );
}

function Badge({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/private/camphawk/round2/badge-golden-80.webp" alt="" width={size} height={size} className="shrink-0 select-none" draggable={false} />;
}
