import "server-only";
import { isConfigured, sql } from "@/lib/money/db";
import { buildList } from "@/tools/rig/build";
import type { BuildList, RigDesign } from "@/tools/rig/types";
import { newId, readDesign } from "@/tools/rig/validate";

/**
 * Saved rigs in the `rig` schema (docs/sql/rig-schema.sql), same database and role as Money,
 * Mail and Learn. One owner, so no user column. On approval the build list is frozen with the
 * design, so the connector builds exactly what the phone showed.
 */

export type RigStatus = "draft" | "approved" | "built";
export type SavedRig = { id: string; name: string; design: RigDesign; status: RigStatus; updatedAt: string; approvedAt: string | null; builtAt: string | null };
type Row = { id: string; name: string; design: unknown; status: RigStatus; updated_at: Date; approved_at: Date | null; built_at: Date | null };

export const rigStoreReady = isConfigured;

const toSaved = (r: Row): SavedRig | null => {
  const design = readDesign(r.design);
  return design
    ? { id: r.id, name: r.name, design, status: r.status, updatedAt: r.updated_at.toISOString(), approvedAt: r.approved_at?.toISOString() ?? null, builtAt: r.built_at?.toISOString() ?? null }
    : null;
};

export async function listRigs(): Promise<SavedRig[] | null> {
  if (!isConfigured()) return null;
  try {
    const rows = await sql()<Row[]>`select id, name, design, status, updated_at, approved_at, built_at from rig.designs order by updated_at desc limit 100`;
    return rows.map(toSaved).filter((x): x is SavedRig => !!x);
  } catch (e) {
    console.error("rig list failed", e instanceof Error ? e.name : "unknown");
    return null;
  }
}

export async function getRig(id: string): Promise<(SavedRig & { buildList: BuildList | null }) | null> {
  if (!isConfigured() || !/^[a-z0-9]{3,12}$/.test(id)) return null;
  const rows = await sql()<(Row & { build_list: BuildList | null })[]>`
    select id, name, design, status, updated_at, approved_at, built_at, build_list from rig.designs where id = ${id}`;
  const r = rows[0];
  const s = r ? toSaved(r) : null;
  return s ? { ...s, buildList: r.build_list } : null;
}

/** Saves a design (new when `id` is null). Editing an approved design puts it back to draft. */
export async function saveRig(id: string | null, design: RigDesign): Promise<string> {
  const db = sql();
  const key = id && /^[a-z0-9]{3,12}$/.test(id) ? id : newId();
  await db`
    insert into rig.designs (id, name, design) values (${key}, ${design.name}, ${db.json(design)})
    on conflict (id) do update set name = excluded.name, design = excluded.design,
      status = 'draft', build_list = null, approved_at = null, updated_at = now()`;
  return key;
}

export async function approveRig(id: string | null, design: RigDesign): Promise<string> {
  const db = sql();
  const key = await saveRig(id, design);
  const list = buildList(design);
  await db`update rig.designs set status = 'approved', build_list = ${db.json(list as never)}, approved_at = now(), updated_at = now() where id = ${key}`;
  return key;
}

export async function markBuilt(id: string): Promise<boolean> {
  const rows = await sql()`update rig.designs set status = 'built', built_at = now() where id = ${id} and status = 'approved' returning id`;
  return rows.length > 0;
}

export async function deleteRig(id: string): Promise<void> {
  await sql()`delete from rig.designs where id = ${id}`;
}
