// Ember safety layer: pure helpers (no imports, no I/O) so they can be unit-tested with
// `node --test` and imported by scripts/safety-eval.mjs.
//
// Levels: 0 = normal, 1 = sadness / heavy stress, 2 = any sign of risk or danger.
// NOTHING in this file may log, store or send user text.

export type SafetyLevel = 0 | 1 | 2;
export type FlagLevel = 1 | 2;

// ---------------------------------------------------------------------------
// Fixed page text (approved wording)
// ---------------------------------------------------------------------------

export const FINDAHELPLINE_URL = "https://findahelpline.com";

export const LEVEL2_TEXT = {
  title: "I'm worried about you, and I'm glad you said something.",
  safety: "Your safety matters more than anything on this app.",
  emergency: "If you might act on these thoughts, or you are in danger right now, call emergency services.",
  pakistanEmergency: "In Pakistan: 1122",
  elsewhereEmergency: "Anywhere else: call your local emergency number.",
  localEmergency: "Call your local emergency number.",
  talkHeading: "Talk to someone who can help",
  rozan: "Rozan Counseling Helpline (Pakistan): 0304 111 1741",
  linkLabel: "Find a helpline in your country",
  tellSomeone:
    "If you can, tell someone near you: 'I'm not okay. Please stay with me.' If you can, put some distance between yourself and anything you could use to hurt yourself.",
  aiNote: "I'm an AI, so I can't be there with you. You deserve real people.",
  back: "Back to dashboard",
} as const;

export const LEVEL1_TEXT = {
  opener: "That sounds really heavy.",
  aiNote:
    "I'm an AI, not a person or a counselor, so I won't pretend to know everything about what you're going through. But I don't want to roast anything right now.",
  smallThingsHeading: "A few small things that can help",
  smallThings: [
    "Tell one person today, even one line: 'I'm having a hard time.'",
    "Drink some water, eat something, and step outside for five minutes.",
    "Write down what's weighing on you. It doesn't have to make sense.",
  ],
  keepsHeavy:
    "If it keeps feeling this heavy, talking to someone you trust or a counselor can really help.",
  findSupport: "Find support near you",
  back: "Back to dashboard",
  notNow: "Not now",
} as const;

/** Used when the AI lines fail validation or the call fails. The opener is already on the page. */
export const LEVEL1_FALLBACK_LINES: readonly string[] = ["You don't have to fix this tonight."];

export const UNAVAILABLE_TEXT = {
  message: "Ember couldn't check this right now. Nothing was saved. Please try again in a few minutes.",
  link: "Find a helpline",
} as const;

export const GENTLE_TEXT = {
  message: "Ember is taking a break from roasting for a few days. Be gentle with yourself.",
  back: "Back to dashboard",
} as const;

/** How long gentle mode lasts after a flag. */
export const GENTLE_WINDOW_MS = 72 * 60 * 60 * 1000;

/** The three fixed check-in buttons. They are never a safety signal. */
export const CHECKIN_CHIP_LABELS = ["I actually did it", "I tried", "I failed again"] as const;

// ---------------------------------------------------------------------------
// Response shapes shared by the routes and the browser
// ---------------------------------------------------------------------------

export type SafetyPagePayload = {
  kind: "page";
  level: FlagLevel;
  /** Level 1 only: AI (or fallback) lines shown after the fixed opener. */
  lines: string[];
  inPakistan: boolean;
};
export type SafetyUnavailablePayload = { kind: "unavailable" };
export type SafetyPayload = SafetyPagePayload | SafetyUnavailablePayload;

// ---------------------------------------------------------------------------
// Level resolution
// ---------------------------------------------------------------------------

/** Accepts 0/1/2 as a number or numeric string. Anything else is "no usable answer" (null). */
export function parseLevel(raw: unknown): SafetyLevel | null {
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t === "0" || t === "1" || t === "2") return Number(t) as SafetyLevel;
    return null;
  }
  if (raw === 0 || raw === 1 || raw === 2) return raw;
  return null;
}

export type SafetyDecision = { kind: "level"; level: SafetyLevel } | { kind: "unavailable" };

/**
 * Combines the AI's answer with the rule filter.
 * - Both are combined with max(): "unsure = higher level".
 * - If the AI gave no usable answer (call failed, timed out, bad JSON) and the rule filter
 *   found nothing, the check could not be done: "unavailable" (never a roast, never a flag).
 * - If the AI failed but the rule filter matched, the rule level stands (it needs no AI).
 */
export function resolveSafety(ai: unknown, rule: SafetyLevel): SafetyDecision {
  const parsed = parseLevel(ai);
  if (parsed === null) return rule > 0 ? { kind: "level", level: rule } : { kind: "unavailable" };
  return { kind: "level", level: Math.max(parsed, rule) as SafetyLevel };
}

