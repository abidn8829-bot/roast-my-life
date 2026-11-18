import Link from "next/link";
import { inkLink } from "@/components/journal-auth-ui";
import { SkillCalendarArt, SkillTickArt } from "@/components/journal-skill-art";
import { SkillUpgradePanel } from "@/components/skill-upgrade-panel";
import { SkillsBackLink, SkillsErrorView, SkillsShell } from "@/components/skills-shell";
import { SkillsTrack } from "@/components/skills-track";
import { STEPS_PER_WEEK, type HomeData, type PackMapMonth } from "@/lib/skills/skills-server";

export type SkillsPackMapViewProps =
  | { kind: "error" }
  | {
      kind: "ok";
      packId: string;
      packTitle: string | null;
      tier: "free" | "pro";
      months: PackMapMonth[];
      progress: HomeData["progress"];
      email?: string | null;
    };

const DAYS = Array.from({ length: STEPS_PER_WEEK }, (_, i) => i + 1);

/** The dashed square of a step not done yet (the same square the roast plan uses). */
function EmptyStep() {
  return <span aria-hidden="true" className="block h-5 w-5 rounded-[3px] border border-dashed border-text" />;
}

/**
 * The map of a pack: months 1 to 6, each with its weeks and a tick for every finished step. A month the plan cannot
 * open is only a panel with the month number, its title and one teaser line. PURE: plain props, no login needed.
 */
export function SkillsPackMapView(props: SkillsPackMapViewProps) {
  if (props.kind === "error") return <SkillsErrorView />;
  const doneByWeek = new Map(props.progress.map((p) => [p.weekNo, new Set(p.doneDays)]));

  return (
    <SkillsShell>
      <SkillsTrack event="skill_pack_map_viewed" props={{ pack: props.packId, tier: props.tier }} />
      <SkillsBackLink href="/skills">Skills</SkillsBackLink>
      <div className="flex items-center gap-3">
        <SkillCalendarArt className="h-8 w-8 shrink-0" />
        <h1 className="break-words font-display text-[30px] font-medium leading-tight text-text">{props.packTitle ?? "Your pack"}</h1>
      </div>

      <div className="mt-8 flex flex-col gap-8">
        {props.months.map((m) =>
          m.locked ? (
            <SkillUpgradePanel key={m.month} month={m.month} title={m.title} teaser={m.teaser} source="map" email={props.email ?? null} />
          ) : (
            <section key={m.month} aria-labelledby={`month-${m.month}`}>
              <h2 id={`month-${m.month}`} className="text-[13px] font-medium text-text-muted">
                Month {m.month}
                {m.title ? ` · ${m.title}` : ""}
              </h2>
              <ul className="mt-3 flex flex-col gap-3">
                {m.weeks.map((w) => {
                  const done = doneByWeek.get(w.weekNo) ?? new Set<number>();
                  return (
                    <li key={w.weekId} className="rounded-[14px] border border-border-strong-legacy bg-surface px-4 py-4">
                      <div className="flex items-baseline justify-between gap-3 text-[13px] text-text-muted">
                        <span>Week {w.weekNo}</span>
                        <span className="tabular-nums">
                          {done.size} of {STEPS_PER_WEEK} steps
                        </span>
                      </div>
                      <h3 className="mt-1 break-words text-[17px] font-medium text-text">{w.title}</h3>
                      <p className="mt-1 break-words text-[15px] text-text-muted">{w.goalLine}</p>
                      <ul className="mt-3 flex items-center gap-2" aria-label={`Week ${w.weekNo} steps`}>
                        {DAYS.map((d) => (
                          <li key={d} className="flex h-6 w-6 items-center justify-center">
                            {done.has(d) ? <SkillTickArt className="h-6 w-6" /> : <EmptyStep />}
                            <span className="sr-only">{done.has(d) ? `Day ${d} done` : `Day ${d} to do`}</span>
                          </li>
                        ))}
                      </ul>
                      <Link href={`/skills/week/${w.weekNo}/handout`} className={`${inkLink} mt-1`}>
                        Read the handout
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
        )}
      </div>
    </SkillsShell>
  );
}
