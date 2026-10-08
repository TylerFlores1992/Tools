"use client";

import { useEffect, useState } from "react";
import { LOCAL_MAPS, mapFor, type SiteMapData } from "./index";

export type SiteMapState = { map: SiteMapData | null; status: "ready" | "loading" | "none" | "pending" };

/** A campground's drawn map: bundled ones at once, local-only ones fetched. A local map that
    isn't there (every deploy) reads "pending", never "loading" for ever. */
export function useSiteMap(campgroundId: string, enabled: boolean): SiteMapState {
  const bundled = mapFor(campgroundId);
  const url = LOCAL_MAPS[campgroundId];
  const [local, setLocal] = useState<{ id: string; map: SiteMapData | null } | null>(null);
  useEffect(() => {
    if (!enabled || bundled || !url) return;
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((m: SiteMapData | null) => { if (live) setLocal({ id: campgroundId, map: m && Array.isArray(m.sites) ? m : null }); });
    return () => { live = false; };
  }, [campgroundId, enabled, bundled, url]);
  if (!enabled) return { map: null, status: "none" };
  if (bundled) return { map: bundled, status: "ready" };
  if (!url) return { map: null, status: "none" };
  if (!local || local.id !== campgroundId) return { map: null, status: "loading" };
  return local.map ? { map: local.map, status: "ready" } : { map: null, status: "pending" };
}
