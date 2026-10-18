// The Gmail half of Morning Mail: an Apps Script the owner pastes into script.google.com. Pure.
//
// WHY A SCRIPT IN THE OWNER'S OWN GOOGLE ACCOUNT, not a Gmail API connection from the server: an
// unverified OAuth app in "testing" has its refresh token expired by Google every 7 days, which
// would stop the capture silently each week. An Apps Script runs as the owner on Google's clock,
// with no client and no token for us to store. (Same reasoning as CampHawk Books' capture.)
//
// It sends headers and a short preview of new inbox mail, and performs the moves the server
// answers with: Trash (Gmail's own, recoverable for 30 days) or a label plus Archive. It never
// sends mail and never deletes anything permanently.
//
// THIS STRING MUST CONTAIN NO BACKTICK AND NO DOLLAR-BRACE: it is a template literal.
// mail-gmail-script.test.mts runs it against a fake Gmail.

export const GMAIL_SCRIPT_VERSION = "1";
export const URL_PLACEHOLDER = "__MORNING_MAIL_URL__";
export const KEY_PLACEHOLDER = "__MORNING_MAIL_KEY__";

const SCRIPT = `/**
 * Morning Mail: Gmail (version VERSION_HERE)
 *
 * Every morning around 6 this reads new mail in your Gmail inbox (sender, subject, a short
 * preview and the unsubscribe headers) and sends it to your Morning Mail page. If one of your
 * Morning Mail rules says so, it moves an email to Gmail's Trash or files it under a label.
 * It never sends mail and never deletes anything permanently. Run "setup" once.
 */

var MM_URL = '${URL_PLACEHOLDER}';
var MM_KEY = '${KEY_PLACEHOLDER}';
var VERSION = 'VERSION_HERE';
var TIME_BUDGET_MS = 5 * 60 * 1000;
var BATCH = 25;
var PREVIEW = 600;

/** Run this once. It turns on the daily run and does the first one now. */
function setup() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'morningMail') ScriptApp.deleteTrigger(existing[i]);
  }
  ScriptApp.newTrigger('morningMail').timeBased().everyDays(1).atHour(6).create();
  morningMail();
}

/** The daily run. */
function morningMail() {
  var started = Date.now();
  var hello = call_({ op: 'hello', scriptVersion: VERSION });
  var stats = { scanned: 0, sent: 0, moved: 0, errors: 0 };
  var byId = {};

  var threads = GmailApp.search(hello.query, 0, hello.maxThreads || 200);
  var fresh = [];
  for (var t = 0; t < threads.length; t++) {
    var msgs = threads[t].getMessages();
    for (var m = 0; m < msgs.length; m++) {
      if (!msgs[m].isInInbox()) continue;
      byId[msgs[m].getId()] = msgs[m];
      fresh.push(msgs[m].getId());
    }
  }
  stats.scanned = fresh.length;

  var need = fresh.length ? (call_({ op: 'need', ids: fresh }).need || []) : [];
  var ops = (hello.pending || []).slice();
  for (var i = 0; i < need.length; i += BATCH) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    var batch = [];
    for (var j = i; j < Math.min(i + BATCH, need.length); j++) {
      var msg = byId[need[j]];
      if (msg) batch.push(pack_(msg));
    }
    if (!batch.length) continue;
    var res = call_({ op: 'batch', messages: batch });
    stats.sent += batch.length;
    ops = ops.concat(res.ops || []);
  }

  var results = [];
  for (var k = 0; k < ops.length; k++) {
    var op = ops[k];
    try {
      var target = byId[op.id] || GmailApp.getMessageById(op.id);
      if (!target) { results.push({ id: op.id, ok: false, error: 'not found' }); continue; }
      if (op.op === 'trash') {
        target.moveToTrash();
      } else if (op.op === 'file') {
        var name = String(op.folder || 'Misc');
        var label = GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
        var thread = target.getThread();
        thread.addLabel(label);
        thread.moveToArchive();
      }
      stats.moved++;
      results.push({ id: op.id, ok: true });
    } catch (e) {
      stats.errors++;
      results.push({ id: op.id, ok: false, error: String(e).slice(0, 200) });
    }
  }
  if (results.length) call_({ op: 'results', results: results });

  stats.elapsedMs = Date.now() - started;
  stats.scriptVersion = VERSION;
  call_({ op: 'done', summary: stats });
  console.log('Morning Mail: ' + JSON.stringify(stats));
  return stats;
}

function pack_(msg) {
  var preview = '';
  try { preview = String(msg.getPlainBody() || '').slice(0, PREVIEW); } catch (e) {}
  return {
    id: msg.getId(),
    from: msg.getFrom(),
    subject: msg.getSubject(),
    date: msg.getDate().toISOString(),
    snippet: preview,
    listUnsubscribe: msg.getHeader('List-Unsubscribe') || null,
    listUnsubscribePost: msg.getHeader('List-Unsubscribe-Post') || null
  };
}

function call_(payload) {
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: { Authorization: 'Bearer ' + MM_KEY },
    muteHttpExceptions: true
  };
  for (var attempt = 1; attempt <= 3; attempt++) {
    var res = UrlFetchApp.fetch(MM_URL, options);
    var code = res.getResponseCode();
    if (code === 401) throw new Error('Morning Mail did not accept the key. Make a new script on the Morning Mail settings page.');
    if (code >= 200 && code < 300) return JSON.parse(res.getContentText());
    if (code < 500 || attempt === 3) throw new Error('Morning Mail answered ' + code);
    Utilities.sleep(2000 * attempt);
  }
}
`.replace(/VERSION_HERE/g, GMAIL_SCRIPT_VERSION);

export function gmailScript(url: string, key: string): string {
  return SCRIPT.replace(URL_PLACEHOLDER, url.replace(/'/g, "")).replace(KEY_PLACEHOLDER, key.replace(/'/g, ""));
}

export function gmailScriptTemplate(): string {
  return SCRIPT;
}
