import assert from "node:assert/strict";
import { test } from "node:test";

import { rateLimitFromEnv, resetRateLimits, takeLookup } from "@/lib/rate-limit";

test("env values, with defaults for missing or bad ones", () => {
  assert.deepEqual(rateLimitFromEnv({}), { max: 12, windowMs: 600000 });
  assert.deepEqual(rateLimitFromEnv({ RATE_LIMIT_LOOKUPS: "3", RATE_LIMIT_WINDOW_MINUTES: "1" }), { max: 3, windowMs: 60000 });
  assert.deepEqual(rateLimitFromEnv({ RATE_LIMIT_LOOKUPS: "-1", RATE_LIMIT_WINDOW_MINUTES: "zero" }), { max: 12, windowMs: 600000 });
});

test("lookups past the limit wait until the oldest leaves the window", () => {
  resetRateLimits();
  const limit = { max: 2, windowMs: 60000 };

  assert.equal(takeLookup("v", limit, 0).ok, true);
  assert.equal(takeLookup("v", limit, 1000).ok, true);

  const blocked = takeLookup("v", limit, 2000);

  assert.equal(blocked.ok, false);
  assert.equal(blocked.ok ? 0 : blocked.retryMs, 58000);
  assert.equal(takeLookup("other", limit, 2000).ok, true);
  assert.equal(takeLookup("v", limit, 60001).ok, true);
});

test("a limit of 0 turns the check off", () => {
  resetRateLimits();

  for (let i = 0; i < 50; i++) {
    assert.equal(takeLookup("v", { max: 0, windowMs: 1000 }, i).ok, true);
  }
});
