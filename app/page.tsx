import { ArrowRight, Clock3, LocateFixed, MapPin, PlaneTakeoff, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { PoweredByBadge } from "@/components/powered-by-badge";
import { RouteMap, type MapPin as Pin } from "@/components/route-map";
import { API_BASE, FIELDS, type Item, type SecurityState } from "@/lib/api";
import { IP_API_DOCS_URL, PRICING_URL, SCENARIOS, SECURITY_API_URL, SIGNUP_URL, SITE_NAME } from "@/lib/constants";
import { lookupIps, visitorIp } from "@/lib/ipgeo";
import { ipProblem, pageHref, parseQuery, timeProblem, toInstant, ZONES, type Query } from "@/lib/query";
import { isSmallHours, localTime, maskSentence, masksFor, riskRead, type IpRecord, type Mask, type RiskRead } from "@/lib/signals";
import { assessTravel, formatDistance, formatDuration, formatSpeed, TRAVEL, VERDICT_TEXT, type Travel } from "@/lib/travel";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Everything worked out for one login. */
type Login = { tag: "A" | "B"; ip: string; at: number; item: Item; auto: boolean };

type Outcome =
  | { kind: "input"; problems: string[] }
  | { kind: "error"; title: string; message: string; limited: boolean }
  | { kind: "result"; logins: [Login, Login]; security: SecurityState };

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const query = parseQuery(await searchParams);
  const visitor = visitorIp(await headers());
  const outcome = await check(query, visitor);
  const result = outcome.kind === "result" ? outcome : null;
  const recordA = result?.logins[0].item.ok ? result.logins[0].item.record : null;
  const recordB = result?.logins[1].item.ok ? result.logins[1].item.record : null;
  const travel = result && recordA && recordB ? assessTravel(recordA.point, result.logins[0].at, recordB.point, result.logins[1].at) : null;
  const tone = !travel ? "ok" : travel.verdict === "plausible" ? "ok" : travel.verdict === "tight" ? "warn" : "bad";

  return (
    <div className="min-h-screen overflow-x-hidden">
      <section className="relative bg-gradient-to-b from-sea via-sea to-sky">
        <header className="relative z-20">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <a href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy text-white" aria-hidden="true">
                <PlaneTakeoff className="h-5 w-5" />
              </span>
              <span className="text-base font-bold tracking-tight sm:text-lg">{SITE_NAME}</span>
            </a>
            <span className="hidden sm:block">
              <PoweredByBadge />
            </span>
          </div>
        </header>

        <div className="relative z-10 mx-auto max-w-3xl px-4 pt-4 text-center sm:px-6 md:pt-6">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-coral-dark">Login risk between two sign-ins</p>
          <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
            Impossible Travel Checker: Could One Person Have Made Both Logins?
          </h1>
          <p className="mx-auto mt-3 hidden max-w-xl text-sm leading-relaxed text-slate sm:block">
            Two IP addresses, two times. See the distance, the speed it would take, and whether a VPN, proxy or relay explains the jump.
          </p>
        </div>

        <div className="pt-2 md:-mt-2">
          <RouteMap
            a={recordA ? pinFor("A", recordA) : null}
            b={recordB ? pinFor("B", recordB) : null}
            label={travel ? `${formatDistance(travel.distanceKm)} in ${formatDuration(travel.gapHours)}, ${formatSpeed(travel.speedKmh)}` : null}
            tone={tone}
            sameArea={travel?.sameArea ?? false}
          />
        </div>
      </section>

      <BoardingPass query={query} visitorKnown={visitor !== null} />

      <main className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        {query.problems.map((problem) => (
          <Notice key={problem}>{problem}</Notice>
        ))}
        {query.isExample ? (
          <Notice tone="coral">
            <strong>Worked example.</strong> A home broadband login in New York at 09:00 UTC, then a login from Moscow at 10:30 UTC. Enter your own two sign-ins above.
          </Notice>
        ) : null}
        {outcome.kind === "input" ? (
          <section className="mt-8 rounded-3xl border border-line bg-card p-6 sm:p-8">
            <h2 className="text-xl font-bold">Not ready for take-off</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-slate">
              {outcome.problems.map((problem) => (
                <li key={problem} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" aria-hidden="true" />
                  {problem}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {outcome.kind === "error" ? (
          <section className={`mt-8 rounded-3xl border p-6 text-center sm:p-8 ${outcome.limited ? "border-line bg-card" : "border-bad/30 bg-bad-soft"}`}>
            <h2 className="text-xl font-bold">{outcome.title}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate">{outcome.message}</p>
          </section>
        ) : null}
        {result ? <Report logins={result.logins} security={result.security} travel={travel} /> : null}
      </main>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Faq />
      </div>

      <footer className="mt-16 border-t border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate sm:px-6">
          <p>
            IP locations and network signals from the{" "}
            <a href={IP_API_DOCS_URL} target="_blank" rel="noreferrer" className="font-semibold text-navy underline decoration-coral underline-offset-4 hover:text-coral-dark">
              ipgeolocation.io IP Location API
            </a>
            . Distances are great-circle distances. Open source under the MIT license.
          </p>
          <PoweredByBadge />
        </div>
      </footer>
    </div>
  );
}

// --- the check -------------------------------------------------------------------

async function check(query: Query, visitor: string | null): Promise<Outcome> {
  const problems: string[] = [];
  const ipA = query.a === "me" ? visitor ?? "" : query.a;
  const ipB = query.b;

  if (query.a === "me" && !visitor) {
    problems.push("Your public IP couldn't be worked out from this connection (on localhost there isn't one). Enter login A's address instead.");
  } else {
    const problem = ipProblem(ipA);

    if (problem) {
      problems.push(`Login A: ${problem}`);
    }
  }

  const problemB = ipProblem(ipB);

  if (problemB) {
    problems.push(`Login B: ${problemB}`);
  }

  for (const [value, label] of [
    [query.at, "login A"],
    [query.bt, "login B"],
  ] as const) {
    const problem = timeProblem(value, label);

    if (problem) {
      problems.push(problem);
    } else if (toInstant(value, query.tz) === null) {
      problems.push(`The time for ${label} isn't a real date and time.`);
    }
  }

  if (problems.length) {
    return { kind: "input", problems };
  }

  const ips = ipA === ipB ? [ipA] : [ipA, ipB];
  const lookup = await lookupIps(ips, visitor);

  if (!lookup.ok) {
    return { kind: "error", ...lookup.problem, limited: lookup.limited };
  }

  const itemA = lookup.items[0];
  const itemB = lookup.items[ips.length - 1];

  return {
    kind: "result",
    security: lookup.security,
    logins: [
      { tag: "A", ip: ipA, at: toInstant(query.at, query.tz) ?? 0, item: itemA, auto: query.a === "me" },
      { tag: "B", ip: ipB, at: toInstant(query.bt, query.tz) ?? 0, item: itemB, auto: false },
    ],
  };
}

function pinFor(tag: "A" | "B", record: IpRecord): Pin {
  return { tag, point: record.point, place: placeName(record) };
}

function placeName(record: IpRecord): string {
  return [record.city, record.countryCode || record.country].filter(Boolean).join(", ") || record.country || "Unknown place";
}

// --- the form ----------------------------------------------------------------------

function BoardingPass({ query, visitorKnown }: { query: Query; visitorKnown: boolean }) {
  const zones = ZONES.includes(query.tz) ? ZONES : [query.tz, ...ZONES];

  return (
    <div className="relative z-10 mx-auto mt-4 max-w-5xl px-4 sm:px-6 md:-mt-32 lg:-mt-40">
      <form action="/" method="get" className="overflow-hidden rounded-3xl bg-card shadow-[0_24px_60px_-28px_rgba(14,34,64,0.45)] ring-1 ring-line">
        <div className="flex items-center justify-between gap-3 bg-navy px-5 py-2.5 text-white sm:px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em]">Boarding pass: two sign-ins, one account</p>
          <p className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-amber sm:block">Check travel</p>
        </div>
        <div className="grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_13rem]">
          <LoginFields tag="A" ipName="a" timeName="at" ip={query.a} time={query.at} hint="The earlier or usual sign-in" />
          <Perforation />
          <LoginFields tag="B" ipName="b" timeName="bt" ip={query.b} time={query.bt} hint="The sign-in that raised the alert" />
          <Perforation />
          <div className="flex flex-col justify-between gap-4 bg-sky/60 p-5 sm:p-6">
            <div>
              <label htmlFor="tz" className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate">
                Times are in
              </label>
              <select
                id="tz"
                name="tz"
                defaultValue={query.tz}
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-coral"
              >
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone === "UTC" ? "UTC (log default)" : zone.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-coral px-5 font-semibold text-white transition hover:bg-coral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
            >
              Check travel
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-dashed border-line px-5 py-3.5 text-sm sm:px-6">
          <a
            href={pageHref({ ...query, a: "me" })}
            className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white transition hover:bg-navy-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            title={visitorKnown ? "Use the address you're browsing from" : undefined}
          >
            <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
            Use my IP for A
          </a>
          <span className="ml-1 mr-1 text-xs text-slate">Try</span>
          {SCENARIOS.map((scenario) => (
            <a
              key={scenario.label}
              href={pageHref(scenario.query)}
              title={scenario.note}
              className="rounded-full border border-line bg-sky px-3 py-1 text-xs font-medium transition hover:border-coral hover:text-coral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              {scenario.label}
            </a>
          ))}
        </div>
      </form>
    </div>
  );
}

function LoginFields({ tag, ipName, timeName, ip, time, hint }: { tag: "A" | "B"; ipName: string; timeName: string; ip: string; time: string; hint: string }) {
  const isA = tag === "A";

  return (
    <fieldset className="min-w-0 p-5 sm:p-6">
      <legend className="sr-only">Login {tag}</legend>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-bold text-white ${isA ? "bg-navy" : "bg-coral"}`} aria-hidden="true">
          {tag}
        </span>
        <div>
          <p className="text-sm font-bold">Login {tag}</p>
          <p className="text-xs text-slate">{hint}</p>
        </div>
      </div>
      <label htmlFor={ipName} className="mt-4 block font-mono text-[11px] uppercase tracking-[0.18em] text-slate">
        IP address
      </label>
      <input
        id={ipName}
        name={ipName}
        type="text"
        inputMode="text"
        defaultValue={ip === "me" ? "me" : ip}
        placeholder={isA ? "203.0.113.24" : "198.51.100.7"}
        maxLength={45}
        autoComplete="off"
        spellCheck={false}
        className="mt-1.5 h-11 w-full rounded-xl border border-line bg-sky/50 px-3 font-mono text-sm placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-coral"
      />
      <label htmlFor={timeName} className="mt-3 block font-mono text-[11px] uppercase tracking-[0.18em] text-slate">
        Sign-in time
      </label>
      <input
        id={timeName}
        name={timeName}
        type="datetime-local"
        defaultValue={time}
        className="mt-1.5 h-11 w-full rounded-xl border border-line bg-sky/50 px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-coral"
      />
    </fieldset>
  );
}

function Perforation() {
  return (
    <div className="relative mx-5 h-px md:mx-0 md:h-auto md:w-px" aria-hidden="true">
      <div className="perforation absolute inset-0 md:inset-y-4" style={{ backgroundSize: "10px 10px" }} />
    </div>
  );
}

// --- the answer ---------------------------------------------------------------------

function Report({ logins, security, travel }: { logins: [Login, Login]; security: SecurityState; travel: Travel | null }) {
  const [a, b] = logins;
  const recordA = a.item.ok ? a.item.record : null;
  const recordB = b.item.ok ? b.item.record : null;
  const masksA = recordA ? masksFor(recordA) : [];
  const masksB = recordB ? masksFor(recordB) : [];
  const securityKnown = Boolean(recordA?.security && recordB?.security);
  const attacker = Boolean(recordA?.security?.isKnownAttacker || recordB?.security?.isKnownAttacker);
  const risk = travel ? riskRead(travel.verdict, masksA, masksB, securityKnown, attacker) : null;

  return (
    <>
      {travel ? <FlightBoard travel={travel} /> : null}
      {travel?.swapped ? (
        <Notice>Login B happened before login A, so the check runs from B to A. The order doesn&apos;t change the answer.</Notice>
      ) : null}
      {travel ? <Modes travel={travel} /> : null}

      <section aria-labelledby="logins-heading" className="mt-12">
        <SectionTitle id="logins-heading" kicker="Passengers">
          The two logins
        </SectionTitle>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <LoginCard login={a} masks={masksA} security={security} />
          <LoginCard login={b} masks={masksB} security={security} />
        </div>
      </section>

      {risk && travel ? <ExplainPanel risk={risk} travel={travel} masksA={masksA} masksB={masksB} security={security} /> : null}

      <ApiSample logins={logins} />
    </>
  );
}

function FlightBoard({ travel }: { travel: Travel }) {
  const verdict = VERDICT_TEXT[travel.verdict];
  const statusClass = travel.verdict === "plausible" ? "bg-ok text-white" : travel.verdict === "tight" ? "bg-amber text-navy" : "bg-coral text-white";
  const cells = [
    { label: "Distance", value: formatDistance(travel.distanceKm), sub: formatDistance(travel.distanceKm, "mi") },
    { label: "Time between", value: formatDuration(travel.gapHours), sub: travel.gapHours === 0 ? "same minute" : "between sign-ins" },
    { label: "Speed needed", value: formatSpeed(travel.speedKmh), sub: Number.isFinite(travel.speedKmh) ? formatSpeed(travel.speedKmh, "mph") : "zero time gap" },
  ];

  return (
    <section aria-labelledby="board-heading" className="mt-8 overflow-hidden rounded-3xl bg-board text-white">
      <h2 id="board-heading" className="sr-only">
        Result
      </h2>
      <div className="grid sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1.4fr]">
        {cells.map((cell) => (
          <div key={cell.label} className="border-b border-r border-white/10 p-5 lg:border-b-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">{cell.label}</p>
            <p className="mt-2 font-mono text-xl font-semibold text-amber sm:text-2xl">{cell.value}</p>
            <p className="mt-1 font-mono text-xs text-white/60">{cell.sub}</p>
          </div>
        ))}
        <div className="p-5 sm:col-span-3 lg:col-span-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Status</p>
          <p className={`mt-2 inline-block rounded-md px-2.5 py-1 font-mono text-sm font-bold uppercase tracking-wider ${statusClass}`}>{verdict.label}</p>
          <p className="mt-2 text-sm text-white/80">{travel.sameArea ? `Both logins are within ${TRAVEL.sameAreaKm} km, which IP location can't tell apart.` : verdict.line}</p>
        </div>
      </div>
    </section>
  );
}

function Modes({ travel }: { travel: Travel }) {
  return (
    <section aria-labelledby="modes-heading" className="mt-6">
      <h2 id="modes-heading" className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate">
        Could they get there? Door to door, great-circle distance
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {travel.modes.map((mode) => (
          <li key={mode.id} className={`rounded-2xl border p-4 ${!mode.usable ? "border-line bg-card/60 text-slate" : mode.fits ? "border-ok/40 bg-ok-soft" : "border-line bg-card"}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">{mode.label}</p>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${!mode.usable ? "bg-sea text-slate" : mode.fits ? "bg-ok text-white" : "bg-bad-soft text-bad"}`}
              >
                {!mode.usable ? "Not practical" : mode.fits ? "Fits" : "Too slow"}
              </span>
            </div>
            <p className="mt-2 font-mono text-lg font-semibold">{mode.usable ? formatDuration(mode.hours) : "n/a"}</p>
            <p className="mt-0.5 text-xs text-slate">
              {mode.speedKmh} km/h{mode.overheadHours ? ` plus ${formatDuration(mode.overheadHours)} getting on and off` : ""}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-slate">
        The verdict allows for IP location error: anything under {TRAVEL.sameAreaKm} km counts as the same area, and &ldquo;tight but possible&rdquo; means the trip fits only at airliner cruise speed ({TRAVEL.airlinerKmh} km/h) with no time on the ground, after taking {TRAVEL.accuracyKm} km off each end.
      </p>
    </section>
  );
}

function LoginCard({ login, masks, security }: { login: Login; masks: Mask[]; security: SecurityState }) {
  const isA = login.tag === "A";

  if (!login.item.ok) {
    return (
      <article className="rounded-3xl border border-line bg-card p-6">
        <CardHead tag={login.tag} ip={login.auto ? "Your IP" : login.ip} />
        <h3 className="mt-4 font-bold">{login.item.problem.title}</h3>
        <p className="mt-1 text-sm text-slate">{login.item.problem.message}</p>
      </article>
    );
  }

  const record = login.item.record;
  const local = localTime(login.at, record.timeZone);
  const s = record.security;

  return (
    <article className={`rounded-3xl border bg-card p-6 ${isA ? "border-navy/20" : "border-coral/30"}`}>
      <CardHead tag={login.tag} ip={login.ip} />
      <div className="mt-4 flex items-start gap-2">
        <MapPin className={`mt-0.5 h-4 w-4 shrink-0 ${isA ? "text-navy" : "text-coral"}`} aria-hidden="true" />
        <div>
          <p className="font-bold">{[record.city, record.region].filter(Boolean).join(", ") || "City unknown"}</p>
          <p className="text-sm text-slate">
            {record.country} <span className="font-mono text-xs">({record.point.lat.toFixed(2)}, {record.point.lon.toFixed(2)})</span>
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-2">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate" aria-hidden="true" />
        <div className="text-sm">
          {local ? (
            <>
              <p>
                <span className="font-semibold">{local.text}</span> <span className="text-slate">{local.zone} local time</span>
              </p>
              {isSmallHours(local.hour) ? (
                <p className="mt-1 inline-block rounded-md bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">Small-hours login: a weak signal on its own</p>
              ) : null}
            </>
          ) : (
            <p className="text-slate">Local time unknown</p>
          )}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-dashed border-line pt-4 text-sm">
        <dt className="text-slate">Network</dt>
        <dd className="min-w-0 break-words font-medium">{record.org || "Unknown"}</dd>
        <dt className="text-slate">ASN</dt>
        <dd className="font-mono text-xs leading-5">
          {record.asn || "n/a"}
          {record.asnType ? <span className="ml-2 rounded bg-sea px-1.5 py-0.5 text-[10px] text-slate">{record.asnType}</span> : null}
        </dd>
        {record.connectionType ? (
          <>
            <dt className="text-slate">Connection</dt>
            <dd>{record.connectionType}</dd>
          </>
        ) : null}
        {s ? (
          <>
            <dt className="text-slate">Threat score</dt>
            <dd className="font-mono text-xs leading-5">{s.threatScore} / 100</dd>
          </>
        ) : null}
      </dl>

      <div className="mt-4">
        {s ? (
          <ul className="flex flex-wrap gap-1.5" aria-label={`Network flags for login ${login.tag}`}>
            {masks.map((mask) => (
              <li key={mask.kind} className="rounded-full bg-coral-soft px-2.5 py-1 text-xs font-semibold text-coral-dark">
                {mask.label}
                {mask.provider ? `: ${mask.provider}` : ""}
              </li>
            ))}
            {s.isKnownAttacker ? <li className="rounded-full bg-bad-soft px-2.5 py-1 text-xs font-semibold text-bad">Known attacker history</li> : null}
            {s.isBot ? <li className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">Bot activity</li> : null}
            {s.isSpam ? <li className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">Spam source</li> : null}
            {!masks.length && !s.isKnownAttacker && !s.isBot && !s.isSpam ? (
              <li className="rounded-full bg-ok-soft px-2.5 py-1 text-xs font-semibold text-ok">No VPN, proxy, Tor or relay flagged</li>
            ) : null}
          </ul>
        ) : (
          <>
            {masks.length ? (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {masks.map((mask) => (
                  <li key={mask.kind} className="rounded-full bg-coral-soft px-2.5 py-1 text-xs font-semibold text-coral-dark">
                    {mask.label}
                  </li>
                ))}
              </ul>
            ) : null}
            <SecurityMissing state={security} />
          </>
        )}
      </div>
    </article>
  );
}

function CardHead({ tag, ip }: { tag: "A" | "B"; ip: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white ${tag === "A" ? "bg-navy" : "bg-coral"}`}>Login {tag}</span>
      <span className="min-w-0 truncate font-mono text-sm">{ip}</span>
    </div>
  );
}

function SecurityMissing({ state }: { state: SecurityState }) {
  if (state === "paid") {
    return (
      <p className="rounded-xl bg-sea px-3 py-2 text-xs leading-relaxed text-slate">
        VPN, proxy, Tor and relay flags need a paid plan with the Security module.{" "}
        <a href={PRICING_URL} target="_blank" rel="noreferrer" className="font-semibold text-navy underline decoration-coral underline-offset-2">
          See plans
        </a>
        . Location and network are shown.
      </p>
    );
  }

  return (
    <p className="rounded-xl bg-sea px-3 py-2 text-xs leading-relaxed text-slate">
      VPN, proxy and Tor data is unavailable right now, so location and network are shown on their own. Try again in a few minutes.
    </p>
  );
}

function ExplainPanel({ risk, travel, masksA, masksB, security }: { risk: RiskRead; travel: Travel; masksA: Mask[]; masksB: Mask[]; security: SecurityState }) {
  const Icon = risk.level === "high" ? ShieldAlert : risk.level === "review" ? ShieldQuestion : ShieldCheck;
  const levelClass = risk.level === "high" ? "bg-bad text-white" : risk.level === "review" ? "bg-amber text-navy" : "bg-ok text-white";
  const sentences = [...masksA.map((mask) => maskSentence("A", mask)), ...masksB.map((mask) => maskSentence("B", mask))];

  return (
    <section aria-labelledby="explain-heading" className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="rounded-3xl border border-line bg-card p-6 sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral-dark">Explain it away?</p>
        <div className="mt-2 flex items-start gap-3">
          <Icon className="mt-1 h-6 w-6 shrink-0 text-navy" aria-hidden="true" />
          <div>
            <h2 id="explain-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
              {risk.title}
            </h2>
            <span className={`mt-2 inline-block rounded-md px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${levelClass}`}>
              {risk.level === "high" ? "High risk" : risk.level === "review" ? "Review" : "Low risk"}
            </span>
          </div>
        </div>
        <p className="mt-4 leading-relaxed text-slate">{risk.body}</p>
        {sentences.length ? (
          <ul className="mt-5 space-y-3">
            {sentences.map((sentence) => (
              <li key={sentence} className="rounded-2xl border-l-4 border-coral bg-coral-soft/50 px-4 py-3 text-sm leading-relaxed">
                {sentence}
              </li>
            ))}
          </ul>
        ) : null}
        {security !== "ok" ? (
          <p className="mt-4 text-xs text-slate">
            Without Security data this read leans on the network type alone. A VPN on a home-broadband-looking range would go unnoticed.
          </p>
        ) : null}
        <p className="mt-5 text-xs text-slate">
          Network flags are indicators drawn from observed behavior, not proof. A clean result doesn&apos;t clear a login, and a flagged one doesn&apos;t condemn it.
        </p>
      </div>
      <div className="rounded-3xl bg-navy p-6 text-white sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber">What to do next</p>
        <ol className="mt-4 space-y-3">
          {risk.steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-relaxed text-white/85">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 font-mono text-xs text-amber">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-relaxed text-white/60">
          Required speed: {formatSpeed(travel.speedKmh)}. A passenger jet cruises near {TRAVEL.airlinerKmh} km/h, and real trips add hours at airports.
        </p>
      </div>
    </section>
  );
}

function ApiSample({ logins }: { logins: [Login, Login] }) {
  // A visitor's own address, picked up automatically, stays out of the shareable sample.
  const shown = logins.map((login) => (login.auto ? "LOGIN_A_IP" : login.ip));
  const ips = [...new Set(shown)];
  const request = `curl -X POST "${API_BASE}/ipgeo-bulk?apiKey=YOUR_API_KEY&include=security&fields=${FIELDS},security" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ ips })}'`;
  const first = logins.find((login) => login.item.ok && !login.auto) ?? null;
  const record = first && first.item.ok ? first.item.record : null;
  const reply = record
    ? {
        ip: record.ip,
        location: { city: record.city, country_name: record.country, latitude: record.point.lat.toFixed(5), longitude: record.point.lon.toFixed(5) },
        asn: { as_number: record.asn, organization: record.org, type: record.asnType },
        time_zone: { name: record.timeZone },
        security: record.security
          ? {
              threat_score: record.security.threatScore,
              is_vpn: record.security.isVpn,
              vpn_provider_names: record.security.vpnProviders,
              is_proxy: record.security.isProxy,
              is_tor: record.security.isTor,
              is_relay: record.security.isRelay,
              relay_provider_name: record.security.relayProvider,
              is_cloud_provider: record.security.isCloudProvider,
              is_corporate_gateway: record.security.isCorporateGateway,
              "...": "...",
            }
          : "(needs the Security module)",
      }
    : null;

  return (
    <section aria-labelledby="api-heading" className="mt-12 overflow-hidden rounded-3xl border border-line bg-card">
      <div className="border-b border-line px-6 py-5 sm:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral-dark">For developers</p>
        <h2 id="api-heading" className="mt-1 text-xl font-bold tracking-tight">
          The API call behind this check
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate">
          One bulk request returns both IPs&apos; location, network and Security data. It costs 3 credits per IP (1 for location, 2 for Security). Run the same check inside your sign-in flow or SIEM to flag impossible travel as it happens.
        </p>
      </div>
      <div className="grid lg:grid-cols-2">
        <pre className="overflow-x-auto bg-navy p-5 font-mono text-xs leading-relaxed text-white/90 sm:p-6">
          <code>{request}</code>
        </pre>
        <pre className="overflow-x-auto bg-[#13294b] p-5 font-mono text-xs leading-relaxed text-amber sm:p-6">
          <code>{reply ? `[\n  ${JSON.stringify(reply, null, 2).replace(/\n/g, "\n  ")},\n  ...\n]` : "Reply shown after a successful lookup."}</code>
        </pre>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 px-6 py-4 text-sm sm:px-8">
        <a href={IP_API_DOCS_URL} target="_blank" rel="noreferrer" className="font-semibold text-navy underline decoration-coral underline-offset-4 hover:text-coral-dark">
          IP Location API docs
        </a>
        <a href={SECURITY_API_URL} target="_blank" rel="noreferrer" className="font-semibold text-navy underline decoration-coral underline-offset-4 hover:text-coral-dark">
          IP Security API
        </a>
        <a href={SIGNUP_URL} target="_blank" rel="noreferrer" className="font-semibold text-navy underline decoration-coral underline-offset-4 hover:text-coral-dark">
          Get a free API key
        </a>
      </div>
    </section>
  );
}

// --- questions ------------------------------------------------------------------------

function Faq() {
  const items: { q: string; a: ReactNode }[] = [
    {
      q: "What is impossible travel?",
      a: "Impossible travel is when one account signs in from two places too far apart for one person to travel between in the time between the logins. A login from New York and another from Moscow 90 minutes later would need a speed of about 5,000 km/h, so either the locations are wrong or two different people are using the account.",
    },
    {
      q: "How do SIEMs and identity providers detect impossible travel?",
      a: "They geolocate the IP address of each sign-in, work out the great-circle distance between consecutive logins for the same user, divide by the time between them, and raise an impossible travel alert when the speed passes a threshold. Better systems also learn each user's usual places and networks, and discount known VPN and corporate egress ranges, which is the step that cuts most false positives.",
    },
    {
      q: "Why do I get impossible travel alerts when nobody else logged in?",
      a: "Most alerts are network artifacts. A VPN shows the VPN server's location, iCloud Private Relay and other relays use regional egress addresses, company networks send traffic out through a head office or cloud gateway, and mobile carriers can route a phone's traffic through a gateway hundreds of kilometers away. IPv6 and IPv4 addresses on the same device can also geolocate differently. That's why this page checks each IP for VPN, proxy, Tor, relay and corporate gateway flags.",
    },
    {
      q: "What speed threshold should I use?",
      a: `Commercial jets cruise at around 900 km/h (560 mph), so anything well above that is impossible. Many teams alert from about 500 to 1,000 km/h and ignore pairs under 100 to 150 km apart, because city-level IP location can be tens of kilometers off. This checker adds a ${TRAVEL.airlinerKmh} km/h cruise plus 2 hours at airports for "plausible", and treats under ${TRAVEL.sameAreaKm} km as the same area.`,
    },
    {
      q: "What does a login from two locations at the same time mean?",
      a: "Two logins from two locations at once usually mean either one device is on a VPN or relay while another is not (a phone and a laptop, say), or a second person has the password. If neither IP is a VPN, proxy, relay or data centre, treat it as a likely account compromise.",
    },
    {
      q: "What should I do when an impossible travel alert triggers?",
      a: "Check whether either IP is a VPN, proxy, Tor exit or corporate gateway. Ask the user whether they were travelling or using a VPN. Compare devices, browsers and MFA results for both sessions. If the user doesn't recognize a login, revoke all sessions, reset the password, re-enrol MFA and look for the same IP across other accounts.",
    },
    {
      q: "Is a suspicious login location enough to block a user?",
      a: "Not on its own. A suspicious login location is a signal to weigh with others: a new device, a failed MFA prompt, a login at 3 AM local time, or an IP with a history of attacks. Security flags and IP locations are indicators, not proof, so step-up checks such as MFA are usually a better answer than a hard block.",
    },
    {
      q: "How accurate is IP geolocation for this?",
      a: "Country is right for the vast majority of addresses and city is usually right or nearby for home broadband. Mobile networks, satellite links and some business connections can be much further out. That's why short distances are treated as the same area and why the verdict leaves room for error at both ends.",
    },
  ];

  return (
    <section aria-labelledby="faq-heading" className="mt-16">
      <SectionTitle id="faq-heading" kicker="Questions">
        Impossible travel, answered
      </SectionTitle>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <details key={item.q} className="group rounded-2xl border border-line bg-card p-5 open:shadow-sm" open>
            <summary className="cursor-pointer list-none font-bold marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral">
              <span className="flex items-start justify-between gap-3">
                {item.q}
                <span className="mt-1 font-mono text-xs text-coral transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-slate">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// --- bits ------------------------------------------------------------------------------

function Notice({ children, tone = "navy" }: { children: ReactNode; tone?: "navy" | "coral" }) {
  return (
    <p className={`mt-6 rounded-2xl border-l-4 bg-card px-4 py-3 text-sm ${tone === "coral" ? "border-coral" : "border-navy"}`}>{children}</p>
  );
}

function SectionTitle({ id, kicker, children }: { id: string; kicker: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral-dark">{kicker}</p>
      <h2 id={id} className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
        {children}
      </h2>
    </div>
  );
}

