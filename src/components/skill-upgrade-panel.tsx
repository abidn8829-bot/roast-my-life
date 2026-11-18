"use client";

import { focusRing } from "@/components/journal-auth-ui";
import { SkillLockArt } from "@/components/journal-skill-art";
import { SkillsTrack, trackSkills } from "@/components/skills-track";
import { UPGRADE_EMAIL_HINT, getUpgradeUrl } from "@/lib/upgrade-url";

/**
 * What a free user sees in place of a locked month. It shows ONLY the month number, its title and one teaser line,
 * never a week, a step or a handout. `pickUp` is the wording for a step the user reached but cannot open yet.
 * Presentation plus two analytics events (the panel was shown, the button was clicked).
 */
export function SkillUpgradePanel({
  month,
  title = null,
  teaser,
  source,
  email = null,
  pickUp = false,
}: {
  month: number;
  title?: string | null;
  teaser: string | null;
  source: "map" | "handout" | "step" | "home";
  email?: string | null;
  pickUp?: boolean;
}) {
  const teaserLine = typeof teaser === "string" && teaser.trim() ? teaser.trim() : null;
  return (
    <section className="rounded-[18px] border border-border-strong-legacy bg-surface px-5 py-5" aria-label={`Month ${month}`}>
      <SkillsTrack event="skill_locked_viewed" props={{ month }} />
      {pickUp ? <p className="mb-2 text-sm text-text-muted">Pick up where you left off</p> : null}
      <div className="flex items-start gap-3">
        <SkillLockArt className="mt-0.5 h-7 w-7 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-[19px] font-medium leading-snug text-text">Month {month} is part of Pro</h3>
          {title ? <p className="mt-1 break-words text-[15px] text-text">{title}</p> : null}
          {teaserLine ? <p className="mt-1 break-words text-[15px] text-text-muted">{teaserLine}</p> : null}
        </div>
      </div>
      <a
        href={getUpgradeUrl(email)}
        onClick={() => trackSkills({ event: "skill_upgrade_clicked", props: { month, source } })}
        className={`mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-ember text-base font-medium text-on-accent transition hover:opacity-90 ${focusRing}`}
      >
        Upgrade to Pro
      </a>
      <p className="mt-3 text-[13px] text-text-muted">{UPGRADE_EMAIL_HINT}</p>
    </section>
  );
}
