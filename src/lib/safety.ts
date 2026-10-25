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
  back: "Back to dashboard",
} as const;

// How long the pause lasts is decided by src/lib/safety-pause.ts (24 hours for Level 1, 72 hours for
// Level 2 or a repeat Level 1). The words below turn "minutes left" into plain language.

/**
 * "in 5 hours" / "in 24 hours" / "in 3 days". Always rounds UP, so the user is never told a shorter wait
 * than the real one (49 hours left reads "in 3 days"). Under an hour: "in less than an hour".
 */
export function describePauseWait(minutesLeft: number): string {
  if (!Number.isFinite(minutesLeft) || minutesLeft <= 0) return "very soon";
  if (minutesLeft < 60) return "in less than an hour";
  const hours = Math.ceil(minutesLeft / 60);
  if (hours < 48) return hours === 1 ? "in 1 hour" : `in ${hours} hours`;
  return `in ${Math.ceil(hours / 24)} days`;
}

/** The sentence on the Level 1 support page, or null when no pause is known (never promise a pause that is not there). */
export function level1PauseLine(minutesLeft: number | null | undefined): string | null {
  if (typeof minutesLeft !== "number" || !Number.isFinite(minutesLeft) || minutesLeft <= 0) return null;
  return `Ember will be back ${describePauseWait(minutesLeft)}.`;
}

/** The text of the break notice a paused user sees when they come back to a roast or a check-in. */
export function gentleNoticeText(minutesLeft: number | null | undefined): string {
  const known = typeof minutesLeft === "number" && Number.isFinite(minutesLeft) && minutesLeft > 0;
  return known
    ? `Ember is taking a break from roasts and check-ins. It will be back ${describePauseWait(minutesLeft)}. Be gentle with yourself.`
    : "Ember is taking a break from roasts and check-ins for now. Be gentle with yourself.";
}

/**
 * The three preset check-in buttons, in screen order. The only place their wording lives: the wizard renders
 * its buttons from this list and runCheckInSafety skips the classifier for an answer that is exactly one of
 * them, so editing a label here changes both together.
 */
export const CHECKIN_CHIP_LABELS = ["I actually did it", "I tried", "I failed again"] as const;

/**
 * True only when the (trimmed) answer is EXACTLY one of the preset button labels: same letters, same case,
 * nothing added. These carry no words of the person's own, and the classifier judged "I failed again" with
 * no question next to it as sadness. Any other text, even a label plus one word, is not a match.
 */
export function isCheckInChipAnswer(answer: unknown): boolean {
  return typeof answer === "string" && (CHECKIN_CHIP_LABELS as readonly string[]).includes(answer.trim());
}

// ---------------------------------------------------------------------------
// Response shapes shared by the routes and the browser
// ---------------------------------------------------------------------------

export type SafetyPagePayload = {
  kind: "page";
  level: FlagLevel;
  /** Level 1 only: AI (or fallback) lines shown after the fixed opener. */
  lines: string[];
  inPakistan: boolean;
  /**
   * Level 1 only: minutes Ember is paused, read back from the database AFTER the flag was saved. Missing or
   * null when no pause is confirmed (the flag could not be saved or read), and then the page says nothing about time.
   */
  pauseMinutes?: number | null;
};

/** What the roast / check-in gate answers while a pause is on. `minutesLeft` is null if it could not be worked out. */
export type GentlePayload = { gentle: true; minutesLeft: number | null };
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

// ONE structural rule for the quiet "nobody would miss me" wording. It needs three parts in the same
// sentence: (1) other people, (2) "would notice / miss / care / be fine / be better off", and (3) the
// speaker (I / me) as the subject of an absence: gone, disappeared, vanished, not around, not existing,
// not waking up, "without me". The absence has to END the clause (punctuation, "anymore", "for good", ...),
// so "...if I disappeared into my editing cave" or "...without me for a week" do not match, and neither
// does "nobody would notice if I changed the font". Anything it misses is left to the classifier.
const OTHERS = String.raw`(?:no ?one|nobody|people|everyone|everybody|anyone|anybody|they|others|my (?:family|friends|parents))`;
const MODAL = String.raw`(?:\s(?:would(?:n't|nt| not)?|will(?:n't| not)?|won't|wont)|'d|'ll)(?:\s(?:even|really|actually|probably|honestly|truly|ever))*`;
const REACTION = String.raw`(?:notice|miss|care|mind|be (?:fine|okay|ok|alright|happier|relieved|better(?: off)?))`;
const ABSENCE = String.raw`(?:gone|dead|disappear(?:ed)?|vanish(?:ed)?|die(?:d)?|never (?:existed|woke up|wake up|born)|(?:wasn't|weren't|was not|were not|am not|am no longer|didn't|did not|don't|do not)\s+(?:even\s+)?(?:around|here|alive|born|exist|exists|existing|wake up(?: tomorrow| tomorrow morning| tonight| in the morning| again)?)|stopped existing|stop existing)`;
const IF_I = String.raw`(?:if|when|once|after|that)\s+i(?:'m)?\s+(?:(?:just|suddenly|finally|actually|really|simply|completely|totally|ever|was|were|am|got)\s+)*${ABSENCE}`;
const CLAUSE_END = String.raw`(?=\s*(?:$|[.,!?;:)\-–—]|(?:anymore|any more|at all|for good|forever|completely|entirely|and|but|so|then|anyway|lol|lmao|haha)\b))`;
const NOBODY_WOULD_MISS_ME = new RegExp(
  String.raw`\b${OTHERS}${MODAL}\s${REACTION}\b[^.!?]{0,30}?\b(?:${IF_I}|without me|with me gone)${CLAUSE_END}`,
);

