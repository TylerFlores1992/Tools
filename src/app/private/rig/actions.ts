"use server";

import { revalidatePath } from "next/cache";
import { requirePrivate } from "@/lib/money/guard";
import { aiEdit } from "@/lib/rig/ai";
import { approveRig, deleteRig, rigStoreReady, saveRig } from "@/lib/rig/store";
import { applyEdit, parseEdit } from "@/tools/rig/commands";
import type { RigDesign } from "@/tools/rig/types";
import { readDesign } from "@/tools/rig/validate";

/** Every action re-checks the Private session; the proxy is the first lock, not the only one. */

export type ChatResult =
  | { state: "changed"; design: RigDesign; reply: string; by: "words" | "ai" }
  | { state: "unchanged"; reply: string };

export async function chat(raw: unknown, message: string): Promise<ChatResult> {
  await requirePrivate("/private/rig");
  const design = readDesign(raw);
  const text = String(message ?? "").trim().slice(0, 500);
  if (!design || !text) return { state: "unchanged", reply: "I didn't catch that. Try “make it 12 feet tall”." };
  const quick = parseEdit(text);
  const edit = quick ?? (await aiEdit(design, text));
  if (!edit) return { state: "unchanged", reply: "I couldn't read that one. Try sizes in feet, a truss size, or which braces to add or remove." };
  const { design: next, changes } = applyEdit(design, edit);
  if (!changes.length) return { state: "unchanged", reply: edit.reply || "That's already how it is." };
  const said = changes.join(", ");
  return { state: "changed", design: next, reply: edit.reply || `${said[0].toUpperCase()}${said.slice(1)}.`, by: quick ? "words" : "ai" };
}

export type SaveResult = { ok: true; id: string } | { ok: false; reason: string };

const NOT_READY = "Saving isn't set up yet (the rig table needs creating). Your design is kept on this phone.";

export async function save(id: string | null, raw: unknown): Promise<SaveResult> {
  await requirePrivate("/private/rig");
  const design = readDesign(raw);
  if (!design) return { ok: false, reason: "That design didn't read right." };
  if (!rigStoreReady()) return { ok: false, reason: NOT_READY };
  try {
    const key = await saveRig(id, design);
    revalidatePath("/private/rig");
    return { ok: true, id: key };
  } catch (e) {
    console.error("rig save failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, reason: NOT_READY };
  }
}

export async function approve(id: string | null, raw: unknown): Promise<SaveResult> {
  await requirePrivate("/private/rig");
  const design = readDesign(raw);
  if (!design) return { ok: false, reason: "That design didn't read right." };
  if (!rigStoreReady()) return { ok: false, reason: NOT_READY };
  try {
    const key = await approveRig(id, design);
    revalidatePath("/private/rig");
    return { ok: true, id: key };
  } catch (e) {
    console.error("rig approve failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, reason: NOT_READY };
  }
}

export async function remove(id: string): Promise<{ ok: boolean }> {
  await requirePrivate("/private/rig");
  if (!rigStoreReady()) return { ok: false };
  try {
    await deleteRig(id);
    revalidatePath("/private/rig");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