/**
 * Combines every signal for the first-time roast and the returning-user follow-up paths:
 *   rule      the phrase filter (needs no AI)
 *   classify  the dedicated classify-only call, run BEFORE anything is generated
 *   inCall    the safety_level key that the roast / follow-up call itself returns (extra signal)
 *
 * The final level is the HIGHEST of all signals ("unsure = higher level").
 * Fail closed: if the classify call gave no usable answer (failed, timed out, bad JSON) and no
 * phrase matched, the check could not be done: "unavailable" (never a roast, never a flag).
 * The in-call level can only raise the result; a missing in-call level is never a failure
 * because the classifier has already answered.
 */
export function combineSignals(signals: {
  rule: SafetyLevel;
  classify: SafetyLevel | null;
  inCall?: SafetyLevel | null;
}): SafetyDecision {
  if (signals.classify === null && signals.rule === 0) return { kind: "unavailable" };
  const level = Math.max(signals.rule, signals.classify ?? 0, signals.inCall ?? 0) as SafetyLevel;
  return { kind: "level", level };
}

// ---------------------------------------------------------------------------
// Rule filter: high-precision phrases that can only RAISE the level.
// Needs no AI. English, Roman Urdu and Urdu script. First-person wording only, so
// "my friend wants to hurt herself" is left to the AI (Level 1).
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/\s+/g, " ");
}

