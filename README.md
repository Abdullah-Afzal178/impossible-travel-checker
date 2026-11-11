# Impossible Travel Checker

Could one person have made both logins? Enter two sign-ins (IP address and time) and see the distance between them, the speed the trip would need, whether anyone could make it, and whether a VPN, proxy, Tor exit, privacy relay or corporate gateway explains the jump. Powered by [ipgeolocation.io](https://ipgeolocation.io).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-000?logo=nextdotjs)](https://nextjs.org/)
[![Powered by ipgeolocation.io](https://img.shields.io/badge/Powered%20by-ipgeolocation.io-f0603a)](https://ipgeolocation.io)

<!-- Add a screenshot of the tool running locally at ./public/tool.png and reference it here -->

---

## What It Does

- **A world map of the two logins**: a dotted world with both sign-ins pinned and the great-circle route between them, labelled with the distance and the speed needed.
- **A verdict**: plausible, tight but possible, or impossible travel, with the distance in km and miles, the time between the logins and the required speed in km/h and mph.
- **Could they get there?** Door-to-door times on foot, by car, by high-speed rail and by airliner, and which of them fit the gap.
- **Both logins side by side**: city, region, country and coordinates, the local time of each login at its location (a 3 AM login is a signal too), the network and ASN, and the Security flags: VPN, proxy, residential proxy, Tor, privacy relay (including iCloud Private Relay), cloud provider, corporate gateway, threat score and known-attacker history.
- **Explain it away**: when either IP is a VPN, proxy, Tor exit, relay, corporate gateway or hosting network, the page says so in plain words ("Login B came through a VPN (NordVPN), so its location is the VPN server's, not the person's"), then gives a combined risk read and next steps.
- **Edge cases handled**: logins entered in the wrong order are swapped and flagged, a zero time gap works, the same IP twice works, and anything under 150 km counts as the same area because IP location is city level.
- **Worked example and scenarios**: the page opens on a labelled example (New York home broadband, then a Moscow hosting address 90 minutes later), with chips for a plausible flight, an impossible hop, a Tor exit and an out-of-order pair, and a "use my IP" shortcut for login A.
- **The API call behind the check**, with a trimmed real reply.

---

## Design notes

**The maths is pure and tested.** `lib/travel.ts` works out the haversine distance, the gap, the required speed and the verdict. `lib/geo.ts` draws the great-circle route, splitting it where it crosses the 180th meridian.

**Three verdicts, plain thresholds.** The constants live in `TRAVEL` and `MODES` in `lib/travel.ts`:

| Setting | Value | Meaning |
|---|---|---|
| `sameAreaKm` | 150 | Closer than this counts as the same area, since city-level IP location can be tens of km out |
| `accuracyKm` | 50 | Location error allowed on each end for the bare-minimum test |
| `airlinerKmh` | 900 | Airliner cruise speed |
| Car / rail / flight | 120 / 300 / 900 km/h | With 0 / 30 min / 2 h door-to-door overhead |

*Plausible* means the fastest realistic door-to-door trip fits the gap. *Tight but possible* means it only fits at cruise speed with no time on the ground, after taking the location error off both ends. *Impossible* means even that doesn't fit.

**Network signals change the meaning.** Impossible travel plus a VPN, proxy, relay, Tor or gateway on either side is most often a network artifact, though it can also be a second person behind an anonymizer, so it is marked for review. Impossible travel between two ordinary home connections is marked high risk. Security flags are indicators, not proof, and the page says so.

**A dotted world with no map service.** The map is an inline SVG in an equirectangular projection. The land comes from `lib/land-mask.ts`, a 2.5 degree land/sea grid stored as hex strings, generated once from hand-simplified coastlines by `scripts/build-land-mask.mjs` (`node scripts/build-land-mask.mjs --print` previews it as text). No tiles, no map images, no map library.

**Kind to API credits.** One bulk request covers both IPs. Identical checks are cached for an hour, and each visitor gets a limited number of new checks per window (see the environment variables).

**Graceful without the Security module.** If the key's plan lacks the Security module or the bulk endpoint, or Security data is temporarily unavailable, the page falls back to plain location lookups, still gives the travel verdict, uses the ASN type to spot hosting networks, and says what's missing (with a link to plans where it applies).

---

## Why ipgeolocation.io

- **[IP Location API](https://ipgeolocation.io/documentation/ip-location-api.html)** turns an IP address into coordinates, city, country, ASN, network type and time zone.
- **[IP Security API](https://ipgeolocation.io/ip-security-api.html)** adds VPN, proxy, residential proxy, Tor, relay, cloud provider and corporate gateway detection, with provider names and a threat score, in the same request.
- **Bulk lookups**: both logins in one request.

**[Get your free API key →](https://ipgeolocation.io/signup)**

---

## Features

- **Full-width dotted world map** with pins and the great-circle route
- **Plausible / tight / impossible verdict** with distance, gap and speed
- **Travel mode check**: walk, car, high-speed rail, airliner
- **VPN, proxy, Tor, relay, cloud and corporate gateway flags** for each login
- **"Explain it away" panel** with a combined risk read and next steps
- **Local time of each login**, with small-hours logins called out
- **Any input time zone**, UTC by default as in most logs
- **Per-visitor rate limit and caching** to protect API credits
- **Works without JavaScript**: everything is server-rendered from a GET form
- **SEO-ready**: Open Graph image, meta description, `robots.txt`, `sitemap.xml` and favicon

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org/) (App Router) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Language | TypeScript |
| Fonts | Sora and Azeret Mono via `next/font` |
| Icons | [lucide-react](https://lucide.dev/) |
| Data | [ipgeolocation.io](https://ipgeolocation.io) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- An [ipgeolocation.io](https://ipgeolocation.io/signup) API key. The travel check works on the free plan; VPN, proxy and Tor flags need a paid plan with the Security module.

### Run It Locally

1. Clone the repo:

```bash
git clone https://github.com/Abdullah-Afzal178/impossible-travel-checker.git
cd impossible-travel-checker
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the project root:

```env
IPGEOLOCATION_API_KEY=your_api_key_here
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

> On `localhost` there is no public IP, so "Use my IP for A" says it can't find one. Enter an address instead.

---

## API Calls and Credits

| Call | When | Credits |
|---|---|---|
| `POST /v3/ipgeo-bulk?include=security&fields=...` with `{"ips": [a, b]}` | Every new check | 3 per IP (1 location + 2 Security) |
| `GET /v3/ipgeo?ip=...&fields=...` | Fallback when the plan lacks Security or bulk, or Security is unavailable | 1 per IP |

`fields` trims the reply to what the page uses. Identical checks within an hour are served from memory and cost nothing.

---

## Tests

The distance, speed and verdict maths (including zero gaps, reversed order and the same-area rule), the great-circle route and its 180th-meridian split, the land mask, URL and time zone parsing, IP validation, Security parsing and the explain-it-away logic (VPN, Tor, relay, corporate gateway, residential proxy fixtures), error mapping and the rate limit are all tested:

```bash
npm test
```

---

## URL Parameters

| Parameter | Example | Meaning |
|---|---|---|
| `a` | `72.229.28.185` | Login A's IP address, or `me` for the visitor's own address |
| `at` | `2026-11-10T09:00` | Login A's time |
| `b` | `45.155.205.233` | Login B's IP address |
| `bt` | `2026-11-10T10:30` | Login B's time |
| `tz` | `America/New_York` | The time zone the times are in; UTC if left out |

With no parameters the page shows a labelled worked example.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `IPGEOLOCATION_API_KEY` | Yes | Your [ipgeolocation.io](https://ipgeolocation.io/signup) API key |
| `RATE_LIMIT_LOOKUPS` | No | New checks allowed per visitor in each window (default 12, `0` turns the limit off) |
| `RATE_LIMIT_WINDOW_MINUTES` | No | Length of the rate-limit window (default 10) |
| `NEXT_PUBLIC_SITE_URL` | No | Your production URL if you deploy (used for the sitemap and robots.txt) |

The rate limit is kept in memory: it resets on restart and isn't shared between server instances.

---

## Project Structure

```
impossible-travel-checker/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                 # Map hero, boarding-pass form, results board, login cards, explain panel, FAQ
│   ├── opengraph-image.tsx
│   ├── robots.ts
│   └── sitemap.ts
├── components/
│   ├── route-map.tsx            # Dotted world map with pins and route (SVG)
│   └── powered-by-badge.tsx
├── lib/
│   ├── travel.ts                # Distance, speed, travel modes, verdict (pure)
│   ├── geo.ts                   # Haversine, great circle, projection, land dots (pure)
│   ├── land-mask.ts             # Generated land/sea grid
│   ├── signals.ts               # Security flags, explain-it-away, risk read, local time (pure)
│   ├── query.ts                 # URL parameters, IP and time parsing (pure)
│   ├── api.ts                   # Reading API replies and errors (pure)
│   ├── rate-limit.ts            # Per-visitor limit (pure)
│   ├── ipgeo.ts                 # API calls (server only)
│   └── session-cache.ts
├── scripts/
│   └── build-land-mask.mjs      # Generates lib/land-mask.ts
├── .env                         # API key (not committed)
└── README.md
```

---

## Want to Deploy It?

Works out of the box on any platform that supports Next.js:

- **Vercel**: import the repo, add `IPGEOLOCATION_API_KEY`, deploy.
- **Netlify**, **Cloudflare Pages**, **Railway**: a similar process.
- **Self-hosted**: `npm run build && npm start`.

Behind a proxy or CDN, make sure it forwards the visitor's address (`X-Forwarded-For`, `X-Real-IP` or `CF-Connecting-IP`), or "Use my IP" and the rate limit will see the proxy instead of the visitor.

---

## License

MIT. See [LICENSE](LICENSE) for details.
