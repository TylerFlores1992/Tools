import type { SeriesInput } from "./types.ts";

/**
 * Reads the "record a show" form into what the DVR expects, clamping everything. The feed comes
 * as "<stream id>::<channel name>" so one select carries both.
 */
type Field = { get(name: string): FormDataEntryValue | null };

export function feedValue(id: number, name: string): string {
  return `${id}::${name}`;
}

export function readSeriesForm(form: Field): { ok: true; value: SeriesInput } | { ok: false; message: string } {
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const title = s("title").slice(0, 120);
  const [idPart, ...nameParts] = s("feed").split("::");
  const channel = /^\d{1,9}$/.test(idPart) ? Number(idPart) : 0;
  if (!title) return { ok: false, message: "Which show?" };
  if (!channel) return { ok: false, message: "Pick a channel." };
  const pad = (k: string) => (/^\d{1,3}$/.test(s(k)) ? Math.min(180, Number(s(k))) : null);
  const keep = /^\d{1,2}$/.test(s("keep")) ? Number(s("keep")) : 0;
  const folder = s("folder").slice(0, 120);
  return {
    ok: true,
    value: {
      title,
      channel,
      channelName: nameParts.join("::").slice(0, 120) || String(channel),
      guideId: s("gid").slice(0, 200),
      newOnly: s("mode") !== "all",
      keep,
      padBeforeMin: pad("padB"),
      padAfterMin: pad("padA"),
      ...(folder ? { folder } : {}),
    },
  };
}
