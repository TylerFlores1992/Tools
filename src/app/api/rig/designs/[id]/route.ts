import { getRig, rigStoreReady } from "@/lib/rig/store";
import { noStore, rigTokenOk } from "@/lib/rig/token";

/**
 * The connector's `build_rig design_id=…` reads an approved design here: the build list frozen at
 * approval (docs/RIG.md). Bearer `RIG_TOKEN`; anything else gets 401. Drafts answer 409, so only
 * what was approved on the phone can be built.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/rig/designs/[id]">) {
  if (!rigTokenOk(req)) return noStore({ error: "unauthorized" }, 401);
  if (!rigStoreReady()) return noStore({ error: "not configured" }, 503);
  const { id } = await ctx.params;
  try {
    const rig = await getRig(id);
    if (!rig) return noStore({ error: "no design with that id" }, 404);
    if (rig.status === "draft" || !rig.buildList) return noStore({ error: "not approved yet: approve it on the phone first", status: rig.status }, 409);
    return noStore({ id: rig.id, name: rig.name, status: rig.status, approvedAt: rig.approvedAt, buildList: rig.buildList });
  } catch {
    return noStore({ error: "couldn't reach the database" }, 503);
  }
}
