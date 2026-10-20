// The Google Calendar half of Money → Income: an Apps Script the owner pastes into
// script.google.com. Pure.
//
// WHY A SCRIPT IN THE OWNER'S OWN GOOGLE ACCOUNT, not a Calendar API connection: an unverified
// OAuth app in "testing" has its refresh token expired by Google every 7 days, so a server-side
// connection would stop every week. The script runs as the owner on Google's clock (same reason
// as Morning Mail's Gmail script and CampHawk Books' capture).
//
// It sends the work days (events in the work or paid colour) from January 1 to two months ahead,
// and turns an event the paid colour when the server says every day of it has been paid. It never
// creates, moves, renames or deletes an event.
//
// THIS STRING MUST CONTAIN NO BACKTICK AND NO DOLLAR-BRACE: it is a template literal.
// income.test.mts runs it against a fake CalendarApp.

export const CALENDAR_SCRIPT_VERSION = "2";
export const URL_PLACEHOLDER = "__MONEY_CALENDAR_URL__";
export const KEY_PLACEHOLDER = "__MONEY_CALENDAR_KEY__";

const SCRIPT = `/**
 * Money: work calendar (version VERSION_HERE)
 *
 * This reads your work days (events in your work or paid color) on your main Google Calendar
 * and sends them to the Income page on tylerflores.dev: every 15 minutes, and within a minute of
 * pressing Refresh there. (It wakes every minute and asks first; most wakes read nothing.) When a day's pay has
 * reached your bank, it turns that event your paid color. It never creates, moves, renames or
 * deletes an event. Run "setup" once.
 */

var MC_URL = '${URL_PLACEHOLDER}';
var MC_KEY = '${KEY_PLACEHOLDER}';
var VERSION = 'VERSION_HERE';

/** Run this once. It turns on the every-minute check and does the first read now. */
function setup() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'moneyCalendar') ScriptApp.deleteTrigger(existing[i]);
  }
  ScriptApp.newTrigger('moneyCalendar').timeBased().everyMinutes(1).create();
  moneyCalendar(true);
}

/** Each wake. The server says whether a read is due (or Refresh was pressed); "force" reads anyway. */
function moneyCalendar(force) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { skipped: 'busy' };
  try {
    return read_(force === true);
  } finally {
    lock.releaseLock();
  }
}

function read_(force) {
  var hello = call_({ op: 'hello', scriptVersion: VERSION });
  if (!force && hello.read === false) return { skipped: hello.why || 'fresh' };
  var cal = CalendarApp.getDefaultCalendar();
  var events = cal.getEvents(new Date(hello.from), new Date(hello.to));
  var colors = hello.colors || [];
  var byKey = {};
  var out = [];
  for (var i = 0; i < events.length; i++) {
    var e = events[i];
    var color = String(e.getColor() || '');
    if (colors.indexOf(color) < 0) continue;
    var start, end;
    if (e.isAllDayEvent()) {
      start = e.getAllDayStartDate();
      end = new Date(e.getAllDayEndDate().getTime() - 86400000);
    } else {
      start = e.getStartTime();
      end = e.getEndTime();
    }
    var startDay = day_(start);
    var key = e.getId() + '|' + startDay;
    byKey[key] = e;
    out.push({ key: key, title: e.getTitle(), startDay: startDay, endDay: day_(end), color: color });
  }
  var res = call_({ op: 'events', events: out });
  var recolored = [];
  var errors = 0;
  var ids = res.recolor || [];
  for (var j = 0; j < ids.length; j++) {
    var ev = byKey[ids[j]];
    if (!ev) continue;
    try {
      ev.setColor(String(res.paidColor));
      recolored.push(ids[j]);
    } catch (err) {
      errors++;
    }
  }
  var summary = { sent: out.length, recolored: recolored.length, errors: errors, scriptVersion: VERSION };
  call_({ op: 'done', recolored: recolored, summary: summary });
  console.log('Money calendar: ' + JSON.stringify(summary));
  return summary;
}

function day_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function call_(payload) {
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: { Authorization: 'Bearer ' + MC_KEY },
    muteHttpExceptions: true
  };
  for (var attempt = 1; attempt <= 3; attempt++) {
    var res = UrlFetchApp.fetch(MC_URL, options);
    var code = res.getResponseCode();
    if (code === 401) throw new Error('Money did not accept the key. Make a new script on the Income settings page.');
    if (code >= 200 && code < 300) return JSON.parse(res.getContentText());
    if (code < 500 || attempt === 3) throw new Error('Money answered ' + code);
    Utilities.sleep(2000 * attempt);
  }
}
`.replace(/VERSION_HERE/g, CALENDAR_SCRIPT_VERSION);

export function calendarScript(url: string, key: string): string {
  return SCRIPT.replace(URL_PLACEHOLDER, url.replace(/'/g, "")).replace(KEY_PLACEHOLDER, key.replace(/'/g, ""));
}

export function calendarScriptTemplate(): string {
  return SCRIPT;
}