// Roman Urdu and Urdu script: "I am a burden" and "everyone is better off without me". Two narrow rules per
// script, all Level 2. They match STRUCTURE, never one sentence:
//   burden      the noun (bojh / bhoj / boojh ..., بوجھ) directly followed by a FIRST-PERSON verb (hoon / hun,
//               "ban gaya/gayi hoon", "lagta hoon"), or "main/mai ... bojh ban gaya" ending the sentence.
//               "kaam ka bojh hai", "bojh nahi hoon", "bojh utha kar thak gaya hoon" do not match.
//   better off  "mere bina / mere baghair / میرے بغیر" + an "everyone" word (sab, log, ghar wale, ...) + "behtar /
//               بہتر" in the same sentence, in any order. "mere bina party shuru mat karna" does not match.
// No lookbehind (old Safari) and no \b next to Urdu letters (JavaScript's \b ignores them): Urdu words are
// fenced with explicit letter classes instead. Anything these miss is left to the classifier.
const RU_SENTENCE = String.raw`[^.!?\n۔؟]`; // stays inside one sentence
const RU_BURDEN_WORD = String.raw`b(?:ho+j|o+jh)h?`; // bojh, boojh, bhoj, bhooj, bhojh, bhoojh
const RU_I_AM = String.raw`(?:ho{2,3}n|hoo|hun?)`; // hoon, hun, hu, hoo: first person only ("ho" = you, so it is left out)
const RU_BECAME = String.raw`ban\s*(?:gaya|gya|gayi|gai|gayee|chuka|chuki)`;
const ROMAN_URDU_BURDEN = new RegExp(
  String.raw`\b${RU_BURDEN_WORD}\s+(?:(?:${RU_BECAME}|ban(?:a|i)\s+hu[ai]|lag\s*(?:ta|ti))\s+)?${RU_I_AM}\b` +
    String.raw`|\bm(?:ain|ai)\b(?!\s+ne\b)${RU_SENTENCE}{0,24}?\b${RU_BURDEN_WORD}\s+${RU_BECAME}(?=\s*(?:$|[.,!?;:]))`,
);
const RU_ME_WITHOUT = String.raw`mer(?:e|ey|ay|y)\s+(?:bina|binaa|bna|bagair|baghair|baghayr|bagher|bghair|bgair|begair)`;
const RU_BETTER = String.raw`(?:behtar|behter|behtr|bahtar|bhetar|bhtar|better)`;
const RU_EVERYONE = String.raw`(?:sab|sabhi|sabhee|saare|sare|log|logon|sabko|ghar\s*wa(?:le|lay|lon)|gharwa(?:le|lay|lon)|family|ammi|abbu|ami|abu|dost|doston)`;
const ROMAN_URDU_BETTER_OFF = new RegExp(
  String.raw`(?=${RU_SENTENCE}{0,80}?\b${RU_ME_WITHOUT}\b)(?=${RU_SENTENCE}{0,80}?\b${RU_EVERYONE}\b)${RU_SENTENCE}{0,80}?\b${RU_BETTER}\b`,
);