const LEVEL2_RULES: RegExp[] = [
  // harming / ending myself
  /\b(?:kill|killing|hurt|hurting|harm|harming|cut|cutting) (?:myself|my self)\b/,
  /\bend(?:ing)? (?:it all|my life|my own life)\b/,
  /\b(?:take|taking) my (?:own )?life\b/,
  /\b(?:commit|committing) suicide on myself\b/,
  /\bi(?:'m| am| feel| keep feeling| have been feeling) (?:feeling )?suicidal\b/,
  /\b(?:think|thinking|thoughts?) (?:about|of) (?:suicide|dying|death|ending it|not being here|not being alive|not existing)\b/,
  // no wish to live
  /\b(?:do not|don't|dont|no longer) (?:want|wanna) to (?:live|be alive|exist|wake up)\b(?! (?:in|with|near|at|here|there|alone)\b)/,
  /\bi (?:just |really )?(?:want|wanna) to (?:die|be dead)\b/,
  /\bwish i (?:was|were) (?:dead|never born)\b/,
  /\bwish i (?:could )?(?:just )?(?:disappear|vanish|never wake up|not wake up)\b/,
  /\b(?:better|best) off without me\b/,
  /\b(?:better|best) off if i (?:was|were) (?:gone|dead)\b/,
  // harming others / danger
  /\b(?:going to|gonna|want to|wanna|about to|will) (?:hurt|kill|stab|shoot|harm|murder) (?:someone|somebody|him|her|them|people|everyone)\b/,
  // Roman Urdu
  /jeene ka (?:mann|man|dil) nahi/,
  /jeena nahi chah/,
  /mujhe (?:jeena|jena) nahi/,
  /(?:marna|mar jana|mar jaana|mar jaun|mar jaon) (?:chah|hai)/,
  /\bmar jaun\b|\bmar jaon\b/,
  /khud ?kushi|khud ?kashi/,
  /khud ko (?:khatam|maar)/,
  /apni jaan (?:le|de)/,
  // Urdu script
  /جینے کا (?:من|دل) نہیں/,
  /جینا نہیں چاہ/,
  /مرنا چاہ/,
  /خود ?کشی/,
  /زندگی (?:ختم|سے تنگ)/,
];

const LEVEL1_RULES: RegExp[] = [
  /\bfeel(?:ing)? (?:so |really |very |completely |totally |just )?(?:alone|lonely|hopeless|worthless|empty)\b/,
  /\bi(?:'m| am) (?:so |really |very )?(?:depressed|hopeless|worthless)\b/,
  /\bcried all (?:night|day)\b/,
  /\b(?:no ?one|nobody) (?:cares|loves|likes) (?:about )?me\b/,
  /\bfeel(?:ing)? like (?:a |an )?(?:total |complete |absolute |such a )?failure\b/,
  /bohat akela|bahut akela|akela feel|akeli feel|bohat udaas|bahut udaas/,
  /تنہا|اکیلا محسوس|اکیلی محسوس/,
];

export function ruleFloorLevel(...texts: Array<string | null | undefined>): SafetyLevel {
  let level: SafetyLevel = 0;
  for (const t of texts) {
    if (!t) continue;
    const n = normalize(t);
    if (LEVEL2_RULES.some((r) => r.test(n))) return 2;
    if (level < 1 && LEVEL1_RULES.some((r) => r.test(n))) level = 1;
  }
  return level;
}

// ---------------------------------------------------------------------------
// Output check: block generated text (roast / plan / title / punchline) that mocks sadness,
// self-harm or pain. WHOLE-WORD matching only, so "emotional", "dead tired", "killing it",
// "cry" and "died laughing" are fine.
// ---------------------------------------------------------------------------

const UNSAFE_OUTPUT_RULES: RegExp[] = [
  /\bsuicid(?:e|al)\b/,
  /\bself[- ]?harm(?:ing)?\b/,
  /\bkill (?:yourself|urself|yourselves)\b/,
  /\bkys\b/,
  /\bend (?:it all|your life|yourself)\b/,
  /\b(?:hang|hurt|harm|cut|starve) (?:yourself|urself)\b/,
  /\b(?:no ?one|nobody) (?:would|will|'d) (?:even )?(?:miss|notice|care)\b/,
  /\bworld (?:would be|is|'d be) better (?:off )?without you\b/,
  /\b(?:go|just) die\b/,
  /\b(?:should|deserve to) (?:just )?die\b/,
  /\bdepress(?:ed|ion)\b/,
  /\bcry (?:about it|me a river|yourself to sleep|in (?:a|the) corner)\b/,
  /\bcry ?babies\b|\bcry ?baby\b/,
  /\bemo\b/,
  /\bsad (?:boy|girl|loser|sack|little)\b/,
  /\bforever alone\b/,
  /\bdead inside\b/,
  /\b(?:your|ur) (?:own )?funeral\b/,
  /\bloner\b/,
  /\b(?:no ?one|nobody) (?:loves|likes|cares about) you\b/,
];

export function outputLooksUnsafe(...texts: Array<string | null | undefined>): boolean {
  for (const t of texts) {
    if (!t) continue;
    const n = normalize(t);
    if (UNSAFE_OUTPUT_RULES.some((r) => r.test(n))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Level 1 AI lines: validated in code, fixed fallback otherwise
// ---------------------------------------------------------------------------

const MAX_LINE_CHARS = 110;
const MAX_LINE_WORDS = 20;

const BANNED_LINE_RULES: RegExp[] = [
  // promises / reassurance about the future
  /\b(?:will|'ll|gonna|going to) (?:get|be|feel) (?:better|okay|ok|fine|alright|easier)\b/,
  /\bit gets better\b/,
  /\beverything (?:will|is going to|'ll)\b/,
  /\bpromise\b/,
  /\byou(?:'ll| will| are going to) (?:be|feel|get|find|make it)\b/,
  // medical / diagnosis
  /\b(?:depress|anxi|disorder|diagnos|therap|medicat|trauma|panic attack|mental illness)/,
  // jokes / roast voice
  /\b(?:lol|lmao|haha|joke|roast|savage|brutal)\b/,
  // advice and blame
  /\byou (?:should|need to|must|have to)\b|\btry to\b|\bhave you tried\b/,
  /\byour fault\b|\bbecause you\b|\byou (?:caused|brought)\b|\byou(?:'re| are) (?:to blame|being dramatic)\b/,
  // guessing what another person thinks or feels
  /\b(?:she|he|they|your (?:friend|mom|mum|dad|mother|father|brother|sister|partner|boss|family|colleague|teacher))\b[^.!?]*\b(?:think|thinks|feel|feels|want|wants|love|loves|care|cares|hate|hates|ignore|ignores|doesn't|don't|isn't)\b/,
];

const EMOJI_RE = /[\p{Extended_Pictographic}‍️]/u;

export function validateSupportLines(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 2) return null;
  const lines: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return null;
    const line = item.replace(/\s+/g, " ").trim();
    if (!line || line.length > MAX_LINE_CHARS) return null;
    if (line.split(" ").length > MAX_LINE_WORDS) return null;
    if (EMOJI_RE.test(line)) return null;
    // exactly one sentence, ending in . or !
    if (!/^[^.!?]+[.!]$/.test(line)) return null;
    // The prompt asks for plain English; anything in another script is rejected.
    if (/[^\x20-\x7e‘’]/.test(line)) return null;
    if (BANNED_LINE_RULES.some((r) => r.test(line.toLowerCase().replace(/[‘’]/g, "'")))) return null;
    if (line.toLowerCase() === LEVEL1_TEXT.opener.toLowerCase()) continue; // opener is already on the page
    lines.push(line);
  }
  return lines.length > 0 ? lines : null;
}

/** The lines to show: the validated AI lines, or the fixed fallback. */
export function supportLinesOrFallback(candidate: unknown): string[] {
  return validateSupportLines(candidate) ?? [...LEVEL1_FALLBACK_LINES];
}

// ---------------------------------------------------------------------------
// Country and logging
// ---------------------------------------------------------------------------

/** Pakistan numbers are shown ONLY when Vercel says the request came from PK. */
export function isPakistan(headers: { get(name: string): string | null } | null | undefined): boolean {
  const country = headers?.get("x-vercel-ip-country");
  return typeof country === "string" && country.trim().toUpperCase() === "PK";
}

/** The only safety log line that may exist: the level and the route. Never text, never ids. */
export function safetyLog(level: SafetyLevel | "unavailable" | "output-blocked", route: string): void {
  console.warn(`[safety] level=${level} route=${route}`);
}

/** Cuts browser-supplied strings to a sane size before they go in a prompt or the database. */
export function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
