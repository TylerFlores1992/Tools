import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StudyNav } from "@/tools/etcp/StudyNav";
import { StudyBreadcrumb } from "@/tools/etcp/StudyBreadcrumb";
import { toolBySlug } from "@/lib/tools";

const tool = toolBySlug("etcp-rigger-study");

// Shared frame for the study pages. Metadata and robots live on each page, never here.
export default function StudyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader current="/workshop" />
      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-20 pt-6 sm:px-12 sm:pt-10 3xl:max-w-[1600px]">
        <StudyBreadcrumb toolName={tool.name} />
        <div className="mt-5">
          <StudyNav />
        </div>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
