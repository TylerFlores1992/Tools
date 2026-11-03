import { test } from "node:test";
import assert from "node:assert/strict";
import { currentTab } from "./current-tab.ts";

const MONEY = [
  { href: "/private/money", label: "Overview" },
  { href: "/private/money/budget", label: "Budget" },
  { href: "/private/money/income", label: "Income" },
];

test("the overview tab lights only on its own page, not on every money page", () => {
  assert.equal(currentTab(MONEY, "/private/money"), "/private/money");
  assert.equal(currentTab(MONEY, "/private/money/budget"), "/private/money/budget");
});

test("a page under a tab lights that tab (longest match wins)", () => {
  assert.equal(currentTab(MONEY, "/private/money/income/stubs/7"), "/private/money/income");
});

test("a path that only shares a prefix of letters is not a match", () => {
  assert.equal(currentTab(MONEY, "/private/money/incomes"), "/private/money");
  assert.equal(currentTab(MONEY, "/private/moneybags"), null);
});

test("a path outside every tab lights none", () => {
  assert.equal(currentTab(MONEY, "/private/mail"), null);
});
