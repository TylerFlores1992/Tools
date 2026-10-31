import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { Card } from "@/components/Card";
import { cx } from "@/components/cx";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { requirePrivate } from "@/lib/money/guard";
import { dvr } from "@/lib/recordings/dvr";
import { plural, when } from "@/tools/recordings/format";
import { feedValue } from "@/tools/recordings/series-form";
import type { AiringChannel, DvrState, SearchHit, ShowInfo, StoredRule } from "@/tools/recordings/types";
import { AutoSubmit } from "@/tools/recordings/ui/AutoSubmit";
import { RecordingsShell } from "@/tools/recordings/ui/RecordingsShell";
import { Tag } from "@/tools/money/ui/MoneyShell";
import { PendingButton } from "@/tools/mail/ui/PendingButton";
import { recordOnce, saveSeries } from "../actions";

export const metadata: Metadata = {
  title: "Record a show",
  description: "Find a show in the TV guide and choose how the home DVR records it.",
  robots: { index: false, follow: false },
};

const HERE = "/private/recordings/record";
const field = "min-h-11 w-full rounded-input border border-control bg-surface px-3 text-body text-ink";

type Params = { q?: string; show?: string; ch?: string; edit?: string; manual?: string };

export default async function RecordShow({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePrivate(HERE);
  const sp = await searchParams;
  const show = (sp.show ?? "").trim().slice(0, 120);
  if (sp.manual === "1") return <Manual title={show} />;
  if (show) return <ShowView title={show} ch={sp.ch} editId={/^[0-9a-f]{8}$/.test(sp.edit ?? "") ? sp.edit! : undefined} />;
  return <Search q={(sp.q ?? "").trim().slice(0, 80)} />;
}

// ---------- search ----------

async function Search({ q }: { q: string }) {
  const [found, state] = await Promise.all([
    q.length >= 2 ? dvr<SearchHit[]>(`search?q=${encodeURIComponent(q)}`) : Promise.resolve(null),
    dvr<DvrState>("state"),
  ]);
  if (!state.ok) return <Unreachable title="Record a show" message={state.message} />;
  const { guideEnd, now } = state.data;
  return (
    <RecordingsShell trail="Record a show">
      <div className="max-w-[760px]">
        <Label rule>Home DVR</Label>
        <h1 className="mt-3 text-title font-normal">Record a show</h1>
        <p className="mt-3 text-body text-ink-2">
          Search the TV guide. It covers the next few days{guideEnd ? ` (through ${when(guideEnd, now).split(",").slice(0, -1).join(",")})` : ""}.
        </p>
        <Form action={HERE} replace scroll={false} className="mt-6 flex gap-2" role="search">
          <label className="sr-only" htmlFor="q">Show, sport or movie</label>
          <input id="q" name="q" type="search" defaultValue={q} autoFocus autoComplete="off" placeholder="Show, sport or movie" className={cx(field, "text-lede")} />
          <button type="submit" className={buttonClasses("quiet")}>Search</button>
          <AutoSubmit />
        </Form>

        <div className="mt-6" aria-live="polite">
          {found && !found.ok && <State kind="wrong">{found.message}</State>}
          {found?.ok && found.data.length === 0 && <p className="text-body text-ink-2">Nothing in the guide matches “{q}”.</p>}
          {found?.ok && found.data.length > 0 && (
            <ul className="rounded-card border border-line bg-surface shadow-card">
              {found.data.map((h) => (
                <li key={h.title} className="border-t border-line first:border-t-0">
                  <Link href={`${HERE}?show=${encodeURIComponent(h.title)}`} className="flex min-h-16 items-center justify-between gap-4 px-5 py-3 hover:bg-surface-2">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-2 text-body text-ink">
                        {h.title}
                        {h.recording && <State kind="ok" sr="Status:" className="text-small">Recording</State>}
                        {h.newAirings > 0 && <Tag>{h.newAirings} new</Tag>}
                      </span>
                      <span className="mt-0.5 block text-small text-muted">
                        {h.channelNames.join(", ")}{h.channels > h.channelNames.length ? ` +${h.channels - h.channelNames.length} more` : ""} · next {when(h.next, now)}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-ink-2">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-8 text-small text-muted">
          Not in the guide yet, like a show coming back next month?{" "}
          <Link href={`${HERE}?manual=1${q ? `&show=${encodeURIComponent(q)}` : ""}`} className="underline underline-offset-4 hover:text-ink">Add a series by name</Link>; it records once the show appears.
        </p>
      </div>
    </RecordingsShell>
  );
}

// ---------- one show ----------

async function ShowView({ title, ch, editId }: { title: string; ch?: string; editId?: string }) {
  const [res, state] = await Promise.all([dvr<ShowInfo>(`airings?title=${encodeURIComponent(title)}`), dvr<DvrState>("state")]);
  if (!res.ok || !state.ok) return <Unreachable title={title} message={!res.ok ? res.message : state.ok ? "" : state.message} />;
  const info = res.data;
  const { now, defaults } = state.data;
  const fromState = editId ? state.data.rules.find((r) => r.id === editId) : undefined;
  const rule: StoredRule | null = fromState
    ? {
        id: fromState.id, title: fromState.title, folder: fromState.folder, channel: fromState.channel, channelName: fromState.channelName,
        newOnly: fromState.newOnly, keep: fromState.keep || undefined, once: fromState.once ?? undefined,
        padBeforeMin: fromState.padBeforeMin ?? undefined, padAfterMin: fromState.padAfterMin ?? undefined,
      }
    : info.rule;
  const editing = Boolean(rule && !rule.once);

  // The channels airing it, the series' own channel first when editing.
  const channels: AiringChannel[] = [...info.channels];
  if (rule && !channels.some((c) => c.streams.some((s) => s.id === rule.channel))) {
    channels.unshift({ gid: "", name: rule.channelName ?? String(rule.channel), fav: true, us: true, streams: [{ id: rule.channel, name: rule.channelName ?? String(rule.channel) }], airings: [] });
  }
  if (!channels.length) return <Manual title={info.title} note={`“${info.title}” isn’t on in the next few days. You can still set it up; it records once the guide lists it.`} />;
  const chosen = channels.find((c) => c.gid === ch) ?? (rule ? channels.find((c) => c.streams.some((s) => s.id === rule.channel)) : undefined) ?? channels[0];
  const ruleFeed = rule && chosen.streams.find((s) => s.id === rule.channel);
  const feeds = chosen.streams.map((s, i) => ({ value: feedValue(s.id, i === 0 ? chosen.name : s.name.replace(/ \(.*\)$/, "")), label: s.name, on: ruleFeed ? s.id === ruleFeed.id : i === 0 }));
  const defaultFeed = (feeds.find((f) => f.on) ?? feeds[0]).value;

  return (
    <RecordingsShell trail="Record a show">
      <div className="max-w-[760px]">
        <Link href={HERE} className="text-small text-ink-2 underline underline-offset-4 hover:text-ink">← Back to search</Link>
        <h1 className="mt-4 text-title font-normal">{info.title}</h1>
        {info.desc && <p className="mt-3 max-w-[65ch] text-body text-ink-2">{info.desc}</p>}
        {rule && (
          <p className="mt-4"><State kind="ok" sr="Note:">{rule.once ? "One airing is set to record." : `Already recording on ${rule.channelName ?? "its channel"}. Change the settings below.`}</State></p>
        )}

        <Card className="mt-8 grid gap-6">
          <Form action={HERE} replace scroll={false} className="grid gap-1.5">
            <input type="hidden" name="show" value={info.title} />
            {editId && <input type="hidden" name="edit" value={editId} />}
            <label htmlFor="ch" className="text-small text-ink-2">Channel</label>
            <div className="flex gap-2">
              <select id="ch" name="ch" defaultValue={chosen.gid} className={field}>
                {channels.map((c) => (
                  <option key={c.gid || "rule"} value={c.gid}>{c.name} · {plural(c.airings.length, "airing")}{c.airings.some((a) => a.isNew) ? " (new)" : ""}</option>
                ))}
              </select>
              <noscript><button type="submit" className={buttonClasses("quiet")}>Show</button></noscript>
            </div>
            <AutoSubmit />
          </Form>

          <form action={saveSeries} className="grid gap-6">
            <input type="hidden" name="title" value={info.title} />
            <input type="hidden" name="gid" value={chosen.gid} />
            {editing && rule && <input type="hidden" name="ruleId" value={rule.id} />}
            {rule?.folder && <input type="hidden" name="folder" value={rule.folder} />}
            <SeriesOptions rule={editing ? rule : null} defaults={defaults} feeds={feeds} />
            <PendingButton className={buttonClasses("primary", "justify-self-start")} pending="Saving…">{editing ? "Save changes" : "Record series"}</PendingButton>
          </form>
        </Card>

        {chosen.airings.length > 0 && (
          <section className="mt-10" aria-label={`Coming up on ${chosen.name}`}>
            <Label>Coming up on {chosen.name}</Label>
            <ul className="mt-3 rounded-card border border-line bg-surface shadow-card">
              {chosen.airings.map((a) => (
                <li key={a.start} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-line px-5 py-4 first:border-t-0">
                  <div className="min-w-0">
                    <p className="text-body font-medium tabular-nums text-ink">{when(a.start, now)}</p>
                    <p className="mt-1 flex flex-wrap items-baseline gap-2 text-small text-ink-2">
                      {a.se && <Tag>{a.se}</Tag>}
                      {a.sub && <span>{a.sub}</span>}
                      {a.isNew && <Tag>New</Tag>}
                    </p>
                  </div>
                  {a.scheduled ? (
                    <State kind="ok" sr="Status:" className="text-small">Will record</State>
                  ) : a.recorded ? (
                    <State kind="note" sr="Status:" className="text-small">Already recorded</State>
                  ) : (
                    <form action={recordOnce}>
                      <input type="hidden" name="title" value={info.title} />
                      <input type="hidden" name="gid" value={chosen.gid} />
                      <input type="hidden" name="feed" value={defaultFeed} />
                      <input type="hidden" name="start" value={a.start} />
                      <input type="hidden" name="stop" value={a.stop} />
                      <input type="hidden" name="label" value={when(a.start, now)} />
                      {rule?.folder && <input type="hidden" name="folder" value={rule.folder} />}
                      <PendingButton className={buttonClasses("quiet", "min-h-10 px-4 text-small")} pending="Saving…">Record this one</PendingButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </RecordingsShell>
  );
}

function Unreachable({ title, message }: { title: string; message: string }) {
  return (
    <RecordingsShell trail="Record a show">
      <h1 className="text-title font-normal">{title}</h1>
      <Card className="mt-8 max-w-[640px]"><State kind="wrong">{message}</State></Card>
    </RecordingsShell>
  );
}

// ---------- shared options ----------

/** Record new-only or every airing, plus "More options" (feed, keep, timing). No feeds = the form has its own channel field. */
function SeriesOptions({ rule, defaults, feeds }: {
  rule: StoredRule | null;
  defaults: { padBeforeMin: number; padAfterMin: number };
  feeds: { value: string; label: string; on: boolean }[];
}) {
  const newOnly = rule ? rule.newOnly !== false : true;
  const pick = (name: string, label: string, value: number | undefined, options: number[], dflt: number) => (
    <label className="grid gap-1.5 text-small text-ink-2">
      {label}
      <select name={name} defaultValue={value ?? ""} className={field}>
        <option value="">Default ({dflt} min)</option>
        {options.map((o) => <option key={o} value={o}>{o} min</option>)}
      </select>
    </label>
  );
  return (
    <>
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-small text-ink-2">Record</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { v: "new", label: "New episodes only", hint: "Only airings the guide marks new. The same episode is never recorded twice." },
            { v: "all", label: "Every airing", hint: "Reruns too. Episodes you already have are skipped." },
          ].map((o) => (
            <label key={o.v} className="flex cursor-pointer gap-3 rounded-btn border border-line-2 p-4 has-[:checked]:border-control has-[:checked]:bg-surface-2">
              <input type="radio" name="mode" value={o.v} defaultChecked={(o.v === "new") === newOnly} className="mt-1 size-5 shrink-0 accent-primary" />
              <span>
                <span className="block text-body text-ink">{o.label}</span>
                <span className="mt-1 block text-small text-muted">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <details className="group rounded-btn border border-line-2" open={Boolean(rule && (rule.keep || rule.padBeforeMin !== undefined || rule.padAfterMin !== undefined))}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-small text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
          More options <span aria-hidden="true">▾</span>
        </summary>
        <div className="grid gap-4 border-t border-line-2 p-4">
          {feeds.length > 1 ? (
            <label className="grid gap-1.5 text-small text-ink-2">
              Feed
              <select name="feed" defaultValue={(feeds.find((f) => f.on) ?? feeds[0]).value} className={field}>
                {feeds.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <span className="text-muted">The first is the feed the TVs use. Keep it, so recording while someone watches costs no extra line.</span>
            </label>
          ) : feeds.length === 1 ? (
            <input type="hidden" name="feed" value={feeds[0].value} />
          ) : null /* the form picks the channel itself (Add by name) */}
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5 text-small text-ink-2">
              Keep
              <select name="keep" defaultValue={rule?.keep ?? 0} className={field}>
                <option value={0}>All episodes</option>
                {[1, 3, 5, 10, 20].map((n) => <option key={n} value={n}>Latest {n}</option>)}
              </select>
            </label>
            {pick("padB", "Start early", rule?.padBeforeMin, [0, 1, 2, 5, 10], defaults.padBeforeMin)}
            {pick("padA", "End late", rule?.padAfterMin, [0, 5, 10, 15, 30, 60, 90], defaults.padAfterMin)}
          </div>
          <p className="text-small text-muted">“Keep latest” moves older episodes to the Trash when a new one finishes, which suits news and talk shows. Add time at the end for live sports.</p>
        </div>
      </details>
    </>
  );
}

// ---------- by name (not in the guide) ----------

async function Manual({ title, note }: { title: string; note?: string }) {
  const [chans, state] = await Promise.all([dvr<{ id: number; name: string; group: string }[]>("channels"), dvr<DvrState>("state")]);
  const defaults = state.ok ? state.data.defaults : { padBeforeMin: 2, padAfterMin: 15 };
  const list = chans.ok ? chans.data : [];
  const groups = [...new Set(list.map((c) => c.group || "Channels"))];
  return (
    <RecordingsShell trail="Record a show">
      <div className="max-w-[760px]">
        <Link href={HERE} className="text-small text-ink-2 underline underline-offset-4 hover:text-ink">← Back to search</Link>
        <h1 className="mt-4 text-title font-normal">Add a series by name</h1>
        <p className="mt-3 max-w-[65ch] text-body text-ink-2">{note ?? "For a show that isn’t in the guide yet. It starts recording as soon as the guide lists it."}</p>
        {!chans.ok && <p className="mt-4"><State kind="wrong">{chans.message}</State></p>}
        <Card className="mt-8">
          <form action={saveSeries} className="grid gap-6">
            <input type="hidden" name="gid" value="" />
            <label className="grid gap-1.5 text-small text-ink-2">
              Show title
              <input name="title" defaultValue={title} required placeholder="Exactly as the guide spells it" className={field} />
            </label>
            <label className="grid gap-1.5 text-small text-ink-2">
              Channel
              <select name="feed" className={field}>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {list.filter((c) => (c.group || "Channels") === g).map((c) => <option key={c.id} value={feedValue(c.id, c.name)}>{c.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <SeriesOptions rule={null} defaults={defaults} feeds={[]} />
            <PendingButton className={buttonClasses("primary", "justify-self-start")} pending="Saving…">Add series</PendingButton>
          </form>
        </Card>
      </div>
    </RecordingsShell>
  );
}
