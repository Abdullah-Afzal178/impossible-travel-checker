import { POWERED_BY_URL } from "@/lib/constants";

export function PoweredByBadge({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <a
      href={POWERED_BY_URL}
      target="_blank"
      rel="noreferrer"
      className={[
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
        dark ? "border-white/25 text-white/80 hover:border-amber hover:text-amber" : "border-line bg-card/90 text-navy hover:border-navy",
        className ?? "",
      ].join(" ")}
    >
      <span className="inline-block h-2 w-2 rounded-full bg-coral" aria-hidden="true" />
      Powered by ipgeolocation.io
    </a>
  );
}
