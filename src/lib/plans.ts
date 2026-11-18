// The ONE place screens read plan numbers and plan wording from: the landing page, /pricing, the upgrade
// pop-up and (next) the banner and result page. Every number in the texts below comes from a constant,
// never from a typed digit, so the words cannot drift from what the code does.
//
// Where each number is defined:
//   daily limits      -> lib/daily-limit.ts (re-exported here)
//   mission length    -> lib/missions.ts (re-exported here)
//   minimum people    -> lib/percentile.ts (re-exported here)
//   voices            -> lib/roast-types.ts (ROAST_PERSONA_IDS)
//   categories        -> lib/arc-trend.ts (ARC_CATEGORIES)
//   trend days        -> here, read by app/api/user/arc/route.ts
//   dashboard history -> here (see the note above the two constants)
import { ARC_CATEGORIES } from "@/lib/arc-trend";
import { FREE_DAILY_LIMIT, PRO_DAILY_LIMIT } from "@/lib/daily-limit";
import { MISSION_LENGTH } from "@/lib/missions";
import { MIN_SAMPLE_SIZE } from "@/lib/percentile";
import { personaLabel } from "@/lib/roast-personas";
import { ROAST_PERSONA_IDS } from "@/lib/roast-types";

export { FREE_DAILY_LIMIT, PRO_DAILY_LIMIT, MISSION_LENGTH, MIN_SAMPLE_SIZE };

export const PRO_PRICE = "$6.99";

/** How many days of trend the Arc shows. Read by app/api/user/arc/route.ts. */
export const FREE_TREND_DAYS = 7;
export const PRO_TREND_DAYS = 30;

// How many results the dashboard lists (older ones are not deleted; they are just not listed).
// NOT wired in yet: app/dashboard/page.tsx still types these two numbers itself. It will import them
// from here after the streak branch (which also edits that page) is merged.
export const FREE_HISTORY_LIMIT = 12;
export const PRO_HISTORY_LIMIT = 100;

export const VOICE_COUNT = ROAST_PERSONA_IDS.length;
/** Free accounts are locked to the default voice (FREE_PERSONA in lib/roast-personas.ts). */
export const FREE_VOICE_COUNT = 1;
export const CATEGORY_COUNT = ARC_CATEGORIES.length;

const roastsOrCheckIns = (n: number) => (n === 1 ? "roast or check-in" : "roasts or check-ins");

export const FREE_FEATURES = [
  `${FREE_DAILY_LIMIT} ${roastsOrCheckIns(FREE_DAILY_LIMIT)} a day`,
  `The default voice (${FREE_VOICE_COUNT} of ${VOICE_COUNT})`,
  `${CATEGORY_COUNT} categories graded, A to F`,
  `${FREE_TREND_DAYS}-day trend`,
  `Your last ${FREE_HISTORY_LIMIT} results on your dashboard`,
];

export const PRO_FEATURES = [
  {
    title: `${PRO_DAILY_LIMIT} ${roastsOrCheckIns(PRO_DAILY_LIMIT)} a day`,
    desc: `Free gets ${FREE_DAILY_LIMIT} a day. Pro gets ${PRO_DAILY_LIMIT}.`,
  },
  {
    title: `All ${VOICE_COUNT} voices`,
    desc: `${personaLabel("gordon_ramsay")}, ${personaLabel("drill_sergeant")} — the full arsenal.`,
  },
  {
    title: `${PRO_TREND_DAYS}-day trend`,
    desc: "Plus the change since your first day.",
  },
  {
    title: `${MISSION_LENGTH}-day missions`,
    desc: "On your weakest category.",
  },
  {
    title: "See how you compare with other Ember users",
    desc: `Shown once at least ${MIN_SAMPLE_SIZE} people have a score.`,
  },
  {
    title: `Your last ${PRO_HISTORY_LIMIT} results on your dashboard`,
    desc: `Free shows your last ${FREE_HISTORY_LIMIT}.`,
  },
];

/** Free vs Pro, row by row. Not shown on any screen yet (next phase). */
export const PLAN_COMPARISON: { label: string; free: string; pro: string }[] = [
  { label: "Roasts or check-ins a day", free: `${FREE_DAILY_LIMIT}`, pro: `${PRO_DAILY_LIMIT}` },
  { label: "Voices", free: "Default only", pro: `All ${VOICE_COUNT}` },
  { label: "Categories graded", free: `${CATEGORY_COUNT}`, pro: `${CATEGORY_COUNT}` },
  { label: "Trend", free: `${FREE_TREND_DAYS} days`, pro: `${PRO_TREND_DAYS} days, plus the change since your first day` },
  { label: "Results on your dashboard", free: `Last ${FREE_HISTORY_LIMIT}`, pro: `Last ${PRO_HISTORY_LIMIT}` },
  { label: `${MISSION_LENGTH}-day missions`, free: "No", pro: "Yes" },
  { label: "Compare with other Ember users", free: "No", pro: `Yes, once ${MIN_SAMPLE_SIZE} people have a score` },
];

// Ready-made sentences for the upgrade banner, the upgrade pop-up and the result page. Not shown on any
// screen yet (next phase): those components still carry their own text.
export const UPGRADE_BANNER_TEXT = `Free plan: ${FREE_DAILY_LIMIT} ${roastsOrCheckIns(FREE_DAILY_LIMIT)} a day.`;
export const UPGRADE_LIMIT_TEXT = `You've used today's free ${roastsOrCheckIns(FREE_DAILY_LIMIT)}. Pro gets ${PRO_DAILY_LIMIT} a day.`;
export const RESULT_UPSELL_TEXT = `Want more from Ember? Pro adds a second roast or check-in each day, all ${VOICE_COUNT} voices and ${MISSION_LENGTH}-day missions.`;
export const RESULT_UPSELL_BUTTON = "See Pro";
