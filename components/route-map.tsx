import { landDotsPath, MAP_HEIGHT, MAP_WIDTH, project, routeLabelPoint, routePath, type Point } from "@/lib/geo";

export type MapPin = { point: Point; tag: "A" | "B"; place: string };

/** Space below the map's last row, so the boarding pass can overlap open sea. */
const FOOT = 150;
const VIEW_HEIGHT = MAP_HEIGHT + FOOT;

/**
 * The dotted world with both logins pinned and the great-circle route between
 * them. Pins and the route label are HTML laid over the SVG, so they stay the
 * same size on a phone and on a wide screen.
 */
export function RouteMap({ a, b, label, tone, sameArea }: { a: MapPin | null; b: MapPin | null; label: string | null; tone: "ok" | "warn" | "bad"; sameArea: boolean }) {
  const pins = [a, b].filter((pin): pin is MapPin => pin !== null);
  const route = a && b && !sameArea ? routePath(a.point, b.point) : null;
  const middle = a && b ? project(routeLabelPoint(a.point, b.point)) : null;
  const routeColor = tone === "ok" ? "#17805a" : tone === "warn" ? "#d08a10" : "#f0603a";

  return (
    <div className="relative mx-auto w-full max-w-[1600px]">
      <svg viewBox={`0 0 ${MAP_WIDTH} ${VIEW_HEIGHT}`} className="block h-auto w-full" role="img" aria-label={mapLabel(a, b)}>
        <defs>
          <linearGradient id="foot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eef5fc" stopOpacity="0" />
            <stop offset="1" stopColor="#eef5fc" stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Graticule every 30 degrees. */}
        <g stroke="#cddcec" strokeWidth="1" strokeDasharray="2 6" vectorEffect="non-scaling-stroke">
          {Array.from({ length: 11 }, (_, i) => (i + 1) * 120).map((x) => (
            <line key={`x${x}`} x1={x} y1={0} x2={x} y2={MAP_HEIGHT} vectorEffect="non-scaling-stroke" />
          ))}
          {[60, 30, 0, -30].map((lat) => {
            const { y } = project({ lat, lon: 0 });

            return <line key={`y${lat}`} x1={0} y1={y} x2={MAP_WIDTH} y2={y} vectorEffect="non-scaling-stroke" />;
          })}
        </g>
        <path d={landDotsPath()} stroke="#b3c9e3" strokeWidth="5.2" strokeLinecap="round" fill="none" />
        {route ? (
          <>
            <path d={route} stroke={routeColor} strokeOpacity="0.18" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" vectorEffect="non-scaling-stroke" />
            <path
              d={route}
              pathLength={1}
              className="route-draw"
              stroke={routeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}
        <rect x="0" y={MAP_HEIGHT - 40} width={MAP_WIDTH} height={FOOT + 40} fill="url(#foot)" />
      </svg>

      {sameArea && a ? <SameAreaRing point={a.point} /> : null}

      {pins.map((pin) => (
        <Pin key={pin.tag} pin={pin} offset={sameArea && pin.tag === "B" ? 1 : 0} />
      ))}

      {label && middle && !sameArea ? (
        <div
          className="pointer-events-none absolute hidden -translate-x-1/2 -translate-y-[160%] whitespace-nowrap rounded-full border border-line bg-card/95 px-3 py-1 font-mono text-[11px] font-medium text-navy shadow-sm md:block"
          style={{ left: pct(middle.x, MAP_WIDTH), top: pct(middle.y, VIEW_HEIGHT) }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}

function Pin({ pin, offset }: { pin: MapPin; offset: number }) {
  const { x, y } = project(pin.point);
  const isA = pin.tag === "A";

  return (
    <div className="absolute" style={{ left: pct(x, MAP_WIDTH), top: pct(y, VIEW_HEIGHT) }}>
      <span className={`pin-pulse absolute -left-2 -top-2 h-4 w-4 rounded-full ${isA ? "bg-navy" : "bg-coral"}`} aria-hidden="true" />
      <span className={`absolute -left-[7px] -top-[7px] h-3.5 w-3.5 rounded-full border-2 border-white shadow ${isA ? "bg-navy" : "bg-coral"}`} aria-hidden="true" />
      <span
        className={`absolute left-2 flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm sm:text-[11px] ${isA ? "bg-navy" : "bg-coral-dark"}`}
        style={{ top: offset ? 4 : -26 }}
      >
        {pin.tag}
        <span className="hidden font-medium sm:inline">{pin.place}</span>
      </span>
    </div>
  );
}

function SameAreaRing({ point }: { point: Point }) {
  const { x, y } = project(point);

  return (
    <span
      className="absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-ok bg-ok/10"
      style={{ left: pct(x, MAP_WIDTH), top: pct(y, VIEW_HEIGHT) }}
      aria-hidden="true"
    />
  );
}

const pct = (value: number, of: number) => `${((value / of) * 100).toFixed(3)}%`;

function mapLabel(a: MapPin | null, b: MapPin | null): string {
  if (a && b) {
    return `World map with login A in ${a.place} and login B in ${b.place}, joined by the shortest route over the globe.`;
  }

  return "Dotted world map.";
}
