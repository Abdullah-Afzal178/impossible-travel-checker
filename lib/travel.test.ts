import assert from "node:assert/strict";
import { test } from "node:test";

import { distanceKm, greatCirclePoints, isLand, routeLabelPoint, routePath } from "@/lib/geo";
import { assessTravel, formatDistance, formatDuration, formatSpeed, TRAVEL } from "@/lib/travel";

const NEW_YORK = { lat: 40.73661, lon: -74.00945 };
const LONDON = { lat: 51.50967, lon: -0.09925 };
const MOSCOW = { lat: 55.76232, lon: 37.5545 };
const BROOKLYN = { lat: 40.6782, lon: -73.9442 };
const TOKYO = { lat: 35.68635, lon: 139.68984 };
const SANTA_ANA = { lat: 33.74639, lon: -117.86045 };
const HOUR = 3600000;
const T0 = Date.UTC(2026, 10, 10, 9, 0);

test("haversine distances match known city pairs", () => {
  assert.ok(Math.abs(distanceKm(NEW_YORK, LONDON) - 5570) < 15);
  assert.ok(Math.abs(distanceKm(NEW_YORK, MOSCOW) - 7510) < 25);
  assert.equal(distanceKm(LONDON, LONDON), 0);
  assert.ok(Math.abs(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 }) - Math.PI * 6371.0088) < 0.01);
});

test("New York to Moscow in 90 minutes is impossible", () => {
  const travel = assessTravel(NEW_YORK, T0, MOSCOW, T0 + 1.5 * HOUR);

  assert.equal(travel.verdict, "impossible");
  assert.equal(travel.swapped, false);
  assert.ok(travel.speedKmh > 4900 && travel.speedKmh < 5100);
  assert.ok(travel.modes.every((mode) => !mode.fits));
});

test("New York to London with 13.5 hours is plausible by air", () => {
  const travel = assessTravel(NEW_YORK, T0, LONDON, T0 + 13.5 * HOUR);

  assert.equal(travel.verdict, "plausible");
  assert.equal(travel.modes.find((mode) => mode.id === "flight")?.fits, true);
  assert.equal(travel.modes.find((mode) => mode.id === "car")?.usable, false);
});

test("a fast flight with no time on the ground is tight but possible", () => {
  // About 6.2 h at cruise speed, 8.2 h door to door.
  const travel = assessTravel(NEW_YORK, T0, LONDON, T0 + 7 * HOUR);

  assert.equal(travel.verdict, "tight");
  assert.ok(travel.minimumHours < 7 && travel.realisticHours > 7);
});

test("California to Tokyo in two hours is impossible", () => {
  assert.equal(assessTravel(SANTA_ANA, T0, TOKYO, T0 + 2 * HOUR).verdict, "impossible");
});

test("reversed order is swapped and gives the same answer", () => {
  const forward = assessTravel(NEW_YORK, T0, LONDON, T0 + 12 * HOUR);
  const backward = assessTravel(LONDON, T0 + 12 * HOUR, NEW_YORK, T0);

  assert.equal(backward.swapped, true);
  assert.equal(backward.verdict, forward.verdict);
  assert.equal(Math.round(backward.gapHours), 12);
});

test("zero time gap: impossible far apart, plausible in the same area", () => {
  const far = assessTravel(NEW_YORK, T0, LONDON, T0);

  assert.equal(far.verdict, "impossible");
  assert.equal(far.speedKmh, Infinity);
  assert.equal(formatSpeed(far.speedKmh), "instant");

  const near = assessTravel(NEW_YORK, T0, BROOKLYN, T0);

  assert.equal(near.sameArea, true);
  assert.equal(near.verdict, "plausible");
});

test("the same point twice needs no speed at all", () => {
  const travel = assessTravel(LONDON, T0, LONDON, T0);

  assert.equal(travel.speedKmh, 0);
  assert.equal(travel.verdict, "plausible");
});

test("distances under the same-area threshold are never impossible", () => {
  const nearby = { lat: NEW_YORK.lat + 1, lon: NEW_YORK.lon };

  assert.ok(distanceKm(NEW_YORK, nearby) < TRAVEL.sameAreaKm);
  assert.equal(assessTravel(NEW_YORK, T0, nearby, T0 + 60000).verdict, "plausible");
});

test("a short hop is checked against road and rail", () => {
  // London to Paris in 4 hours: about 340 km, under 3 hours by car.
  const travel = assessTravel(LONDON, T0, { lat: 48.8566, lon: 2.3522 }, T0 + 4 * HOUR);

  assert.equal(travel.verdict, "plausible");
  assert.equal(travel.modes.find((mode) => mode.id === "car")?.fits, true);
  assert.equal(travel.modes.find((mode) => mode.id === "walk")?.usable, false);
});

test("formatting", () => {
  assert.equal(formatDuration(1.5), "1 h 30 min");
  assert.equal(formatDuration(0.25), "15 min");
  assert.equal(formatDuration(26), "1 d 2 h");
  assert.equal(formatDuration(0), "0 min");
  assert.equal(formatDistance(5570.4), "5,570 km");
  assert.equal(formatDistance(1609.344, "mi"), "1,000 mi");
  assert.equal(formatSpeed(5006.7), "5,007 km/h");
});

test("great circle points start and end at the logins and bend north across the Atlantic", () => {
  const points = greatCirclePoints(NEW_YORK, LONDON, 10);

  assert.deepEqual(points[0], NEW_YORK);
  assert.deepEqual(points[10], LONDON);
  assert.ok(points[5].lat > 51.5, "the shortest route passes north of both cities");
});

test("a route across the Pacific is split at the 180th meridian", () => {
  const path = routePath(TOKYO, SANTA_ANA);

  assert.equal((path.match(/M/g) ?? []).length, 2);
  assert.equal((routePath(NEW_YORK, LONDON).match(/M/g) ?? []).length, 1);
});

test("the land mask knows land from sea", () => {
  for (const point of [NEW_YORK, MOSCOW, TOKYO, { lat: -25, lon: 134 }, { lat: 0, lon: 20 }, { lat: -10, lon: -55 }]) {
    assert.equal(isLand(point), true, `${point.lat}, ${point.lon} is land`);
  }

  for (const point of [{ lat: 30, lon: -40 }, { lat: -30, lon: -120 }, { lat: -20, lon: 80 }, { lat: 0, lon: 160 }]) {
    assert.equal(isLand(point), false, `${point.lat}, ${point.lon} is sea`);
  }
});

test("the route label stays inside the map on a Pacific crossing", () => {
  assert.ok(Math.abs(routeLabelPoint(TOKYO, SANTA_ANA).lon) <= 150);
  assert.ok(Math.abs(routeLabelPoint(NEW_YORK, LONDON).lon - -40) < 10);
});
