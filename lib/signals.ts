import type { Point } from "@/lib/geo";
import type { VerdictId } from "@/lib/travel";

/** What the page knows about one login's IP address. */
export type IpRecord = {
  ip: string;
  point: Point;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  timeZone: string;
  asn: string;
  org: string;
  /** ASN type from the API: ISP, HOSTING, BUSINESS, EDUCATION and so on. */
  asnType: string;
  connectionType: string;
  /** Null when the Security module wasn't part of the answer. */
  security: Security | null;
};

export type Security = {
  threatScore: number;
  isTor: boolean;
  isProxy: boolean;
  proxyProviders: string[];
  isResidentialProxy: boolean;
  isVpn: boolean;
  vpnProviders: string[];
  isRelay: boolean;
  relayProvider: string;
  isAnonymous: boolean;
  isKnownAttacker: boolean;
  isBot: boolean;
  isSpam: boolean;
  isCloudProvider: boolean;
  cloudProvider: string;
  isCorporateGateway: boolean;
  corporateGatewayType: string;
  corporateGatewayProvider: string;
};

/** Reads one item of an /ipgeo or /ipgeo-bulk answer. Null when it has no usable location. */
export function parseIpRecord(value: unknown): IpRecord | null {
  const item = asObject(value);
  const location = asObject(item?.location);
  const lat = Number.parseFloat(text(location?.latitude));
  const lon = Number.parseFloat(text(location?.longitude));

  if (!item || !location || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const asn = asObject(item.asn);
  const company = asObject(item.company);
  const network = asObject(item.network);
  const zone = asObject(item.time_zone);

  return {
    ip: text(item.ip),
    point: { lat, lon },
    city: text(location.city) || text(location.district),
    region: text(location.state_prov),
    country: text(location.country_name),
    countryCode: text(location.country_code2),
    timeZone: text(zone?.name),
    asn: text(asn?.as_number),
    org: text(asn?.organization) || text(company?.name),
    asnType: text(asn?.type).toUpperCase(),
    connectionType: text(network?.connection_type),
    security: parseSecurity(item.security),
  };
}

export function parseSecurity(value: unknown): Security | null {
  const s = asObject(value);

  if (!s || Object.keys(s).length === 0) {
    return null;
  }

  return {
    threatScore: typeof s.threat_score === "number" ? s.threat_score : 0,
    isTor: s.is_tor === true,
    isProxy: s.is_proxy === true,
    proxyProviders: list(s.proxy_provider_names),
    isResidentialProxy: s.is_residential_proxy === true,
    isVpn: s.is_vpn === true,
    vpnProviders: list(s.vpn_provider_names),
    isRelay: s.is_relay === true,
    relayProvider: text(s.relay_provider_name),
    isAnonymous: s.is_anonymous === true,
    isKnownAttacker: s.is_known_attacker === true,
    isBot: s.is_bot === true,
    isSpam: s.is_spam === true,
    isCloudProvider: s.is_cloud_provider === true,
    cloudProvider: text(s.cloud_provider_name),
    isCorporateGateway: s.is_corporate_gateway === true,
    corporateGatewayType: text(s.corporate_gateway_type),
    corporateGatewayProvider: text(s.corporate_gateway_provider_name),
  };
}

// --- what the network says -------------------------------------------------------

export type MaskKind = "tor" | "vpn" | "relay" | "residential-proxy" | "proxy" | "corporate" | "cloud" | "hosting";

/** Something that means the IP's location may not be where the person is. */
export type Mask = {
  kind: MaskKind;
  label: string;
  /** Provider name when the API gives one. */
  provider: string;
  /** Why this moves the location, in one sentence. */
  why: string;
};

/**
 * Everything about an IP that could make its location a network artifact
 * rather than the person's position, strongest first. Without the Security
 * module only the ASN type is available, which still catches data centres.
 */
export function masksFor(record: IpRecord): Mask[] {
  const s = record.security;
  const masks: Mask[] = [];

  if (s?.isTor) {
    masks.push({ kind: "tor", label: "Tor exit node", provider: "", why: "Tor traffic leaves from a volunteer exit node anywhere in the world, so the location is the exit node's." });
  }

  if (s?.isVpn) {
    masks.push({ kind: "vpn", label: "VPN", provider: s.vpnProviders.join(", "), why: "a VPN shows the VPN server's location, not the person's." });
  }

  if (s?.isRelay) {
    masks.push({
      kind: "relay",
      label: "Privacy relay",
      provider: s.relayProvider,
      why: "privacy relays such as Apple iCloud Private Relay hand out egress addresses that only roughly match the user's region.",
    });
  }

  if (s?.isResidentialProxy) {
    masks.push({ kind: "residential-proxy", label: "Residential proxy", provider: s.proxyProviders.join(", "), why: "residential proxies route traffic through someone else's home connection, often in another city or country." });
  } else if (s?.isProxy) {
    masks.push({ kind: "proxy", label: "Proxy", provider: s.proxyProviders.join(", "), why: "a proxy shows its own location, not the person's." });
  }

  if (s?.isCorporateGateway) {
    masks.push({
      kind: "corporate",
      label: "Corporate gateway",
      provider: [s.corporateGatewayProvider, s.corporateGatewayType].filter(Boolean).join(", "),
      why: "company networks and secure web gateways send staff traffic out through a central office or cloud point of presence.",
    });
  }

  if (s?.isCloudProvider) {
    masks.push({ kind: "cloud", label: "Cloud provider", provider: s.cloudProvider, why: "a cloud server is where the traffic left the internet, which is rarely where a person is sitting." });
  } else if (record.asnType === "HOSTING" && !masks.length) {
    masks.push({ kind: "hosting", label: "Hosting network", provider: record.org, why: "hosting networks are where VPN servers, proxies and cloud machines usually live, not people." });
  }

  return masks;
}

/** A short "Login B came through a VPN (NordVPN)" style sentence. */
export function maskSentence(login: "A" | "B", mask: Mask): string {
  const what: Record<MaskKind, string> = {
    tor: "came through a Tor exit node",
    vpn: "came through a VPN",
    relay: "came through a privacy relay",
    "residential-proxy": "came through a residential proxy",
    proxy: "came through a proxy",
    corporate: "came through a corporate gateway",
    cloud: "came from a cloud provider's network",
    hosting: "came from a hosting network",
  };
  const provider = mask.provider ? ` (${mask.provider})` : "";

  return `Login ${login} ${what[mask.kind]}${provider}, so its location is the network's, not necessarily the person's: ${mask.why}`;
}

// --- the combined read ---------------------------------------------------------------

export type RiskLevel = "low" | "review" | "high";

export type RiskRead = {
  level: RiskLevel;
  title: string;
  body: string;
  /** Steps worth taking, most useful first. */
  steps: string[];
};

/**
 * Travel verdict plus network signals, as one read a security analyst can act
 * on. `securityKnown` says whether both IPs had Security data.
 */
export function riskRead(verdict: VerdictId, masksA: Mask[], masksB: Mask[], securityKnown: boolean, attackerFlag: boolean): RiskRead {
  const masked = masksA.length > 0 || masksB.length > 0;
  const unknownNote = securityKnown ? "" : " VPN, proxy and Tor data wasn't available for this check, so a masked connection can't be ruled out.";

  if (verdict === "plausible") {
    return masked || attackerFlag
      ? {
          level: "review",
          title: "The travel adds up, the network is worth a look",
          body: `The time between the logins is enough to make the trip, so this is not impossible travel. ${attackerFlag ? "One address has a history of attacks, which deserves a look on its own." : "One login came through a masking network, which is common and usually harmless, but worth knowing."}`,
          steps: ["Check the device and browser of each login match the user's usual ones.", "If the masked login is unexpected, ask the user whether they use a VPN or relay."],
        }
      : {
          level: "low",
          title: "No impossible travel here",
          body: `Both logins fit a journey one person could make.${unknownNote}`,
          steps: ["No action needed on travel grounds. Keep the usual checks on device, MFA and behavior."],
        };
  }

  const tightNote = verdict === "tight" ? "The trip is only possible with a fast flight and no time lost at either end. " : "Nobody could make this trip in the time between the logins. ";

  if (masked) {
    return {
      level: "review",
      title: "Likely a network artifact, but check the account",
      body: `${tightNote}At least one login came through a VPN, proxy, relay, Tor, a corporate gateway or a hosting network, which moves the apparent location. The usual innocent cause is the user turning a VPN on or off. The worrying one is a second person using the same credentials from behind an anonymizer.`,
      steps: [
        "Ask the user whether they use a VPN, iCloud Private Relay or a work gateway.",
        "Compare devices, browsers and MFA results for the two sessions.",
        "If the user doesn't recognize one login, revoke its sessions and reset the password.",
      ],
    };
  }

  if (verdict === "tight") {
    return {
      level: "review",
      title: "Possible, only just",
      body: `${tightNote}Neither IP looks like a VPN or proxy.${unknownNote} A real fast trip is possible, and so is a second person.`,
      steps: ["Check whether the user was travelling.", "Compare devices and MFA results for the two sessions."],
    };
  }

  return {
    level: "high",
    title: "High risk: two places at once",
    body: `${tightNote}Neither IP looks like a VPN, proxy, relay or data centre${securityKnown ? "" : " from what is known"}, so both locations are probably real. That points to two people using one account: shared or stolen credentials.${unknownNote}`,
    steps: [
      "Treat the later session as suspect until the user confirms it.",
      "Revoke active sessions and force a password reset with MFA re-enrolment if the user doesn't recognize it.",
      "Look for other logins from the same IPs across your users.",
    ],
  };
}

// --- local time --------------------------------------------------------------------

/** The login's wall-clock time where the IP is, e.g. "Tue 3:12 AM". Null when the zone is unknown. */
export function localTime(at: number, timeZone: string): { text: string; hour: number; zone: string } | null {
  if (!timeZone) {
    return null;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).formatToParts(new Date(at));
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const hour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).formatToParts(new Date(at)).find((part) => part.type === "hour")?.value,
    );

    return {
      text: `${get("weekday")} ${get("day")} ${get("month")}, ${get("hour")}:${get("minute")} ${get("dayPeriod")}`,
      hour,
      zone: get("timeZoneName"),
    };
  } catch {
    return null;
  }
}

/** Midnight to 5 AM local: a login at that hour is a weak signal in its own right. */
export const isSmallHours = (hour: number) => hour >= 0 && hour < 5;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim()) : [];
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
