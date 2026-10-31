// Plan feature lists, shared by the landing page, /pricing and the upgrade modal
// so they can't drift apart.
import { FREE_DAILY_LIMIT, PRO_DAILY_LIMIT } from "@/lib/daily-limit";
import { personaLabel } from "@/lib/roast-personas";
import { ROAST_PERSONA_IDS } from "@/lib/roast-types";

export const PRO_PRICE = "$6.99";

export const FREE_FEATURES = [
  "1 roast per day",
  "Daily check-in",
  "5 categories graded",
  "Your Life Report Card",
];

export const PRO_FEATURES = [
  {
    title: `${PRO_DAILY_LIMIT} roasts or check-ins a day`,
    desc: `Free gets ${FREE_DAILY_LIMIT} a day. Pro gets ${PRO_DAILY_LIMIT}.`,
  },
  {
    title: `All ${ROAST_PERSONA_IDS.length} personas`,
    desc: `${personaLabel("gordon_ramsay")}, ${personaLabel("drill_sergeant")} — the full arsenal.`,
  },
  {
    title: "Your Arc",
    desc: "See how you stack up against everyone else brave enough to do this — and get a plan for closing the gap. We're not explaining the rest. You'll see.",
  },
  {
    title: "More categories, unlocking soon",
    desc: "We're not done grading you yet.",
  },
];
