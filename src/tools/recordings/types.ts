/**
 * The home DVR's API (the recorder on the home server, `scripts/dvr-api.js` in the Xtreamfilter
 * project), as this site sees it through `src/lib/recordings/dvr.ts`. Times are epoch ms.
 */

export type UpcomingState = "scheduled" | "recording" | "skipped";

export type Upcoming = {
  key: string;
  ruleId: string | null;
  show: string;
  se: string;
  sub: string;
  channelName: string;
  channel: number;
  start: number;
  stop: number;
  /** When recording starts and ends, padding included. */
  from: number;
  until: number;
  state: UpcomingState;
  isNew: boolean;
  once: boolean;
  /** Recorded so far, while recording. */
  mb: number;
  /** Different channels recording at the same moment (each needs a provider line). */
  overlap?: number;
};

export type Ads = {
  state: "removed" | "pending" | "full" | "kept";
  breaks?: number;
  savedMin?: number;
  /** The full-length original is still kept, so the ads can be put back. */
  canRestore?: boolean;
  note?: string;
};

export type Episode = {
  /** Path inside the recordings folder; the id for delete and "put ads back". */
  rel: string;
  show: string;
  se: string;
  title: string;
  aired: string | null;
  added: number;
  size: number;
  minutes: number | null;
  ads: Ads;
};

export type Show = { show: string; episodes: Episode[]; size: number; latest: number };

export type Rule = {
  id: string;
  title: string;
  folder: string;
  channel: number;
  channelName: string;
  newOnly: boolean;
  enabled: boolean;
  /** Keep the latest N episodes; 0 = keep all. */
  keep: number;
  /** A one-time recording: that airing's start. */
  once: number | null;
  padBeforeMin: number | null;
  padAfterMin: number | null;
  next: number | null;
  episodes: number;
};

export type TrashItem = { id: string; rel: string; name: string; size: number; deletedAt: string; why: string; purgeAt: number };

export type Failed = { show: string; se: string; title: string; aired: string; why: string };

export type DvrState = {
  now: number;
  /** Provider lines (each channel recorded at the same time needs one). */
  lines: number;
  /** How far ahead the TV guide reaches. */
  guideEnd: number;
  defaults: { padBeforeMin: number; padAfterMin: number };
  rules: Rule[];
  upcoming: Upcoming[];
  library: Show[];
  failed: Failed[];
  trash: TrashItem[];
  disk: { free: number; total: number } | null;
};

export type SearchHit = {
  title: string;
  airings: number;
  newAirings: number;
  channels: number;
  channelNames: string[];
  next: number;
  /** A series rule already exists for this title. */
  recording: boolean;
};

export type Airing = { start: number; stop: number; se: string; sub: string; isNew: boolean; scheduled: boolean; recorded: boolean };

export type AiringChannel = {
  /** Guide channel id. */
  gid: string;
  name: string;
  fav: boolean;
  us: boolean;
  /** Feeds carrying this channel, the TVs' own first. */
  streams: { id: number; name: string }[];
  airings: Airing[];
};

/** A rule as stored in the recorder's rules file (what `airings` returns for an existing series). */
export type StoredRule = { id: string; title: string; folder?: string; channel: number; channelName?: string; newOnly?: boolean; keep?: number; padBeforeMin?: number; padAfterMin?: number; once?: number };

export type ShowInfo = { title: string; desc: string; rule: StoredRule | null; channels: AiringChannel[] };

/** What the "Record a show" dialog sends to save a series (new or edited). */
export type SeriesInput = {
  title: string;
  channel: number;
  channelName: string;
  guideId: string;
  newOnly: boolean;
  keep: number;
  padBeforeMin: number | null;
  padAfterMin: number | null;
  folder?: string;
};
