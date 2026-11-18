import Link from "next/link";
import { focusRing, inkLink, primaryButton } from "@/components/journal-auth-ui";
import { SkillBookArt } from "@/components/journal-skill-art";
import { SkillUpgradePanel } from "@/components/skill-upgrade-panel";
import { SkillsErrorView, SkillsShell } from "@/components/skills-shell";
import { SkillsTrack } from "@/components/skills-track";
import { DONE_LINE, EMPTY_LINE, dueNote, homeAction, percentDone, positionLine } from "@/lib/skills/home-state";
import { SKILLS_PAGES, SKILLS_PAGE_PATHS } from "@/lib/skills/pages-ready";
import type { HomeData } from "@/lib/skills/skills-server";

export type SkillsHomeViewProps = { kind: "error" } | { kind: "ok"; data: HomeData; email?: string | null };

/**
 * The skills home. PURE: it takes plain props and can be drawn without a login (the page file fetches the data).
 * One pack card, one primary button, and links that appear only once the page they lead to exists.
 */
export function SkillsHomeView(props: SkillsHomeViewProps) {
  if (props.kind === "error") return <SkillsErrorView />;
  const { data } = props;
  const next = data.next;
  const action = homeAction(next, data.dueReviews);
  const line = !data.hasProgress && !("locked" in next) && !("done" in next) ? EMPTY_LINE : "done" in next ? DONE_LINE : positionLine(next);
  const note = dueNote(next, data.dueReviews);
  const weekNo = "locked" in next || "done" in next ? null : next.weekNo;
  const percent = percentDone(data.completedSteps, data.totalSteps);
  const ready = action ? (action.kind === "wait" ? false : SKILLS_PAGES[action.kind]) : false;
  const href = action && action.kind !== "wait" ? SKILLS_PAGE_PATHS[action.kind] : "";

  return (
    <SkillsShell>
      <SkillsTrack event="skills_home_viewed" props={{ has_progress: data.hasProgress, due_reviews: data.dueReviews }} />
      <h1 className="font-display text-[34px] font-medium leading-tight text-text">Skills</h1>

      <section className="mt-6 rounded-[18px] border border-border-strong-legacy bg-surface px-5 py-5" aria-label="Your pack">
        <div className="flex items-start gap-3">
          <SkillBookArt className="mt-1 h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <h2 className="break-words font-display text-[24px] font-medium leading-snug text-text">{data.packTitle ?? "Your pack"}</h2>
            {line ? <p className="mt-1 text-[15px] text-text">{line}</p> : null}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between text-[13px] text-text-muted">
            <span>Progress</span>
            <span className="tabular-nums">
              {data.completedSteps} of {data.totalSteps} steps
            </span>
          </div>
          <span aria-hidden="true" className="relative mt-2 block h-3 overflow-hidden rounded-[3px] border border-text bg-powder">
            <span className="absolute inset-y-0 left-0 block bg-bar" style={{ width: `${percent}%` }} />
          </span>
        </div>

        {action ? (
          <div className="mt-5">
            {ready ? (
              <Link href={href} className={primaryButton}>
                {action.label}
              </Link>
            ) : (
              <button type="button" disabled className={primaryButton}>
                {action.label}
              </button>
            )}
            {note ? <p className="mt-2 text-[13px] text-text-muted">{note}</p> : null}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-x-6">
          {weekNo !== null ? (
            <Link href={`/skills/week/${weekNo}/handout`} className={inkLink}>
              {"Read this week's handout"}
            </Link>
          ) : null}
          <Link href={`/skills/${encodeURIComponent(data.packId)}`} className={inkLink}>
            See the map
          </Link>
        </div>
      </section>

      {"locked" in next ? (
        <div className="mt-6">
          <SkillUpgradePanel month={next.month} teaser={next.teaser} source="home" email={props.email ?? null} pickUp />
        </div>
      ) : null}

      {SKILLS_PAGES.review || SKILLS_PAGES.notebook ? (
        <nav aria-label="More" className="mt-6 flex flex-wrap gap-x-6">
          {SKILLS_PAGES.review ? (
            <Link href={SKILLS_PAGE_PATHS.review} className={`${inkLink} ${focusRing}`}>
              Review
            </Link>
          ) : null}
          {SKILLS_PAGES.notebook ? (
            <Link href={SKILLS_PAGE_PATHS.notebook} className={`${inkLink} ${focusRing}`}>
              Notebook
            </Link>
          ) : null}
        </nav>
      ) : null}
    </SkillsShell>
  );
}
