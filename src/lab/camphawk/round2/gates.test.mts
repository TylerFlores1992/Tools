import { test } from "node:test";
import assert from "node:assert/strict";
import { ROUTES, subscribeHref, watchGateHref } from "./gates.ts";

test("a subscriber's watch button opens New watch with what is known", () => {
  assert.equal(watchGateHref("subscriber", "campground=upper-pines&start=2026-07-18&end=2026-07-21"), `${ROUTES.newWatch}?campground=upper-pines&start=2026-07-18&end=2026-07-21`);
  assert.equal(watchGateHref("subscriber"), ROUTES.newWatch);
});

test("signed out signs up and comes back to the same New watch", () => {
  const href = watchGateHref("signed-out", "campground=upper-pines&start=2026-07-18&end=2026-07-21");
  const url = new URL(href, "https://lab.test");
  assert.equal(url.pathname, ROUTES.signUp);
  assert.equal(url.searchParams.get("redirect_url"), `${ROUTES.newWatch}?campground=upper-pines&start=2026-07-18&end=2026-07-21`);
});

test("everyone else with an account, and the app's guest, goes to Pricing (the store paywall in the app)", () => {
  for (const v of ["member", "lapsed", "app"] as const) assert.equal(watchGateHref(v, "campground=x"), ROUTES.pricing, v);
});

test("no watch button is a dead link", () => {
  for (const v of ["signed-out", "member", "lapsed", "subscriber", "app"] as const) {
    assert.notEqual(watchGateHref(v), "#", v);
    assert.notEqual(subscribeHref(v), "#", v);
  }
  assert.equal(subscribeHref("signed-out"), ROUTES.signUp);
  assert.equal(subscribeHref("lapsed"), ROUTES.pricing);
});
