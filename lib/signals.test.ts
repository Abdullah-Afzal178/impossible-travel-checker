import assert from "node:assert/strict";
import { test } from "node:test";

import { itemProblem, parseBulk, requestProblem } from "@/lib/api";
import { isSmallHours, localTime, maskSentence, masksFor, parseIpRecord, riskRead } from "@/lib/signals";

const CLEAN = {
  threat_score: 0, is_tor: false, is_proxy: false, proxy_provider_names: [], proxy_confidence_score: 0, proxy_last_seen: "",
  proxy_days_seen_30d: 0, proxy_days_seen_7d: 0, proxy_provider_count_30d: 0, is_residential_proxy: false, is_vpn: false,
  vpn_provider_names: [], vpn_confidence_score: 0, vpn_last_seen: "", is_relay: false, relay_provider_name: "", is_anonymous: false,
  is_known_attacker: false, is_bot: false, bot_confidence_score: 0, bot_operator_name: "", bot_type: "", is_known_good_bot: false,
  bot_last_seen: "", is_spam: false, is_cloud_provider: false, cloud_provider_name: "", is_corporate_gateway: false,
  corporate_gateway_type: "", corporate_gateway_provider_name: "",
};

function item(ip: string, city: string, lat: string, lon: string, asnType: string, security?: Record<string, unknown>) {
  return {
    ip,
    location: { city, state_prov: "", country_name: "Somewhere", country_code2: "SW", latitude: lat, longitude: lon },
    network: { connection_type: "Cable" },
    asn: { as_number: "AS64500", organization: "Example Net", type: asnType },
    company: { name: "Example Net" },
    time_zone: { name: "America/New_York" },
    ...(security ? { security } : {}),
  };
}

const HOME = item("72.229.28.185", "New York", "40.73661", "-74.00945", "ISP", CLEAN);
const VPN = item("203.0.113.9", "Amsterdam", "52.37", "4.89", "HOSTING", { ...CLEAN, is_vpn: true, vpn_provider_names: ["NordVPN"], is_anonymous: true, is_cloud_provider: true, cloud_provider_name: "Example Cloud", threat_score: 45 });
const TOR = item("185.220.101.1", "Berlin", "52.51604", "13.37691", "BUSINESS", { ...CLEAN, is_tor: true, is_anonymous: true, is_known_attacker: true, threat_score: 80 });
const RELAY = item("172.224.226.1", "Chicago", "41.88", "-87.63", "HOSTING", { ...CLEAN, is_relay: true, relay_provider_name: "Apple iCloud Private Relay" });
const CORPORATE = item("198.51.100.20", "Frankfurt", "50.11", "8.68", "BUSINESS", { ...CLEAN, is_corporate_gateway: true, corporate_gateway_type: "Secure web gateway", corporate_gateway_provider_name: "Example SWG" });
const RESI = item("198.51.100.30", "Lagos", "6.45", "3.39", "ISP", { ...CLEAN, is_proxy: true, is_residential_proxy: true, proxy_provider_names: ["Example Proxies"] });

test("an API item becomes a record", () => {
  const record = parseIpRecord(HOME);

  assert.ok(record);
  assert.equal(record.city, "New York");
  assert.deepEqual(record.point, { lat: 40.73661, lon: -74.00945 });
  assert.equal(record.asnType, "ISP");
  assert.equal(record.connectionType, "Cable");
  assert.equal(record.security?.threatScore, 0);
  assert.equal(parseIpRecord({ message: "nope" }), null);
  assert.equal(parseIpRecord({ ip: "1.2.3.4", location: { latitude: "", longitude: "" } }), null);
});

test("no security block means unknown, not clean", () => {
  const record = parseIpRecord(item("72.229.28.185", "New York", "40.7", "-74", "ISP"));

  assert.equal(record?.security, null);
  assert.deepEqual(masksFor(record!), []);
});

