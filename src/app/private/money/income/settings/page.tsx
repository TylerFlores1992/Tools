import { redirect } from "next/navigation";

/** Income settings live on Money → Settings now (owner, 2026-10-20). Old links land on that part. */
export default function OldIncomeSettings() {
  redirect("/private/money/settings#income");
}
