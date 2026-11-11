import { LAND_COLUMNS, LAND_LEFT, LAND_ROWS, LAND_STEP, LAND_TOP } from "@/lib/land-mask";

/** Mean Earth radius (IUGG), in km. */
export const EARTH_RADIUS_KM = 6371.0088;
export const KM_PER_MILE = 1.609344;

export type Point = { lat: number; lon: number };

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;

/** Great-circle distance between two points (haversine), in km. */
export function distanceKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const kmToMiles = (km: number) => km / KM_PER_MILE;

/**
 * Points along the great circle from a to b, ends included. Intermediate
 * points come from spherical linear interpolation of the two unit vectors.
 */
export function greatCirclePoints(a: Point, b: Point, steps = 64): Point[] {
  const toVector = (p: Point) => [Math.cos(rad(p.lat)) * Math.cos(rad(p.lon)), Math.cos(rad(p.lat)) * Math.sin(rad(p.lon)), Math.sin(rad(p.lat))];
  const va = toVector(a);
  const vb = toVector(b);
  const omega = Math.acos(Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2])));

  if (omega < 1e-9) {
    return [a, b];
  }

  const points: Point[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wa = Math.sin((1 - t) * omega) / Math.sin(omega);
    const wb = Math.sin(t * omega) / Math.sin(omega);
    const [x, y, z] = [0, 1, 2].map((k) => wa * va[k] + wb * vb[k]);

    points.push({ lat: deg(Math.atan2(z, Math.hypot(x, y))), lon: deg(Math.atan2(y, x)) });
  }

  // Keep the exact ends, free of rounding.
  points[0] = a;
  points[points.length - 1] = b;

  return points;
}

// --- the map -------------------------------------------------------------------

/** The map shows latitudes from MAP_NORTH down to MAP_SOUTH (no Antarctica). */
export const MAP_NORTH = 82.5;
export const MAP_SOUTH = -57.5;
/** SVG units per degree. */
export const MAP_SCALE = 4;
export const MAP_WIDTH = 360 * MAP_SCALE;
export const MAP_HEIGHT = (MAP_NORTH - MAP_SOUTH) * MAP_SCALE;

/** Equirectangular projection onto the map's SVG coordinates. */
export function project(point: Point): { x: number; y: number } {
  const lat = Math.max(MAP_SOUTH, Math.min(MAP_NORTH, point.lat));

  return { x: (point.lon + 180) * MAP_SCALE, y: (MAP_NORTH - lat) * MAP_SCALE };
}

/**
 * The route as SVG path data. A route that crosses the 180th meridian is
 * split there, so it leaves one edge of the map and comes back on the other.
 */
export function routePath(a: Point, b: Point, steps = 64): string {
  const points = greatCirclePoints(a, b, steps);
  const parts: string[] = [];
  let previous: Point | null = null;

  for (const point of points) {
    const { x, y } = project(point);

    if (previous && Math.abs(point.lon - previous.lon) > 180) {
      // Interpolate the latitude where the route meets the edge.
      const east = previous.lon > 0;
      const span = 360 - Math.abs(point.lon - previous.lon);
      const toEdge = east ? 180 - previous.lon : previous.lon + 180;
      const edgeLat = previous.lat + ((point.lat - previous.lat) * toEdge) / span;
      const leave = project({ lat: edgeLat, lon: east ? 180 : -180 });
      const enter = project({ lat: edgeLat, lon: east ? -180 : 180 });

      parts.push(`L${round(leave.x)} ${round(leave.y)}`, `M${round(enter.x)} ${round(enter.y)}`, `L${round(x)} ${round(y)}`);
    } else {
      parts.push(`${previous ? "L" : "M"}${round(x)} ${round(y)}`);
    }

    previous = point;
  }

  return parts.join("");
}

/**
 * Where the route's label goes: halfway along, unless that is at the map's
 * edge (a Pacific crossing), then the nearest point well inside the map.
 */
export function routeLabelPoint(a: Point, b: Point): Point {
  const points = greatCirclePoints(a, b, 40);
  const inside = points
    .map((point, index) => ({ point, distance: Math.abs(index - 20) }))
    .filter(({ point }) => Math.abs(point.lon) <= 150)
    .sort((x, y) => x.distance - y.distance);

  return inside[0]?.point ?? points[20] ?? a;
}

/** True when the land mask has land at this cell. */
export function isLand(point: Point): boolean {
  const row = Math.round((LAND_TOP - point.lat) / LAND_STEP);
  const column = Math.round((((point.lon - LAND_LEFT) % 360) + 360) % 360 / LAND_STEP) % LAND_COLUMNS;

  return bitAt(row, column);
}

function bitAt(row: number, column: number): boolean {
  const hex = LAND_ROWS[row];

  if (!hex) {
    return false;
  }

  const nibble = parseInt(hex[column >> 2] ?? "0", 16);

  return ((nibble >> (3 - (column & 3))) & 1) === 1;
}

let dotsPath: string | null = null;

/**
 * Every land dot as one SVG path of zero-length segments. With a round line
 * cap each becomes a dot, which is far lighter than thousands of circles.
 */
export function landDotsPath(): string {
  if (dotsPath) {
    return dotsPath;
  }

  const parts: string[] = [];

  LAND_ROWS.forEach((_, row) => {
    const lat = LAND_TOP - row * LAND_STEP;

    if (lat > MAP_NORTH || lat < MAP_SOUTH) {
      return;
    }

    for (let column = 0; column < LAND_COLUMNS; column++) {
      if (bitAt(row, column)) {
        const { x, y } = project({ lat, lon: LAND_LEFT + column * LAND_STEP });

        parts.push(`M${round(x)} ${round(y)}h0`);
      }
    }
  });

  dotsPath = parts.join("");

  return dotsPath;
}

const round = (value: number) => Math.round(value * 10) / 10;