test("masks: VPN with provider, cloud alongside", () => {
  const masks = masksFor(parseIpRecord(VPN)!);

  assert.deepEqual(masks.map((mask) => mask.kind), ["vpn", "cloud"]);
  assert.equal(masks[0].provider, "NordVPN");
  assert.match(maskSentence("B", masks[0]), /^Login B came through a VPN \(NordVPN\), so its location/);
});

test("masks: Tor, relay, corporate gateway, residential proxy", () => {
  assert.deepEqual(masksFor(parseIpRecord(TOR)!).map((mask) => mask.kind), ["tor"]);
  assert.equal(masksFor(parseIpRecord(RELAY)!)[0].provider, "Apple iCloud Private Relay");
  assert.deepEqual(masksFor(parseIpRecord(CORPORATE)!).map((mask) => mask.kind), ["corporate"]);
  assert.equal(masksFor(parseIpRecord(CORPORATE)!)[0].provider, "Example SWG, Secure web gateway");
  assert.deepEqual(masksFor(parseIpRecord(RESI)!).map((mask) => mask.kind), ["residential-proxy"]);
});

test("masks: a hosting ASN is a hint even without Security data", () => {
  const record = parseIpRecord(item("45.155.205.233", "Moscow", "55.76", "37.55", "HOSTING"))!;

  assert.deepEqual(masksFor(record).map((mask) => mask.kind), ["hosting"]);
  assert.deepEqual(masksFor(parseIpRecord(HOME)!), []);
});

test("risk read: impossible and both residential is high risk", () => {
  const read = riskRead("impossible", [], [], true, false);

  assert.equal(read.level, "high");
  assert.match(read.body, /shared or stolen credentials/);
});

test("risk read: impossible with an anonymizer is a likely network artifact, still reviewed", () => {
  const read = riskRead("impossible", [], masksFor(parseIpRecord(VPN)!), true, false);

  assert.equal(read.level, "review");
  assert.match(read.title, /network artifact/);
});

test("risk read: plausible and clean is low, unknown security is said out loud", () => {
  assert.equal(riskRead("plausible", [], [], true, false).level, "low");
  assert.match(riskRead("impossible", [], [], false, false).body, /can't be ruled out/);
  assert.equal(riskRead("plausible", [], [], true, true).level, "review");
  assert.equal(riskRead("tight", [], [], true, false).level, "review");
});

test("local time at the login's place", () => {
  const at = Date.UTC(2026, 10, 10, 8, 30);
  const local = localTime(at, "America/New_York");

  assert.equal(local?.hour, 3);
  assert.equal(local?.text, "Tue 10 Nov, 3:30 AM");
  assert.equal(isSmallHours(local!.hour), true);
  assert.equal(localTime(at, "Europe/Moscow")?.hour, 11);
  assert.equal(localTime(Date.UTC(2026, 10, 10, 5, 0), "UTC")?.hour, 5);
  assert.equal(isSmallHours(5), false);
  assert.equal(localTime(at, ""), null);
  assert.equal(localTime(at, "Not/AZone"), null);
});

test("bulk answers line up with the IPs, bogons included", () => {
  const items = parseBulk([HOME, { message: "'10.0.0.1' is a bogon IP address." }], ["72.229.28.185", "10.0.0.1"]);

  assert.ok(items);
  assert.equal(items[0].ok, true);
  assert.equal(items[1].ok, false);
  assert.equal(items[1].ok ? "" : items[1].problem.title, "Reserved address");
  assert.equal(parseBulk({ message: "error" }, ["1.1.1.1"]), null);
});

test("error mapping", () => {
  assert.equal(requestProblem(401).title, "API key refused");
  assert.equal(requestProblem(429).title, "Too many requests");
  assert.equal(requestProblem(0).title, "No answer");
  assert.equal(requestProblem(503).title, "Lookup failed");
  assert.equal(itemProblem("1.2.3.4", "", 423).title, "Reserved address");
  assert.equal(itemProblem("1.2.3.4", "Provided name, service or IP address '1.2.3.4' is not valid.").title, "Not a valid IP");
});
