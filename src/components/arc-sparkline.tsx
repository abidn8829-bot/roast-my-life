import { daysBetween, addDays } from "@/lib/arc-trend";

type Point = { date: string; lifeScore: number };

const W = 320;
const H = 72;
const PAD_X = 6;
const PAD_Y = 8;

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Life Score over the last `windowDays` days, one point per check-in day, on a fixed 0–100 scale. */
export function ArcSparkline({ points, windowDays, today }: { points: Point[]; windowDays: number; today: string }) {
  const start = addDays(today, -(windowDays - 1));
  const x = (date: string) => PAD_X + (daysBetween(start, date) / Math.max(1, windowDays - 1)) * (W - 2 * PAD_X);
  const y = (score: number) => PAD_Y + (1 - Math.min(100, Math.max(0, score)) / 100) * (H - 2 * PAD_Y);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.date).toFixed(1)},${y(p.lifeScore).toFixed(1)}`).join(" ");

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Life Score over the last ${windowDays} days: ${points.map((p) => `${shortDate(p.date)} ${p.lifeScore}`).join(", ") || "no check-ins"}`}
      >
        <line x1={PAD_X} x2={W - PAD_X} y1={y(50)} y2={y(50)} className="stroke-border" strokeWidth={1} strokeDasharray="3 4" />
        {points.length > 1 && (
          <path d={path} fill="none" className="stroke-ember" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {points.map((p, i) => (
          <g key={p.date}>
            <title>{`${shortDate(p.date)}: Life Score ${p.lifeScore}`}</title>
            <circle cx={x(p.date)} cy={y(p.lifeScore)} r={12} fill="transparent" />
            <circle
              cx={x(p.date)}
              cy={y(p.lifeScore)}
              r={i === points.length - 1 ? 4.5 : 3}
              className={i === points.length - 1 ? "fill-ember stroke-surface-2" : "fill-surface-2 stroke-ember"}
              strokeWidth={2}
            />
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] text-text-faint">
        <span>{shortDate(start)}</span>
        <span>today</span>
      </figcaption>
    </figure>
  );
}
