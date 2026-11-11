/** The worked example shown when nothing has been entered. */
export const EXAMPLE = {
  a: "72.229.28.185",
  at: "2026-11-10T09:00",
  b: "45.155.205.233",
  bt: "2026-11-10T10:30",
  tz: "UTC",
};

/** Time zones offered for "times are in". Any other valid IANA name in the URL works too. */
export const ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export type Query = {
  /** An IP address, "me" for the visitor's own address, or "" when not given. */
  a: string;
  b: string;
  /** Datetimes as typed, "YYYY-MM-DDTHH:MM". */
  at: string;
  bt: string;
  tz: string;
  /** True when nothing was entered and the worked example is showing. */
  isExample: boolean;
  problems: string[];
};

type Params = Record<string, string | string[] | undefined>;

export function parseQuery(params: Params): Query {
  const get = (name: string) => {
    const value = params[name];

    return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 64) ?? "";
  };
  const raw = { a: get("a"), at: get("at"), b: get("b"), bt: get("bt"), tz: get("tz") };

  if (!raw.a && !raw.b && !raw.at && !raw.bt) {
    return { ...EXAMPLE, isExample: true, problems: [] };
  }

  const problems: string[] = [];
  let tz = raw.tz || "UTC";

  if (!isZone(tz)) {
    problems.push(`“${tz}” isn't a time zone name, so the times are read as UTC.`);
    tz = "UTC";
  }

  const a = raw.a.toLowerCase() === "me" ? "me" : raw.a;

  return { a, at: normalizeDateTime(raw.at), b: raw.b, bt: normalizeDateTime(raw.bt), tz, isExample: false, problems };
}

/** The page's URL for a query, for links and the scenario chips. */
export function pageHref(query: Pick<Query, "a" | "at" | "b" | "bt" | "tz">): string {
  const params = new URLSearchParams();

  for (const key of ["a", "at", "b", "bt"] as const) {
    if (query[key]) {
      params.set(key, query[key]);
    }
  }

  if (query.tz && query.tz !== "UTC") {
    params.set("tz", query.tz);
  }

  const search = params.toString();

  return search ? `/?${search}` : "/";
}

// --- IP addresses ----------------------------------------------------------------

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export function isIpv4(value: string): boolean {
  return IPV4.test(value);
}

export function isIpv6(value: string): boolean {
  if (!/^[0-9a-f:.]+$/i.test(value) || !value.includes(":") || value.includes(":::") || (value.match(/::/g) ?? []).length > 1) {
    return false;
  }

  let groups = value.split(":");
  const last = groups[groups.length - 1];

  // An embedded IPv4 tail (::ffff:1.2.3.4) counts as two groups.
  if (last.includes(".")) {
    if (!isIpv4(last)) {
      return false;
    }

    groups = [...groups.slice(0, -1), "0", "0"];
  }

  if (value.includes("::")) {
    return groups.filter((group) => group !== "").every((group) => /^[0-9a-f]{1,4}$/i.test(group)) && groups.filter((group) => group !== "").length < 8;
  }

  return groups.length === 8 && groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group));
}

export const isIp = (value: string) => isIpv4(value) || isIpv6(value);

/** Loopback, private, link-local and shared ranges: these have no location. */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    return /^(::1?$|f[cd]|fe[89ab])/i.test(ip);
  }

  const [a, b] = ip.split(".").map(Number);

  return a === 0 || a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
}

/** Why an IP can't be checked, or null when it can. */
export function ipProblem(value: string): string | null {
  if (!value) {
    return "No IP address entered.";
  }

  if (!isIp(value)) {
    return `“${value}” isn't an IPv4 or IPv6 address.`;
  }

  if (isPrivateIp(value)) {
    return `${value} is a private or local address, which has no location on the internet. Use the public address from your sign-in logs.`;
  }

  return null;
}

// --- times -------------------------------------------------------------------------

/** Accepts "2026-11-10T09:00", "2026-11-10 09:00" and with seconds; returns "YYYY-MM-DDTHH:MM" or the input unchanged. */
export function normalizeDateTime(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);

  return match ? `${match[1]}T${match[2]}:${match[3]}` : value;
}

export function isZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });

    return true;
  } catch {
    return false;
  }
}

/** Offset of a time zone from UTC at an instant, in minutes. */
export function zoneOffsetMinutes(timeZone: string, at: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));

  return Math.round((asUtc - Math.floor(at / 1000) * 1000) / 60000);
}

/**
 * A wall-clock time in a zone, as an instant (ms). Null when the text isn't a
 * date and time. Times in a skipped DST hour resolve to the later offset.
 */
export function toInstant(value: string, timeZone: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [year, month, day, hour, minute] = match.slice(1).map(Number);

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }

  const wall = Date.UTC(year, month - 1, day, hour, minute);

  if (new Date(wall).getUTCDate() !== day) {
    return null;
  }

  // Guess with the offset at the wall time, then correct once with the offset at the guess.
  const first = wall - zoneOffsetMinutes(timeZone, wall) * 60000;

  return wall - zoneOffsetMinutes(timeZone, first) * 60000;
}

/** Why a login time can't be used, or null when it can. */
export function timeProblem(value: string, label: string): string | null {
  if (!value) {
    return `No time entered for ${label}.`;
  }

  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? null : `The time for ${label} should look like 2026-11-10 09:00.`;
}
