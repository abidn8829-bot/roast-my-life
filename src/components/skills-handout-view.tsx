import { inkLink } from "@/components/journal-auth-ui";
import { SkillBookArt } from "@/components/journal-skill-art";
import { SkillUpgradePanel } from "@/components/skill-upgrade-panel";
import { SkillsBackLink, SkillsErrorView, SkillsShell } from "@/components/skills-shell";
import { SkillsTrack } from "@/components/skills-track";
import { parseHandout, type Inline } from "@/lib/skills/handout-blocks";
import type { Handout, LockedResult } from "@/lib/skills/skills-server";

export type SkillsHandoutViewProps =
  | { kind: "error" }
  | { kind: "locked"; locked: LockedResult; email?: string | null }
  | { kind: "ok"; handout: Handout };

/** Plain text and bold pieces. Always drawn as text, never as HTML. */
function Parts({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) => (p.bold ? <strong key={i} className="font-medium">{p.text}</strong> : <span key={i}>{p.text}</span>))}
    </>
  );
}

/** The week's handout, read only, and its sources. PURE: plain props, no login needed. */
export function SkillsHandoutView(props: SkillsHandoutViewProps) {
  if (props.kind === "error") return <SkillsErrorView />;

  if (props.kind === "locked") {
    return (
      <SkillsShell>
        <SkillsBackLink href="/skills">Skills</SkillsBackLink>
        <SkillUpgradePanel month={props.locked.month} teaser={props.locked.teaser} source="handout" email={props.email ?? null} />
      </SkillsShell>
    );
  }

  const h = props.handout;
  const blocks = parseHandout(h.handoutMd);
  return (
    <SkillsShell>
      <SkillsTrack event="skill_handout_viewed" props={{ week: h.weekNo }} />
      <SkillsBackLink href={`/skills/${encodeURIComponent(h.packId)}`}>Back to the map</SkillsBackLink>

      <p className="text-[13px] font-medium text-text-muted">
        Month {h.month} {"·"} Week {h.weekNo}
      </p>
      <div className="mt-1 flex items-start gap-3">
        <SkillBookArt className="mt-1 h-8 w-8 shrink-0" />
        <h1 className="min-w-0 break-words font-display text-[30px] font-medium leading-tight text-text">{h.title}</h1>
      </div>
      <p className="mt-3 break-words text-[16px] text-text-muted">{h.goalLine}</p>

      <article className="mt-6 flex flex-col gap-4 text-[16px] leading-relaxed text-text">
        {blocks.map((b, i) =>
          b.kind === "heading" ? (
            <h2 key={i} className="mt-2 break-words font-display text-[22px] font-medium leading-snug">
              <Parts parts={b.parts} />
            </h2>
          ) : b.kind === "list" ? (
            <ul key={i} className="flex list-disc flex-col gap-2 pl-5">
              {b.items.map((item, j) => (
                <li key={j} className="break-words">
                  <Parts parts={item} />
                </li>
              ))}
            </ul>
          ) : (
            <p key={i} className="break-words">
              <Parts parts={b.parts} />
            </p>
          ),
        )}
      </article>

      <section className="mt-10 border-t border-border-strong-legacy pt-6" aria-labelledby="sources-heading">
        <h2 id="sources-heading" className="text-[13px] font-medium text-text-muted">
          Sources
        </h2>
        {h.sources.length === 0 ? (
          <p className="mt-3 text-[15px] text-text-muted">No sources are listed for this week.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {h.sources.map((s) => (
              <li key={s.ref} className="break-words text-[15px] text-text">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className={inkLink}>
                    {s.title}
                  </a>
                ) : (
                  <span className="font-medium">{s.title}</span>
                )}
                {s.publisher || s.year !== null ? (
                  <span className="block text-[13px] text-text-muted">
                    {[s.publisher, s.year !== null ? String(s.year) : null].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </SkillsShell>
  );
}
