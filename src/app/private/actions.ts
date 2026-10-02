"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_DAYS, SESSION_PATH, createSession, passwordMatches, safeNext } from "@/lib/private-auth";

export type SignInState = { error?: "empty" | "wrong" | "unset"; attempt: number };

/** Checks the password, sets the session cookie and goes where the visitor was headed. */
export async function signIn(prev: SignInState, form: FormData): Promise<SignInState> {
  const attempt = prev.attempt + 1;
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? ""));
  const secret = process.env.LAB_PASSWORD;

  if (!secret) return { error: "unset", attempt };
  if (password === "") return { error: "empty", attempt };
  if (!passwordMatches(password, secret)) {
    // A short pause makes guessing slow without bothering the owner.
    await new Promise((r) => setTimeout(r, 600));
    return { error: "wrong", attempt };
  }

  (await cookies()).set(SESSION_COOKIE, createSession(secret), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: SESSION_PATH,
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect(next);
}

/** Forgets this device and returns home. */
export async function signOut(): Promise<void> {
  (await cookies()).delete({ name: SESSION_COOKIE, path: SESSION_PATH });
  redirect("/");
}
