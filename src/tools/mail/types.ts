// Shapes shared by Morning Mail's pure logic and its server code.

export type Bucket = "needs_you" | "security" | "junk" | "updates" | "bulk" | "other";
export type Level = "urgent" | "normal" | "info";
export type RuleAction = "trash" | "file" | "unsubscribe" | "hide" | "important";
export type ActionStatus = "pending" | "done" | "failed" | "manual";

/** One email as a source hands it over: headers and a short text preview, never the full body. */
export type IncomingMail = {
  id: string; // "<account>:<message id or uid>"
  accountId: string;
  receivedAt: string | null; // ISO
  from: string; // raw From header, e.g. `"SCE" <noreply@sce.com>`
  subject: string;
  snippet: string; // plain text, at most a few hundred characters
  listUnsubscribe: string | null; // raw List-Unsubscribe header
  listUnsubscribePost: string | null; // raw List-Unsubscribe-Post header
};

export type Rule = {
  id: number;
  matchFrom: string | null;
  matchSubject: string | null;
  action: RuleAction;
  folder: string | null;
};

export type Classified = {
  bucket: Bucket;
  level: Level;
  title: string;
  detail: string | null;
};

/** A stored, processed message (what the report reads). */
export type MailRow = {
  id: string;
  accountId: string;
  reportDate: string; // YYYY-MM-DD
  receivedAt: string | null;
  fromName: string | null;
  fromAddr: string | null;
  subject: string;
  bucket: Bucket;
  level: Level;
  title: string;
  detail: string | null;
  action: RuleAction | null;
  actionFolder: string | null;
  actionStatus: ActionStatus | null;
  actionNote: string | null;
  unsubHttp: string | null;
  unsubMailto: string | null;
  oneClick: boolean;
};
