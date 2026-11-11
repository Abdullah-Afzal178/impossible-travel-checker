import assert from "node:assert/strict";
import { test } from "node:test";

import { EXAMPLE, ipProblem, isIp, isPrivateIp, pageHref, parseQuery, timeProblem, toInstant } from "@/lib/query";

test("an empty query shows the worked example", () => {
  const query = parseQuery({});

  assert.equal(query.isExample, true);
  assert.equal(query.a, EXAMPLE.a);
  assert.equal(query.tz, "UTC");
});

test("parameters are read, trimmed and normalized", () => {
  const query = parseQuery({ a: " 8.8.8.8 ", at: "2026-11-10 09:00:00", b: "1.1.1.1", bt: "2026-11-10T10:30", tz: "Europe/London" });

  assert.equal(query.isExample, false);
  assert.equal(query.a, "8.8.8.8");
  assert.equal(query.at, "2026-11-10T09:00");
  assert.equal(query.tz, "Europe/London");
  assert.deepEqual(query.problems, []);
});

test("a=me and an unknown zone", () => {
  const query = parseQuery({ a: "ME", b: "1.1.1.1", tz: "Mars/Olympus" });

  assert.equal(query.a, "me");
  assert.equal(query.tz, "UTC");
  assert.equal(query.problems.length, 1);
});

test("pageHref leaves out UTC and empty values", () => {
  assert.equal(pageHref({ a: "8.8.8.8", at: "2026-11-10T09:00", b: "", bt: "", tz: "UTC" }), "/?a=8.8.8.8&at=2026-11-10T09%3A00");
  assert.equal(pageHref({ a: "", at: "", b: "", bt: "", tz: "UTC" }), "/");
});

test("IP validation", () => {
  for (const ip of ["8.8.8.8", "2001:4860:4860::8888", "::ffff:1.2.3.4", "2001:db8:0:0:0:0:0:1"]) {
    assert.equal(isIp(ip), true, ip);
  }

  for (const ip of ["256.1.1.1", "1.2.3", "example.com", "2001:::1", "1:2:3:4:5:6:7:8:9", ""]) {
    assert.equal(isIp(ip), false, ip);
  }

  assert.equal(isPrivateIp("192.168.1.10"), true);
  assert.equal(isPrivateIp("100.64.0.1"), true);
  assert.equal(isPrivateIp("fe80::1"), true);
  assert.equal(isPrivateIp("72.229.28.185"), false);
  assert.match(ipProblem("10.0.0.1") ?? "", /private/);
  assert.match(ipProblem("nope") ?? "", /isn't an IPv4/);
  assert.equal(ipProblem("45.155.205.233"), null);
});

test("wall-clock times convert to instants in their zone", () => {
  assert.equal(toInstant("2026-11-10T09:00", "UTC"), Date.UTC(2026, 10, 10, 9, 0));
  // New York is on EST (UTC-5) in November and EDT (UTC-4) in July.
  assert.equal(toInstant("2026-11-10T09:00", "America/New_York"), Date.UTC(2026, 10, 10, 14, 0));
  assert.equal(toInstant("2026-07-10T09:00", "America/New_York"), Date.UTC(2026, 6, 10, 13, 0));
  assert.equal(toInstant("2026-11-10T09:00", "Asia/Kolkata"), Date.UTC(2026, 10, 10, 3, 30));
  assert.equal(toInstant("2026-02-30T09:00", "UTC"), null);
  assert.equal(toInstant("yesterday", "UTC"), null);
});

test("time problems", () => {
  assert.match(timeProblem("", "login A") ?? "", /No time/);
  assert.match(timeProblem("10/11/2026", "login A") ?? "", /should look like/);
  assert.equal(timeProblem("2026-11-10T09:00", "login A"), null);
});
