import { ImageResponse } from "next/og";

import { PAGE_TITLE, SITE_NAME } from "@/lib/constants";
import { LAND_COLUMNS, LAND_ROWS } from "@/lib/land-mask";

export const alt = PAGE_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Every other land dot, as small boxes (satori draws divs, not big SVG paths). */
function landDots() {
  const dots: { x: number; y: number }[] = [];

  LAND_ROWS.forEach((hex, row) => {
    if (row % 2) {
      return;
    }

    for (let column = 0; column < LAND_COLUMNS; column += 2) {
      const nibble = parseInt(hex[column >> 2] ?? "0", 16);

      if ((nibble >> (3 - (column & 3))) & 1) {
        dots.push({ x: column * (1200 / LAND_COLUMNS), y: 40 + row * 9.5 });
      }
    }
  });

  return dots;
}

export default function OpenGraphImage() {
  // New York and Moscow on the same grid as the dots.
  const a = { x: ((-74 + 180) / 360) * 1200, y: 40 + ((81.25 - 40.7) / 2.5) * 9.5 };
  const b = { x: ((37.6 + 180) / 360) * 1200, y: 40 + ((81.25 - 55.8) / 2.5) * 9.5 };

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#e2eef9", color: "#0e2240", fontFamily: "sans-serif" }}>
        {landDots().map((dot) => (
          <div key={`${dot.x}-${dot.y}`} style={{ position: "absolute", left: dot.x, top: dot.y, width: 9, height: 9, borderRadius: 5, background: "#b3c9e3" }} />
        ))}
        <svg width="1200" height="630" style={{ position: "absolute", left: 0, top: 0 }}>
          <path d={`M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 160} ${b.x} ${b.y}`} stroke="#f0603a" strokeWidth="6" fill="none" strokeLinecap="round" />
          <circle cx={a.x} cy={a.y} r="14" fill="#0e2240" stroke="#ffffff" strokeWidth="5" />
          <circle cx={b.x} cy={b.y} r="14" fill="#f0603a" stroke="#ffffff" strokeWidth="5" />
        </svg>
        <div
          style={{
            position: "absolute",
            left: 64,
            right: 64,
            bottom: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "32px 40px",
            borderRadius: 32,
            background: "#ffffff",
            boxShadow: "0 20px 50px rgba(14,34,64,0.25)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 700 }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "#c4421f", textTransform: "uppercase", letterSpacing: 3 }}>{SITE_NAME}</div>
            <div style={{ display: "flex", marginTop: 10, fontSize: 52, fontWeight: 800, lineHeight: 1.05 }}>Could one person have made both logins?</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 22, color: "#4b5f7c" }}>7,505 km in 1 h 30 min</div>
            <div style={{ display: "flex", marginTop: 10, padding: "8px 16px", borderRadius: 10, background: "#f0603a", color: "#ffffff", fontSize: 26, fontWeight: 800 }}>
              IMPOSSIBLE
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
