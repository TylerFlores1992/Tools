import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createBrowserStore, isRecord } from "./browserStore.ts";

// A stand-in window: storage that works, or that throws like a blocked one.
let stored = new Map<string, string>();
let blocked = false;
beforeEach(() => {
  stored = new Map();
  blocked = false;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => { if (blocked) throw new Error("SecurityError"); return stored.get(k) ?? null; },
      setItem: (k: string, v: string) => { if (blocked) throw new Error("QuotaExceededError"); stored.set(k, v); },
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
});

const store = () => createBrowserStore<Record<string, string>>("k", {}, isRecord as (x: unknown) => x is Record<string, string>);

test("with working storage, a change is kept in memory and saved", () => {
  const s = store();
  let heard = 0;
  s.subscribe(() => { heard += 1; });
  s.set({ a: "approved" });
  assert.deepEqual(s.get(), { a: "approved" });
  assert.equal(stored.get("k"), JSON.stringify({ a: "approved" }));
  assert.equal(s.saveFailed(), false);
  assert.equal(heard, 1);
});

test("with storage blocked, a change still shows and says it wasn't saved", () => {
  blocked = true;
  const s = store();
  assert.deepEqual(s.get(), {});
  s.set({ a: "hidden" });
  assert.deepEqual(s.get(), { a: "hidden" }, "the click is not lost");
  assert.equal(s.saveFailed(), true);
});

test("a saved value is read back, and a bad one falls back without claiming storage failed", () => {
  stored.set("k", JSON.stringify({ b: "approved" }));
  assert.deepEqual(store().get(), { b: "approved" });
  stored.set("k", "{not json");
  const s = store();
  assert.deepEqual(s.get(), {});
  assert.equal(s.saveFailed(), false);
  stored.set("k", "[1,2]");
  assert.deepEqual(store().get(), {}, "an array is not a record");
});

test("the snapshot is the same object until it changes", () => {
  const s = store();
  assert.equal(s.get(), s.get());
  const before = s.get();
  s.set({ c: "x" });
  assert.notEqual(s.get(), before);
});
