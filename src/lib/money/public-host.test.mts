/** The address check behind the calendar-link fetch (income/actions.ts previewIcs): no SSRF. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublicAddress } from "./public-host.ts";

test("ordinary public addresses pass", () => {
  for (const ip of ["8.8.8.8", "142.250.80.46", "17.253.144.10", "2607:f8b0:4005:80b::200e", "2a00:1450:4001:82a::200e", "::ffff:8.8.8.8"]) {
    assert.equal(isPublicAddress(ip), true, ip);
  }
});

test("loopback, private, link-local, metadata and reserved addresses are refused", () => {
  for (const ip of [
    "127.0.0.1", "127.255.255.254", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "192.0.2.5", "198.18.0.1",
    "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "2001:db8::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:169.254.169.254", "64:ff9b::a9fe:a9fe", "2002:7f00:1::1", "::127.0.0.1",
  ]) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
});

test("edges of the private ranges", () => {
  assert.equal(isPublicAddress("172.15.255.255"), true);
  assert.equal(isPublicAddress("172.32.0.0"), true);
  assert.equal(isPublicAddress("100.63.255.255"), true);
  assert.equal(isPublicAddress("100.128.0.0"), true);
  assert.equal(isPublicAddress("11.0.0.0"), true);
});

test("anything that isn't an address is not public", () => {
  for (const s of ["", "localhost", "example.com", "1.2.3", "::gggg", "1:2:3:4:5:6:7:8:9"]) assert.equal(isPublicAddress(s), false, s);
});
