"use client";

import { useEffect, useState } from "react";
import { decodeBip, lidarRelief, lidarSize, lidarSourcesFor, lidarUrl, metresPerPx, mostlyMissing, type LidarSource } from "../maps/lidar";

type Bbox = [number, number, number, number];
export type LidarState = { state: "off" | "loading" | "ready" | "error"; src: string | null; source: LidarSource | null };

/**
 * The lidar relief of a map's frame as an image URL, rendered here in the browser (both lidar
 * services answer any origin; maps/lidar.ts): Oregon's own lidar there, else USGS 3DEP. Fetched
 * only while `on`, at about `widthPx` across (never finer than half a metre a pixel).
 */
export function useLidar(bbox: Bbox | undefined, frameW: number, widthPx: number, on: boolean): LidarState {
  const [out, setOut] = useState<LidarState & { key: string }>({ key: "", state: "off", src: null, source: null });
  const key = on && bbox && widthPx ? `${bbox.join(",")}@${Math.round(widthPx / 400)}` : "";
  useEffect(() => {
    if (!key || !bbox) return;
    const ctl = new AbortController();
    let url: string | null = null;
    (async () => {
      setOut({ key, state: "loading", src: null, source: null });
      const size = lidarSize(bbox, Math.max(0.5, frameW / widthPx));
      for (const source of lidarSourcesFor(bbox)) {
        const res = await fetch(lidarUrl(bbox, size, source), { signal: ctl.signal }).catch(() => null);
        if (ctl.signal.aborted) return;
        const dem = res?.ok ? decodeBip(await res.arrayBuffer(), size.width, size.height) : null;
        if (!dem || mostlyMissing(dem)) continue;
        const gray = lidarRelief(dem, size.width, size.height, metresPerPx(bbox, size));
        const canvas = document.createElement("canvas");
        canvas.width = size.width; canvas.height = size.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) break;
        const rgba = ctx.createImageData(size.width, size.height);
        for (let i = 0; i < gray.length; i++) { rgba.data[i * 4] = rgba.data[i * 4 + 1] = rgba.data[i * 4 + 2] = gray[i]; rgba.data[i * 4 + 3] = 255; }
        ctx.putImageData(rgba, 0, 0);
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
        if (ctl.signal.aborted || !blob) return;
        url = URL.createObjectURL(blob);
        setOut({ key, state: "ready", src: url, source });
        return;
      }
      if (!ctl.signal.aborted) setOut({ key, state: "error", src: null, source: null });
    })();
    return () => { ctl.abort(); if (url) URL.revokeObjectURL(url); };
    // The key holds the box and the width band; frameW follows the box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!key) return { state: "off", src: null, source: null };
  return out.key === key ? { state: out.state, src: out.src, source: out.source } : { state: "loading", src: null, source: null };
}
