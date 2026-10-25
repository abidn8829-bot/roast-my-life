"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { useEffect } from "react";
import {
  FINDAHELPLINE_URL,
  GENTLE_TEXT,
  LEVEL1_TEXT,
  LEVEL2_TEXT,
  UNAVAILABLE_TEXT,
  gentleNoticeText,
  level1PauseLine,
  type SafetyPagePayload,
} from "@/lib/safety";

// The support pages. Rules: no persona, no roast, no grades, no streak, no share link, no
// upsell, no emoji. Rendered inline from the API response, so what the AI wrote for Level 1 is
// never in a URL or a log. PostHog: session recording is stopped while one of these is on
// screen, and the whole page carries ph-no-capture (blocked from autocapture and replay).

function usePrivateScreen() {
  useEffect(() => {
    try {
      posthog.stopSessionRecording();
    } catch {
      // PostHog not initialised (blocked, offline, dev): nothing to stop.
    }
  }, []);
}

const shell = "ph-no-capture flex min-h-screen w-full flex-col items-center justify-center px-4 py-10";
const card = "w-full max-w-md text-left";
const primaryBtn =
  "flex min-h-12 w-full items-center justify-center rounded-xl bg-ember px-6 py-3 text-center text-base font-semibold text-white transition hover:brightness-110";
const outlineBtn =
  "flex min-h-12 w-full items-center justify-center rounded-xl border border-border px-6 py-3 text-center text-base font-semibold text-text transition hover:border-text-faint";
const quietBtn =
  "flex min-h-12 w-full items-center justify-center rounded-xl px-6 py-3 text-center text-base text-text-muted transition hover:text-text";

function HelplineLink({ label, className }: { label: string; className: string }) {
  return (
    <a href={FINDAHELPLINE_URL} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  );
}

function Level2Page({ inPakistan }: { inPakistan: boolean }) {
  const t = LEVEL2_TEXT;
  return (
    <div className={shell}>
      <div className={card}>
        <h1 className="mb-5 text-2xl font-bold leading-snug text-text">{t.title}</h1>
        <p className="mb-4 text-base leading-relaxed text-text">{t.safety}</p>
        <p className="mb-4 text-base leading-relaxed text-text">{t.emergency}</p>
        {inPakistan ? (
          <>
            <p className="mb-1 text-lg font-semibold text-text">
              In Pakistan: <a href="tel:1122" className="underline">1122</a>
            </p>
            <p className="mb-6 text-base text-text-muted">{t.elsewhereEmergency}</p>
          </>
        ) : (
          <p className="mb-6 text-lg font-semibold text-text">{t.localEmergency}</p>
        )}

        <h2 className="mb-3 text-lg font-semibold text-text">{t.talkHeading}</h2>
        {inPakistan ? (
          <p className="mb-4 text-base text-text">
            Rozan Counseling Helpline (Pakistan): <a href="tel:03041111741" className="underline">0304 111 1741</a>
          </p>
        ) : null}
        <HelplineLink label={t.linkLabel} className={`${outlineBtn} mb-6`} />

        <p className="mb-4 text-base leading-relaxed text-text">{t.tellSomeone}</p>
        <p className="mb-8 text-base leading-relaxed text-text-muted">{t.aiNote}</p>

        <Link href="/dashboard" className={primaryBtn}>
          {t.back}
        </Link>
      </div>
    </div>
  );
}

function Level1Page({ lines, pauseMinutes }: { lines: string[]; pauseMinutes?: number | null }) {
  const t = LEVEL1_TEXT;
  // "Ember will be back in 24 hours." Only shown when the server confirmed a pause (flag saved and read back).
  const pauseLine = level1PauseLine(pauseMinutes);
  return (
    <div className={shell}>
      <div className={card}>
        <h1 className="mb-2 text-2xl font-bold leading-snug text-text">{t.opener}</h1>
        {lines.map((line, i) => (
          <p key={i} className="mb-2 text-lg leading-relaxed text-text">
            {line}
          </p>
        ))}
        <p className={`mt-4 text-base leading-relaxed text-text-muted ${pauseLine ? "mb-3" : "mb-6"}`}>{t.aiNote}</p>
        {pauseLine ? <p className="mb-6 text-base leading-relaxed text-text">{pauseLine}</p> : null}

        <h2 className="mb-3 text-lg font-semibold text-text">{t.smallThingsHeading}</h2>
        <ul className="mb-6 list-disc space-y-2 pl-5 text-base leading-relaxed text-text">
          {t.smallThings.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mb-8 text-base leading-relaxed text-text-muted">{t.keepsHeavy}</p>

        <div className="flex flex-col gap-3">
          <HelplineLink label={t.findSupport} className={outlineBtn} />
          <Link href="/dashboard" className={primaryBtn}>
            {t.back}
          </Link>
          <Link href="/dashboard" className={quietBtn}>
            {t.notNow}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function SafetyPage({ payload }: { payload: SafetyPagePayload }) {
  usePrivateScreen();
  return payload.level === 2 ? (
    <Level2Page inPakistan={payload.inPakistan} />
  ) : (
    <Level1Page lines={payload.lines} pauseMinutes={payload.pauseMinutes} />
  );
}

/** The safety check could not run (and nothing in the text matched a rule). Nothing was saved. */
export function SafetyUnavailable({ onDismiss }: { onDismiss: () => void }) {
  usePrivateScreen();
  return (
    <div className={shell}>
      <div className={card}>
        <p className="mb-6 text-lg leading-relaxed text-text">{UNAVAILABLE_TEXT.message}</p>
        <button type="button" onClick={onDismiss} className={`${primaryBtn} mb-3`}>
          Try again
        </button>
        <Link href="/dashboard" className={`${quietBtn} mb-1`}>
          {LEVEL1_TEXT.back}
        </Link>
        <HelplineLink label={UNAVAILABLE_TEXT.link} className="block py-2 text-center text-sm text-text-faint underline" />
      </div>
    </div>
  );
}

/** The pause is on: the server refused to roast or check in. Short, kind, says how long, one way out. */
export function GentleNotice({ minutesLeft }: { minutesLeft?: number | null }) {
  return (
    <div data-break-notice className={shell}>
      <div className={card}>
        <p className="mb-8 text-lg leading-relaxed text-text">{gentleNoticeText(minutesLeft)}</p>
        <Link href="/dashboard" className={primaryBtn}>
          {GENTLE_TEXT.back}
        </Link>
      </div>
    </div>
  );
}
