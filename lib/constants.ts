export const SITE_NAME = "Impossible Travel Checker";

export const PAGE_TITLE = "Impossible Travel Checker: Could One Person Have Made Both Logins?";

export const PAGE_DESCRIPTION =
  "Check two sign-ins for impossible travel. Enter two IP addresses and login times to see the distance, the speed needed, whether anyone could make the trip, and whether a VPN, proxy, Tor or relay explains it.";

export const POWERED_BY_URL = "https://ipgeolocation.io";

export const IP_API_DOCS_URL = "https://ipgeolocation.io/documentation/ip-location-api.html";

export const SECURITY_API_URL = "https://ipgeolocation.io/ip-security-api.html";

export const PRICING_URL = "https://ipgeolocation.io/pricing.html";

export const SIGNUP_URL = "https://ipgeolocation.io/signup";

/** Ready-made checks for the scenario chips. Times are UTC. */
export const SCENARIOS = [
  {
    label: "Plausible flight",
    note: "New York to London, 13 hours apart",
    query: { a: "72.229.28.185", at: "2026-11-09T22:00", b: "81.2.69.142", bt: "2026-11-10T11:30", tz: "UTC" },
  },
  {
    label: "Impossible hop",
    note: "California to Tokyo in 2 hours, both home broadband",
    query: { a: "76.170.0.1", at: "2026-11-10T03:00", b: "126.10.20.30", bt: "2026-11-10T05:00", tz: "UTC" },
  },
  {
    label: "Tor explains it",
    note: "London, then a Tor exit in Berlin 20 minutes later",
    query: { a: "81.2.69.142", at: "2026-11-10T08:00", b: "185.220.101.1", bt: "2026-11-10T08:20", tz: "UTC" },
  },
  {
    label: "Out of order",
    note: "Login B happened first",
    query: { a: "81.2.69.142", at: "2026-11-10T18:00", b: "72.229.28.185", bt: "2026-11-10T06:00", tz: "UTC" },
  },
];
