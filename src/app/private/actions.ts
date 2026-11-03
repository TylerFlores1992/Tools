"use server";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_DAYS, SESSION_PATH, createSession, passwordMatches, safeNext } from "@/lib/private-auth";
import { Throttle, clientKey } from "./sign-in/throttle";

export type SignInState = { error?: "empty" | "wrong" | "unset" | "locked"; attempt: number };

/** Every wrong try waits this long before answering, so guessing is slow even before the lockout. */
const WRONG_DELAY_MS = 1_500;

// Per server instance: see sign-in/throttle.ts for what this does and doesn't protect against.
const throttle = new Throttle();
const salt = randomBytes(16).toString("hex");

/** Checks the password, sets the session cookie and goes where the visitor was headed. */
export async function signIn(prev: SignInState, form: FormData): Promise<SignInState> {
  const attempt = prev.attempt + 1;
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? ""));
  const secret = process.env.LAB_PASSWORD;

  if (!secret) return { error: "unset", attempt };
  if (password === "") return { error: "empty", attempt };
  const h = await headers();
  const key = clientKey(h.get("x-forwarded-for"), h.get("x-real-ip"), salt);
  if (throttle.lockedFor(key) > 0) {
    // Locked out: the password isn't checked at all, so a right guess now teaches nothing.
    await pause(WRONG_DELAY_MS);
    return { error: "locked", attempt };
  }
  if (!passwordMatches(password, secret)) {
    const nowLocked = throttle.fail(key);
    await pause(WRONG_DELAY_MS);
    return { error: nowLocked ? "locked" : "wrong", attempt };
  }
  throttle.succeed(key);

  (await cookies()).set(SESSION_COOKIE, createSession(secret), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: SESSION_PATH,
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect(next);
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Forgets this device and returns home. */
export async function signOut(): Promise<void> {
  (await cookies()).delete({ name: SESSION_COOKIE, path: SESSION_PATH });
  redirect("/");
}
