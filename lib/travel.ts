import { distanceKm, kmToMiles, type Point } from "@/lib/geo";

/**
 * The thresholds behind the verdict. They are deliberately plain numbers so
 * a security team can match them to its own policy.
 */
export const TRAVEL = {
  /**
   * IP location is usually city level and can be tens of km out, more for
   * mobile carriers. Two logins closer than this are treated as the same area.
   */
  sameAreaKm: 150,
  /** Allowance for location error on each end when testing the bare minimum. */
  accuracyKm: 50,
  /** Airliner cruise speed, the fastest way an ordinary person travels. */
  airlinerKmh: 900,
};

export type Mode = {
  id: "walk" | "car" | "rail" | "flight";
  label: string;
  speedKmh: number;
  /** Fixed time on top of the moving time: getting to the station or airport, boarding, and so on. */
  overheadHours: number;
  /** Beyond this the mode isn't a realistic way to make the trip (ocean crossings, long drives). */
  maxKm: number;
};

export const MODES: Mode[] = [
  { id: "walk", label: "On foot", speedKmh: 5, overheadHours: 0, maxKm: 60 },
  { id: "car", label: "By car", speedKmh: 120, overheadHours: 0, maxKm: 2500 },
  { id: "rail", label: "High-speed rail", speedKmh: 300, overheadHours: 0.5, maxKm: 2000 },
  { id: "flight", label: "Airliner", speedKmh: TRAVEL.airlinerKmh, overheadHours: 2, maxKm: Infinity },
];

export type ModeCheck = Mode & {
  /** Door-to-door hours for this trip. */
  hours: number;
  fits: boolean;
  /** False when the trip is too long for this mode to be realistic. */
  usable: boolean;
};

export type VerdictId = "plausible" | "tight" | "impossible";

export type Travel = {
  distanceKm: number;
  distanceMiles: number;
  /** Time between the two logins, in hours, earlier one first. */
  gapHours: number;
  /** True when login B came before login A, so they were swapped. */
  swapped: boolean;
  /** km/h needed to cover the distance in the gap. Infinity for a zero gap over a real distance. */
  speedKmh: number;
  speedMph: number;
  sameArea: boolean;
  /** The fastest realistic door-to-door trip, in hours. */
  realisticHours: number;
  /** The least time the trip could take: cruise speed, no overhead, generous location error. */
  minimumHours: number;
  modes: ModeCheck[];
  verdict: VerdictId;
};

/**
 * Could one person have made both logins? `first` and `second` are instants
 * in ms; their order doesn't matter.
 */
export function assessTravel(a: Point, aAt: number, b: Point, bAt: number): Travel {
  const swapped = bAt < aAt;
  const km = distanceKm(a, b);
  const gapHours = Math.abs(bAt - aAt) / 3600000;
  const sameArea = km < TRAVEL.sameAreaKm;
  const speedKmh = km === 0 ? 0 : gapHours === 0 ? Infinity : km / gapHours;

  const modes: ModeCheck[] = MODES.map((mode) => {
    const hours = mode.overheadHours + km / mode.speedKmh;
    const usable = km <= mode.maxKm;

    return { ...mode, hours, usable, fits: usable && hours <= gapHours };
  });

  const realisticHours = Math.min(...modes.filter((mode) => mode.usable).map((mode) => mode.hours));
  const minimumHours = Math.max(0, km - 2 * TRAVEL.accuracyKm) / TRAVEL.airlinerKmh;

  let verdict: VerdictId;

  if (sameArea || gapHours >= realisticHours) {
    verdict = "plausible";
  } else if (gapHours >= minimumHours) {
    verdict = "tight";
  } else {
    verdict = "impossible";
  }

  return {
    distanceKm: km,
    distanceMiles: kmToMiles(km),
    gapHours,
    swapped,
    speedKmh,
    speedMph: Number.isFinite(speedKmh) ? kmToMiles(speedKmh) : Infinity,
    sameArea,
    realisticHours,
    minimumHours,
    modes,
    verdict,
  };
}

export const VERDICT_TEXT: Record<VerdictId, { label: string; line: string }> = {
  plausible: { label: "Plausible", line: "One person could have made both logins." },
  tight: { label: "Tight but possible", line: "Only with a fast flight and no time lost on the ground." },
  impossible: { label: "Impossible travel", line: "Nobody could travel this far in the time between the logins." },
};

// --- formatting ----------------------------------------------------------------

export function formatDuration(hours: number): string {
  if (!Number.isFinite(hours)) {
    return "never";
  }

  const minutes = Math.round(hours * 60);

  if (minutes < 1) {
    return hours === 0 ? "0 min" : "under 1 min";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const days = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;

  if (days > 0) {
    return h > 0 ? `${days} d ${h} h` : `${days} d`;
  }

  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

export function formatSpeed(kmh: number, unit: "km/h" | "mph" = "km/h"): string {
  if (!Number.isFinite(kmh)) {
    return "instant";
  }

  const value = unit === "mph" ? kmToMiles(kmh) : kmh;

  return `${Math.round(value).toLocaleString("en-US")} ${unit}`;
}

export function formatDistance(km: number, unit: "km" | "mi" = "km"): string {
  const value = unit === "mi" ? kmToMiles(km) : km;

  return `${(value < 10 ? Math.round(value * 10) / 10 : Math.round(value)).toLocaleString("en-US")} ${unit}`;
}