const UR_LETTERS = "\\u0600-\\u06FF"; // Arabic / Urdu script letters
const UR_START = `(?:^|[^${UR_LETTERS}])`; // start of a word
const UR_END = `(?![${UR_LETTERS}])`; // end of a word
const UR_SPACE = "[\\s\\u200c\\u200d]*"; // spaces and zero-width joiners
const UR_SENTENCE = "[^.!?\\n۔؟]";
const UR_BURDEN_WORD = "بوج[ھہه]"; // بوجھ (also typed بوجہ / بوجه)
const UR_I_AM = "[ہهھ]و[ںن]"; // ہوں / ہون
const UR_BECAME = `بن${UR_SPACE}(?:گ(?:[یي]ا|ئ[یي])|چک[ایي])`; // بن گیا / بن گئی / بن چکا / بن چکی
const URDU_BURDEN = new RegExp(
  `${UR_START}${UR_BURDEN_WORD}${UR_END}${UR_SPACE}(?:(?:${UR_BECAME})${UR_END}${UR_SPACE})?${UR_I_AM}${UR_END}`,
);
const UR_ME_WITHOUT = `میرے${UR_SPACE}(?:بغیر|بنا)${UR_END}`; // میرے بغیر / میرے بنا
const UR_BETTER = `ب[ہهھ]تر${UR_END}`; // بہتر
const UR_EVERYONE = `(?:سب|سبھی|سارے|لوگ|لوگوں|گھر${UR_SPACE}والے|گھر${UR_SPACE}والوں|خاندان|امی|ابو|دوست|دوستوں)${UR_END}`;
const URDU_BETTER_OFF = new RegExp(
  `(?=${UR_SENTENCE}{0,80}?${UR_START}${UR_ME_WITHOUT})(?=${UR_SENTENCE}{0,80}?${UR_START}${UR_EVERYONE})${UR_SENTENCE}{0,80}?${UR_START}${UR_BETTER}`,
);

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
  // other people would not notice / miss / care if I were gone
  NOBODY_WOULD_MISS_ME,
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
  ROMAN_URDU_BURDEN,
  ROMAN_URDU_BETTER_OFF,
  // Urdu script
  /جینے کا (?:من|دل) نہیں/,
  /جینا نہیں چاہ/,
  /مرنا چاہ/,
  /خود ?کشی/,
  /زندگی (?:ختم|سے تنگ)/,
  URDU_BURDEN,
  URDU_BETTER_OFF,
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

// Each rule has a short fixed NAME so a diagnostic can say WHICH rule fired without ever printing the text it fired on.
const UNSAFE_OUTPUT_RULES: ReadonlyArray<readonly [name: string, rule: RegExp]> = [
  ["suicide-word", /\bsuicid(?:e|al)\b/],
  ["self-harm-word", /\bself[- ]?harm(?:ing)?\b/],
  ["kill-yourself", /\bkill (?:yourself|urself|yourselves)\b/],
  ["kys", /\bkys\b/],
  ["end-it-all-or-your-life", /\bend (?:it all|your life|yourself)\b/],
  ["hurt-yourself", /\b(?:hang|hurt|harm|cut|starve) (?:yourself|urself)\b/],
  ["nobody-would-miss-notice-care", /\b(?:no ?one|nobody) (?:would|will|'d) (?:even )?(?:miss|notice|care)\b/],
  ["world-better-without-you", /\bworld (?:would be|is|'d be) better (?:off )?without you\b/],
  ["go-die", /\b(?:go|just) die\b/],
  ["should-die", /\b(?:should|deserve to) (?:just )?die\b/],
  ["depression-word", /\bdepress(?:ed|ion)\b/],
  ["cry-about-it", /\bcry (?:about it|me a river|yourself to sleep|in (?:a|the) corner)\b/],
  ["crybaby", /\bcry ?babies\b|\bcry ?baby\b/],
  ["emo", /\bemo\b/],
  ["sad-boy-girl-loser", /\bsad (?:boy|girl|loser|sack|little)\b/],
  ["forever-alone", /\bforever alone\b/],
  ["dead-inside", /\bdead inside\b/],
  ["your-funeral", /\b(?:your|ur) (?:own )?funeral\b/],
  ["loner", /\bloner\b/],
  ["nobody-loves-you", /\b(?:no ?one|nobody) (?:loves|likes|cares about) you\b/],
];

export function outputLooksUnsafe(...texts: Array<string | null | undefined>): boolean {
  return outputRuleThatFired(...texts) !== null;
}

/**
 * Diagnostic: the NAME of the first output rule that fires on any of the texts, or null if none does.
 * It returns only the fixed rule name (for example "your-funeral"), never any of the text, so it is safe to
 * print or log. outputLooksUnsafe is exactly "a rule fired".
 */
export function outputRuleThatFired(...texts: Array<string | null | undefined>): string | null {
  for (const t of texts) {
    if (!t) continue;
    const n = normalize(t);
    for (const [name, rule] of UNSAFE_OUTPUT_RULES) if (rule.test(n)) return name;
  }
  return null;
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
