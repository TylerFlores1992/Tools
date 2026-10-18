import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Yahoo app passwords are stored encrypted (AES-256-GCM) under MAIL_SECRET_KEY, a Vercel
 * Sensitive variable, so a database read alone does not reveal them. Format: v1.<iv>.<tag>.<data>,
 * base64url. A missing key refuses to store or read anything (fail closed).
 */

function key(): Buffer {
  const raw = process.env.MAIL_SECRET_KEY ?? "";
  if (!/^[0-9a-f]{64}$/i.test(raw)) throw new Error("MAIL_SECRET_KEY is not set");
  return Buffer.from(raw, "hex");
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function openSecret(sealed: string): string {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("unreadable secret");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newKey = () => randomBytes(32).toString("base64url");
