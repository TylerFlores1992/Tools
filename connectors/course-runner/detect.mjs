// What the runner sees on a page and what it does about it. No Playwright here, so it can be tested
// on its own. `scanFrame` and `clickNext` run inside the course's pages; `decide` runs on the server.
// The runner never chooses or submits an answer: a question always goes to the owner's phone.

const PAGE_HELPERS = `
  var NEXT = /^(next|continue|proceed)\\b.{0,30}$|^(\\u2192|\\u203a|\\u00bb|>)$/i;
  var HOLD = /\\b(submit|finish|complete|exam|quiz|test|assessment)\\b|^(check|check answer|start)\\b/i;
  var FIELD = 'input[type=radio],input[type=checkbox],[role=radio],[role=checkbox],textarea,select,input[type=text]:not([placeholder*="earch" i])';
  var CTRL = 'a,button,[role=button],input[type=button],input[type=submit]';
  function visible(el) { return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'; }
  function label(el) { return (el.getAttribute('aria-label') || el.innerText || el.value || el.title || '').trim().replace(/\\s+/g, ' '); }
  function enabled(el) {
    return !el.disabled && el.getAttribute('aria-disabled') !== 'true' && getComputedStyle(el).pointerEvents !== 'none' &&
      !/\\bdisabled\\b/i.test(String(el.className));
  }
  function list(sel) { return Array.prototype.filter.call(document.querySelectorAll(sel), visible); }
  function findNext() {
    var found = null;
    list(CTRL).forEach(function (el) { var n = label(el); if (NEXT.test(n) && !HOLD.test(n)) found = el; });
    return found;
  }
`;

export const SCAN_FRAME = `(function () {${PAGE_HELPERS}
  var held = list(CTRL).some(function (el) { var n = label(el); return n.length < 40 && HOLD.test(n); });
  var videos = list('video');
  var next = findNext();
  return {
    question: list(FIELD).length > 0 || held,
    video: videos.some(function (v) { return !v.ended && !v.paused; }) ? 'playing'
      : videos.some(function (v) { return !v.ended && !(v.duration && v.currentTime >= v.duration - 0.5); }) ? 'paused' : 'none',
    next: !next ? 'none' : enabled(next) ? 'ready' : 'locked',
    text: document.body ? document.body.innerText.slice(0, 3000) : ''
  };
})()`;

export const CLICK_NEXT = `(function () {${PAGE_HELPERS}
  var next = findNext();
  if (!next || !enabled(next)) return false;
  next.click();
  return true;
})()`;

/** Combines what each frame of a page reported into one view of the page. */
export function mergeFrames(frames) {
  const has = (key, value) => frames.some((f) => f[key] === value);
  return {
    question: frames.some((f) => f.question),
    video: has("video", "playing") ? "playing" : has("video", "paused") ? "paused" : "none",
    next: has("next", "ready") ? "ready" : has("next", "locked") ? "locked" : "none",
    text: frames.map((f) => f.text).join("|"),
  };
}

export const SETTINGS = { pauseMs: 5000, videoGraceMs: 20_000, noNextMs: 60_000, lockedMs: 15 * 60_000, stuckClicks: 3 };

export const newMemory = () => ({ readyAt: 0, since: 0, sinceKind: "", lastSig: "", stuck: 0 });

const NEEDS = {
  question: "A question is waiting for you.",
  video: "A video needs you to press play.",
  "no-next": "Page Turner can't find a Next button.",
  locked: "Next has been locked for a while.",
  stuck: "Next isn't changing the page.",
};

/**
 * One step of the loop. Returns what to show and whether to click.
 * `alert` is set while the owner is needed; the runner sends one push per new alert.
 */
export function decide(page, memory, now, cfg = SETTINGS) {
  const m = memory;
  const waited = (kind) => {
    if (m.sinceKind !== kind) { m.sinceKind = kind; m.since = now; }
    return now - m.since;
  };
  const needs = (reason) => ({ status: "needs-you", alert: reason, message: NEEDS[reason], click: false });
  const wait = (message) => ({ status: "running", alert: null, message, click: false });

  if (page.question) { m.readyAt = 0; waited("question"); return needs("question"); }
  if (page.video === "playing") { m.readyAt = 0; waited("video"); return wait("Waiting for the video to finish."); }
  if (page.video === "paused") {
    m.readyAt = 0;
    return waited("paused") >= cfg.videoGraceMs ? needs("video") : wait("Waiting for the video to start.");
  }
  if (page.next === "none") {
    m.readyAt = 0;
    return waited("none") >= cfg.noNextMs ? needs("no-next") : wait("Looking for a Next button.");
  }
  if (page.next === "locked") {
    m.readyAt = 0;
    return waited("locked") >= cfg.lockedMs ? needs("locked") : wait("Waiting for Next to unlock.");
  }
  waited("ready");
  if (m.stuck >= cfg.stuckClicks) return needs("stuck");
  if (!m.readyAt) m.readyAt = now + cfg.pauseMs;
  if (now < m.readyAt) return wait(`Next in ${Math.ceil((m.readyAt - now) / 1000)} sec`);
  const sig = `${page.url ?? ""}|${page.text}`;
  m.stuck = sig === m.lastSig ? m.stuck + 1 : 0;
  m.lastSig = sig;
  m.readyAt = 0;
  if (m.stuck >= cfg.stuckClicks) return needs("stuck");
  return { status: "running", alert: null, message: "Clicking Next.", click: true };
}
