import { parseIpRecord, type IpRecord } from "@/lib/signals";

export const API_BASE = "https://api.ipgeolocation.io/v3";

/** Only what the page uses, so the answers stay small. */
export const FIELDS = [
  "location.city",
  "location.district",
  "location.state_prov",
  "location.country_name",
  "location.country_code2",
  "location.latitude",
  "location.longitude",
  "network.connection_type",
  "asn.as_number",
  "asn.organization",
  "asn.type",
  "company.name",
  "time_zone.name",
].join(",");

export type Problem = { title: string; message: string };

/** One IP's answer: a record, or why there isn't one. */
export type Item = { ok: true; record: IpRecord } | { ok: false; problem: Problem };

/** Whether the Security module's data is in the answer, and if not, why not. */
export type SecurityState = "ok" | "paid" | "unavailable";

/** Reads a /ipgeo-bulk answer. Items line up with the IPs that were sent. */
export function parseBulk(payload: unknown, ips: string[]): Item[] | null {
  if (!Array.isArray(payload)) {
    return null;
  }

  return ips.map((ip, index) => {
    const value = payload.find((item) => item && typeof item === "object" && (item as { ip?: unknown }).ip === ip) ?? payload[index];

    return parseItem(value, ip);
  });
}

export function parseItem(value: unknown, ip: string): Item {
  const record = parseIpRecord(value);

  if (record) {
    return { ok: true, record: { ...record, ip: record.ip || ip } };
  }

  const message = value && typeof value === "object" ? (value as { message?: unknown }).message : undefined;

  return { ok: false, problem: itemProblem(ip, typeof message === "string" ? message : "") };
}

/** A per-IP failure, from a bulk item's message or a single lookup's status. */
export function itemProblem(ip: string, message: string, status?: number): Problem {
  if (status === 423 || /bogon|reserved|private/i.test(message)) {
    return { title: "Reserved address", message: `${ip} is a reserved (bogon) address, so it has no location on the internet.` };
  }

  if (status === 400 || /not valid/i.test(message)) {
    return { title: "Not a valid IP", message: `ipgeolocation.io didn't accept ${ip} as an IP address.` };
  }

  return { title: "No location", message: `ipgeolocation.io had no location for ${ip}.${message ? ` It said: ${message}` : ""}` };
}

/** A whole-request failure, for the page's error card. */
export function requestProblem(status: number, message = ""): Problem {
  if (status === 401 || status === 403) {
    return { title: "API key refused", message: "ipgeolocation.io refused the API key. Check IPGEOLOCATION_API_KEY in your .env file." };
  }

  if (status === 429) {
    return { title: "Too many requests", message: "The API's request limit or credit balance was reached. Try again in a minute." };
  }

  if (status === 0) {
    return { title: "No answer", message: "ipgeolocation.io could not be reached in time. Try again in a moment." };
  }

  if (status >= 500) {
    return { title: "Lookup failed", message: "ipgeolocation.io had a problem answering. Try again in a moment." };
  }

  return { title: "Lookup failed", message: `The lookup failed with status ${status}.${message ? ` It said: ${message}` : ""}` };
}
